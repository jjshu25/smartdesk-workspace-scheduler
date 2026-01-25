import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import si from 'systeminformation';
import os from 'os';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {});

const SERVER_URL = process.env.MAIN_SERVER_URL || 'http://localhost:5000';

// ✅ NEW: Store PC ID in a local config file
const CONFIG_DIR = path.join(process.env.APPDATA || process.env.HOME || '.', '.smartdesk');
const PC_ID_FILE = path.join(CONFIG_DIR, 'pc-id.json');

let metricsInterval: NodeJS.Timeout | null = null;
let mainSocket: any = null;
let pcId: string | null = null;
let isConnected: boolean = false;
let connectionAttempts: number = 0;

// ✅ NEW: Timer state variables
let timerActive: boolean = false;
let timerStartTime: Date | null = null;
let timerDuration: number = 0; // in seconds
let timerInterval: NodeJS.Timeout | null = null;
let sessionStartTime: Date | null = null;

// ✅ NEW: Initialize config directory and load stored PC ID
function initializeConfig() {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      console.log(`📁 Created config directory: ${CONFIG_DIR}`);
    }

    if (fs.existsSync(PC_ID_FILE)) {
      const data = fs.readFileSync(PC_ID_FILE, 'utf-8');
      const config = JSON.parse(data);
      pcId = config.pcId;
      console.log(`✅ Loaded stored PC ID: ${pcId}`);
    }
  } catch (error) {
    console.error(`⚠️  Failed to load config: ${error}`);
  }
}

// ✅ NEW: Save PC ID to local file
function savePCId(id: string) {
  try {
    const config = { pcId: id, registeredAt: new Date() };
    fs.writeFileSync(PC_ID_FILE, JSON.stringify(config, null, 2));
    console.log(`💾 Saved PC ID: ${id}`);
  } catch (error) {
    console.error(`⚠️  Failed to save PC ID: ${error}`);
  }
}

// ✅ NEW: ESP32 Configuration
const ESP32_URL = process.env.ESP32_URL || 'http://192.168.5.74';
const ESP32_TIMER_ENDPOINT = `${ESP32_URL}/api/timer`;

// ✅ NEW: Send timer data to ESP32
async function sendTimerToESP32(timerData: {
  pcId: string;
  pcName: string;
  timeRemaining: number;
  totalDuration: number;
  status: 'started' | 'running' | 'stopped';
  userName: string;
  timestamp: string;
}) {
  try {
    if (!mainSocket?.connected) {
      console.log(`⚠️  Skipping ESP32 sync (server disconnected)`);
      return;
    }

    await axios.post(ESP32_TIMER_ENDPOINT, timerData, {
      timeout: 2000,
    });

    console.log(`📱 ✅ Timer sent to ESP32: ${timerData.timeRemaining}s remaining`);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.log(`📱 ⚠️  ESP32 unreachable (${ESP32_URL})`);
    } else {
      console.error(`📱 ❌ Failed to send timer to ESP32:`, error.message);
    }
  }
}

// ✅ SINGLE startTimer function with ESP32 sync
function startTimer(durationInSeconds: number, userName: string = 'Unknown') {
  try {
    const validDuration = Math.max(parseInt(String(durationInSeconds), 10), 1);
    
    if (timerActive) {
      console.log(`⚠️  Timer already running! Duration remaining: ${timerDuration}s`);
      return;
    }

    timerActive = true;
    timerStartTime = new Date();
    timerDuration = validDuration;
    sessionStartTime = new Date();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`⏱️  TIMER STARTED`);
    console.log(`${'='.repeat(60)}`);
    console.log(`⏰ Start Time: ${timerStartTime.toLocaleTimeString()}`);
    console.log(`👤 User: ${userName}`);
    console.log(`⏳ Duration: ${formatTime(timerDuration)}`);
    console.log(`⏳ Duration (seconds): ${timerDuration}s`);
    console.log(`${'='.repeat(60)}\n`);

    if (mainSocket && mainSocket.connected) {
      mainSocket.emit('session-start', {
        pcId: pcId,
        userName: userName,
        startTime: timerStartTime.toISOString(),
        duration: validDuration,
      });
      console.log(`📡 Session start notification sent to server with ${validDuration}s duration`);
    }

    sendTimerToESP32({
      pcId: pcId || 'unknown',
      pcName: process.env.PC_NAME || `PC-${os.hostname()}`,
      timeRemaining: validDuration,
      totalDuration: validDuration,
      status: 'started',
      userName: userName,
      timestamp: new Date().toISOString(),
    });

    timerInterval = setInterval(() => {
      timerDuration--;

      if (timerDuration <= 0) {
        stopTimer(userName);
        return;
      }

      if (timerDuration % 10 === 0 || timerDuration <= 30) {
        console.log(`⏳ Time remaining: ${formatTime(timerDuration)}`);
      }

      if (mainSocket && mainSocket.connected) {
        mainSocket.emit('timer-tick', {
          pcId: pcId,
          timeRemaining: timerDuration,
          totalDuration: Math.floor((new Date().getTime() - sessionStartTime!.getTime()) / 1000),
        });
      }

      if (timerDuration % 5 === 0 || timerDuration <= 10) {
        sendTimerToESP32({
          pcId: pcId || 'unknown',
          pcName: process.env.PC_NAME || `PC-${os.hostname()}`,
          timeRemaining: timerDuration,
          totalDuration: validDuration,
          status: 'running',
          userName: userName,
          timestamp: new Date().toISOString(),
        });
      }
    }, 1000);
  } catch (error) {
    console.error(`❌ Failed to start timer: ${error}`);
  }
}

// ✅ SINGLE stopTimer function with ESP32 sync
function stopTimer(userName: string = 'Unknown') {
  try {
    if (!timerActive) {
      console.log(`⚠️  No active timer to stop`);
      return;
    }

    const endTime = new Date();
    const sessionDuration = endTime.getTime() - (sessionStartTime?.getTime() || 0);
    const totalUsedTime = formatTime(Math.floor(sessionDuration / 1000));

    console.log(`\n${'='.repeat(60)}`);
    console.log(`⏹️  TIMER STOPPED`);
    console.log(`${'='.repeat(60)}`);
    console.log(`⏰ End Time: ${endTime.toLocaleTimeString()}`);
    console.log(`👤 User: ${userName}`);
    console.log(`⏱️  Total Session Duration: ${totalUsedTime}`);
    console.log(`${'='.repeat(60)}\n`);

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    timerActive = false;
    timerStartTime = null;
    timerDuration = 0;

    if (mainSocket && mainSocket.connected) {
      mainSocket.emit('session-end', {
        pcId: pcId,
        userName: userName,
        sessionDuration: sessionDuration,
        endTime: endTime.toISOString(),
      });
      
      mainSocket.emit('timer-stopped', {
        pcId: pcId,
      });
      
      console.log(`📡 Session end notification sent to server`);
    }

    sendTimerToESP32({
      pcId: pcId || 'unknown',
      pcName: process.env.PC_NAME || `PC-${os.hostname()}`,
      timeRemaining: 0,
      totalDuration: Math.floor(sessionDuration / 1000),
      status: 'stopped',
      userName: userName,
      timestamp: endTime.toISOString(),
    });

    // ✅ NEW: Auto-logout when timer ends
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚪 AUTO-LOGOUT INITIATED`);
    console.log(`⏰ Time: ${endTime.toLocaleTimeString()}`);
    console.log(`👤 User: ${userName}`);
    console.log(`${'='.repeat(60)}\n`);
    
    setTimeout(() => {
      logoutUser();
    }, 2000); // 2 second delay before logout

    sessionStartTime = null;
  } catch (error) {
    console.error(`❌ Failed to stop timer: ${error}`);
  }
}

// ✅ NEW: Format time helper
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// ✅ NEW: Get timer status
function getTimerStatus() {
  if (!timerActive) {
    return {
      active: false,
      timeRemaining: 0,
      elapsedTime: 0,
    };
  }

  return {
    active: true,
    timeRemaining: timerDuration,
    elapsedTime: sessionStartTime ? Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000) : 0,
    startTime: timerStartTime?.toISOString(),
  };
}

// ✅ NEW: Start collecting and sending metrics
function startMetricsCollection(registeredPcId: string) {
  if (metricsInterval) {
    console.log(`⚠️  Metrics collection already running`);
    return;
  }

  console.log(`📊 Starting metrics collection for PC: ${registeredPcId}`);

  metricsInterval = setInterval(async () => {
    try {
      if (!mainSocket?.connected) {
        console.log(`⚠️  Skipping metrics (server disconnected)`);
        return;
      }

      // Get CPU usage
      const cpuUsage = await si.currentLoad();
      
      // Get memory usage
      const mem = await si.mem();
      const memoryUsage = (mem.used / mem.total) * 100;
      
      // Get disk usage
      const fsSize = await si.fsSize();
      const totalDisk = fsSize.reduce((sum, disk) => sum + disk.size, 0);
      const usedDisk = fsSize.reduce((sum, disk) => sum + disk.used, 0);
      const diskUsage = (usedDisk / totalDisk) * 100;

      // Send metrics to server
      mainSocket.emit('pc-metrics', {
        pcId: registeredPcId,
        cpuUsage: Math.round(cpuUsage.currentLoad * 100) / 100,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        diskUsage: Math.round(diskUsage * 100) / 100,
        timestamp: new Date().toISOString(),
      });

      console.log(`📊 Metrics sent: CPU ${Math.round(cpuUsage.currentLoad * 100) / 100}% | RAM ${Math.round(memoryUsage * 100) / 100}% | DISK ${Math.round(diskUsage * 100) / 100}%`);
    } catch (error) {
      console.error(`❌ Failed to collect metrics: ${error}`);
    }
  }, 5000); // Collect every 5 seconds
}

// ✅ NEW: Stop metrics collection
function stopMetricsCollection() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
    console.log(`⏸️  Metrics collection stopped`);
  }
}

// Connect to main server
function connectToMainServer() {
  mainSocket = ioClient(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  mainSocket.on('connect', () => {
    console.log('✓ Connected to main server');
    isConnected = true;
    connectionAttempts = 0;

    if (pcId) {
      console.log(`🔄 Resuming PC session: ${pcId}`);
      mainSocket.emit('pc-resume', {
        pcId: pcId,
        timestamp: new Date(),
      });
      startMetricsCollection(pcId);
    } else {
      console.log(`🆕 First time connection - registering PC`);
      mainSocket.emit('pc-auto-register', {
        name: process.env.PC_NAME || `PC-${os.hostname()}`,
        location: process.env.PC_LOCATION || 'Auto-detected',
      });
    }
  });

  mainSocket.on('pc-registered', (data: any) => {
    console.log(`✅ PC registered: ${data.pcId}`);
    pcId = data.pcId;
    savePCId(pcId);
    startMetricsCollection(data.pcId);
  });

  // ✅ NEW: Listen for timer start command from server
  mainSocket.on('start-timer', (data: { pcId: string; duration: number; userName: string }) => {
    console.log(`🎯 Received start-timer command`);
    if (data.pcId === pcId) {
      startTimer(data.duration, data.userName);
    }
  });

  // ✅ NEW: Listen for timer stop command from server
  mainSocket.on('stop-timer', (data: { pcId: string; userName?: string }) => {
    console.log(`🎯 Received stop-timer command`);
    if (data.pcId === pcId && timerActive) {
      stopTimer(data.userName || 'Admin');
    }
  });

  // ✅ NEW: Listen for timer status request
  mainSocket.on('get-timer-status', (data: { pcId: string }) => {
    if (data.pcId === pcId) {
      const status = getTimerStatus();
      mainSocket.emit('timer-status-response', { pcId: pcId, ...status });
    }
  });

  mainSocket.on('execute-command', (data: { command: string; params?: any }) => {
    console.log(`🎯 Received command: ${data.command}`);
    handleCommand(data.command, data.params);
  });

  mainSocket.on('disconnect', () => {
    console.log('❌ Disconnected from main server');
    isConnected = false;
    connectionAttempts++;

    if (metricsInterval) {
      console.log(`⏸️  Pausing metrics emission (will resume on reconnect)`);
    }
  });

  mainSocket.on('reconnect_attempt', () => {
    console.log(`🔄 Reconnection attempt #${connectionAttempts}...`);
  });

  mainSocket.on('reconnect_failed', () => {
    console.log(`❌ Failed to reconnect to main server. Retrying...`);
  });

  mainSocket.on('pc-registration-required', () => {
    console.log(`⚠️  Server says PC needs to register again. Clearing stored ID and re-registering...`);
    pcId = null;
    try {
      if (fs.existsSync(PC_ID_FILE)) {
        fs.unlinkSync(PC_ID_FILE);
      }
    } catch (error) {
      console.error(`Failed to delete old PC ID file: ${error}`);
    }
    mainSocket.emit('pc-auto-register', {
      name: process.env.PC_NAME || `PC-${os.hostname()}`,
      location: process.env.PC_LOCATION || 'Auto-detected',
    });
  });
}

// Handle different commands with better logging
function handleCommand(command: string, params?: any) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔴 COMMAND RECEIVED & EXECUTING`);
    console.log(`${'='.repeat(60)}`);
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
    console.log(`💻 Hostname: ${os.hostname()}`);
    console.log(`🖥️  Platform: ${os.platform()}`);
    console.log(`📊 CPU Cores: ${os.cpus().length}`);
    console.log(`🎬 Command: ${command.toUpperCase()}`);
    console.log(`${'='.repeat(60)}\n`);

    switch (command) {
      case 'logout':
        logoutUser();
        break;
      case 'lock-usb':
        lockUSB();
        break;
      case 'unlock-usb':
        unlockUSB();
        break;
      case 'restart':
        restartPC();
        break;
      case 'shutdown':
        shutdownPC();
        break;
      default:
        console.warn(`❌ Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`❌ Failed to execute command: ${error}`);
  }
}

// Logout function - FIXED
function logoutUser() {
  try {
    const platform = os.platform();
    
    console.log(`📌 ACTION: Logging out user`);
    console.log(`⏳ Status: In Progress...`);
    
    if (platform === 'win32') {
      console.log(`🪟 Executing Windows logout command: shutdown /l /f`);
      console.log('👤 Logging out user from Windows...');
      // /l = logoff, /f = force close applications
      execSync('shutdown /l /f', { stdio: 'inherit' });
    } else if (platform === 'darwin') {
      console.log(`🍎 Executing macOS logout command`);
      console.log('👤 Logging out user from macOS...');
      execSync('osascript -e "tell application \\"System Events\\" to log out"', { stdio: 'inherit' });
    } else if (platform === 'linux') {
      console.log(`🐧 Executing Linux logout command: loginctl terminate-user`);
      console.log('👤 Logging out user from Linux...');
      execSync('loginctl terminate-user $USER', { stdio: 'inherit' });
    }
    
    console.log(`✅ SUCCESS: Logout command executed`);
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'logout', status: 'success' });
  } catch (error) {
    console.error(`❌ FAILED: Logout failed`);
    console.error(`📋 Error Details: ${error}`);
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'logout', status: 'failed', error });
  }
}

// ✅ FIXED: Lock USB function - Disable only Keyboard & Mouse in REAL-TIME
function lockUSB() {
  try {
    const platform = os.platform();
    
    console.log(`📌 ACTION: Disabling Keyboard & Mouse Only`);
    console.log(`⏳ Status: In Progress...`);
    
    if (platform === 'win32') {
      // Windows: Disable only Keyboard and Mouse
      console.log(`🪟 Executing Windows USB disable command`);
      console.log(`📋 Command: Disabling Keyboard & Mouse devices only...`);
      
      try {
        // Method 1: Get device IDs and disable immediately
        console.log(`  → Finding and disabling HID Keyboard...`);
        const keyboardDevices = execSync(
          'powershell -Command "Get-PnpDevice -Class Keyboard -Status OK | Select-Object -ExpandProperty InstanceId"',
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim().split('\n').filter((id: string) => id);
        
        for (const deviceId of keyboardDevices) {
          if (deviceId) {
            try {
              execSync(`powershell -Command "Disable-PnpDevice -InstanceId '${deviceId}' -Confirm:$false"`, 
                { stdio: 'inherit' });
              console.log(`    ✓ Disabled: ${deviceId}`);
            } catch (e) {
              console.log(`    ⚠️  Could not disable: ${deviceId}`);
            }
          }
        }
        
        console.log(`  → Finding and disabling HID Mouse...`);
        const mouseDevices = execSync(
          'powershell -Command "Get-PnpDevice -Class Mouse -Status OK | Select-Object -ExpandProperty InstanceId"',
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim().split('\n').filter((id: string) => id);
        
        for (const deviceId of mouseDevices) {
          if (deviceId) {
            try {
              execSync(`powershell -Command "Disable-PnpDevice -InstanceId '${deviceId}' -Confirm:$false"`, 
                { stdio: 'inherit' });
              console.log(`    ✓ Disabled: ${deviceId}`);
            } catch (e) {
              console.log(`    ⚠️  Could not disable: ${deviceId}`);
            }
          }
        }
        
        console.log(`🔴 Keyboard & Mouse disabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse locked in REAL-TIME (no restart needed)`);
      } catch (error) {
        console.log(`⚠️  Method 1 failed. Attempting Method 2: Using WMI Disable...`);
        try {
          // Method 2: Use WMI Disable() method directly
          // ✅ FIXED: Proper quote escaping for WMI filter
          execSync(
            'powershell -Command "Get-WmiObject Win32_PnPDevice -Filter \\"ClassGuid=\'{4D1E55B2-F16F-11CF-88CB-001111000030}\'\\\" | Where-Object {$_.Name -like \'*Keyboard*\'} | ForEach-Object { $_.Disable() }"',
            { stdio: 'inherit' }
          );
          
          execSync(
            'powershell -Command "Get-WmiObject Win32_PnPDevice -Filter \\"ClassGuid=\'{4D1E55B2-F16F-11CF-88CB-001111000030}\'\\\" | Where-Object {$_.Name -like \'*Mouse*\'} | ForEach-Object { $_.Disable() }"',
            { stdio: 'inherit' }
          );
          
          console.log(`✅ SUCCESS: Keyboard & Mouse disabled using WMI (REAL-TIME)`);
        } catch (e) {
          console.error(`❌ Both methods failed. Ensure running as Administrator.`);
          throw e;
        }
      }
    } else if (platform === 'darwin') {
      // macOS: Disable only Keyboard and Mouse (real-time)
      console.log(`🍎 Executing macOS disable command for Keyboard & Mouse`);
      try {
        execSync('sudo launchctl unload /Library/LaunchDaemons/com.apple.iohidevice.plist', { stdio: 'inherit' });
        console.log(`🔴 Keyboard & Mouse disabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse locked in REAL-TIME`);
      } catch (error) {
        console.log(`⚠️  Alternative method...`);
        execSync('sudo defaults write /Library/Preferences/com.apple.iohidevice.plist DisableKeyboardAndMouse -bool true', { stdio: 'inherit' });
        console.log(`✅ SUCCESS: Keyboard & Mouse disabled`);
      }
    } else if (platform === 'linux') {
      // Linux: Disable only Keyboard and Mouse (real-time)
      console.log(`🐧 Executing Linux disable command for Keyboard & Mouse`);
      try {
        execSync('sudo bash -c "xinput disable $(xinput list | grep -i keyboard | awk \'{print $7}\' | sed \'s/id=//\')"', { stdio: 'inherit' });
        execSync('sudo bash -c "xinput disable $(xinput list | grep -i mouse | awk \'{print $7}\' | sed \'s/id=//\')"', { stdio: 'inherit' });
        console.log(`🔴 Keyboard & Mouse disabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse locked in REAL-TIME`);
      } catch (error) {
        console.error(`⚠️  Linux method requires xinput tool`);
        throw error;
      }
    }
    
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'lock-usb', status: 'success' });
  } catch (error) {
    console.error(`❌ FAILED: Keyboard & Mouse lock failed`);
    console.error(`📋 Error Details: ${error}`);
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'lock-usb', status: 'failed', error });
  }
}

// ✅ FIXED: Unlock USB function - Enable only Keyboard & Mouse in REAL-TIME
function unlockUSB() {
  try {
    const platform = os.platform();
    
    console.log(`📌 ACTION: Re-enabling Keyboard & Mouse`);
    console.log(`⏳ Status: In Progress...`);
    
    if (platform === 'win32') {
      // Windows: Re-enable only Keyboard and Mouse
      console.log(`🪟 Executing Windows USB enable command`);
      console.log(`📋 Command: Re-enabling Keyboard & Mouse devices only...`);
      
      try {
        // Method 1: Get device IDs and enable immediately
        console.log(`  → Finding and enabling HID Keyboard...`);
        const keyboardDevices = execSync(
          'powershell -Command "Get-PnpDevice -Class Keyboard -Status Error | Select-Object -ExpandProperty InstanceId"',
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim().split('\n').filter((id: string) => id);
        
        for (const deviceId of keyboardDevices) {
          if (deviceId) {
            try {
              execSync(`powershell -Command "Enable-PnpDevice -InstanceId '${deviceId}' -Confirm:$false"`, 
                { stdio: 'inherit' });
              console.log(`    ✓ Enabled: ${deviceId}`);
            } catch (e) {
              console.log(`    ⚠️  Could not enable: ${deviceId}`);
            }
          }
        }
        
        console.log(`  → Finding and enabling HID Mouse...`);
        const mouseDevices = execSync(
          'powershell -Command "Get-PnpDevice -Class Mouse -Status Error | Select-Object -ExpandProperty InstanceId"',
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim().split('\n').filter((id: string) => id);
        
        for (const deviceId of mouseDevices) {
          if (deviceId) {
            try {
              execSync(`powershell -Command "Enable-PnpDevice -InstanceId '${deviceId}' -Confirm:$false"`, 
                { stdio: 'inherit' });
              console.log(`    ✓ Enabled: ${deviceId}`);
            } catch (e) {
              console.log(`    ⚠️  Could not enable: ${deviceId}`);
            }
          }
        }
        
        console.log(`🟢 Keyboard & Mouse re-enabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse unlocked in REAL-TIME (no restart needed)`);
      } catch (error) {
        console.log(`⚠️  Method 1 failed. Attempting Method 2: Using WMI Enable...`);
        try {
          // Method 2: Use WMI Enable() method directly
          // ✅ FIXED: Proper quote escaping for WMI filter
          execSync(
            'powershell -Command "Get-WmiObject Win32_PnPDevice -Filter \\"ClassGuid=\'{4D1E55B2-F16F-11CF-88CB-001111000030}\'\\\" | Where-Object {$_.Name -like \'*Keyboard*\'} | ForEach-Object { $_.Enable() }"',
            { stdio: 'inherit' }
          );
          
          execSync(
            'powershell -Command "Get-WmiObject Win32_PnPDevice -Filter \\"ClassGuid=\'{4D1E55B2-F16F-11CF-88CB-001111000030}\'\\\" | Where-Object {$_.Name -like \'*Mouse*\'} | ForEach-Object { $_.Enable() }"',
            { stdio: 'inherit' }
          );
          
          console.log(`✅ SUCCESS: Keyboard & Mouse enabled using WMI (REAL-TIME)`);
        } catch (e) {
          console.error(`❌ Both methods failed. Ensure running as Administrator.`);
          throw e;
        }
      }
    } else if (platform === 'darwin') {
      // macOS: Re-enable only Keyboard and Mouse (real-time)
      console.log(`🍎 Executing macOS enable command for Keyboard & Mouse`);
      try {
        execSync('sudo launchctl load /Library/LaunchDaemons/com.apple.iohidevice.plist', { stdio: 'inherit' });
        console.log(`🟢 Keyboard & Mouse re-enabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse unlocked in REAL-TIME`);
      } catch (error) {
        console.log(`⚠️  Alternative method...`);
        execSync('sudo defaults delete /Library/Preferences/com.apple.iohidevice.plist DisableKeyboardAndMouse', { stdio: 'inherit' });
        console.log(`✅ SUCCESS: Keyboard & Mouse enabled`);
      }
    } else if (platform === 'linux') {
      // Linux: Re-enable only Keyboard and Mouse (real-time)
      console.log(`🐧 Executing Linux enable command for Keyboard & Mouse`);
      try {
        execSync('sudo bash -c "xinput enable $(xinput list | grep -i keyboard | awk \'{print $7}\' | sed \'s/id=//\')"', { stdio: 'inherit' });
        execSync('sudo bash -c "xinput enable $(xinput list | grep -i mouse | awk \'{print $7}\' | sed \'s/id=//\')"', { stdio: 'inherit' });
        console.log(`🟢 Keyboard & Mouse re-enabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse unlocked in REAL-TIME`);
      } catch (error) {
        console.error(`⚠️  Linux method requires xinput tool`);
        throw error;
      }
    }
    
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'unlock-usb', status: 'success' });
  } catch (error) {
    console.error(`❌ FAILED: Keyboard & Mouse unlock failed`);
    console.error(`📋 Error Details: ${error}`);
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'unlock-usb', status: 'failed', error });
  }
}

// Restart PC function - KEPT
function restartPC() {
  try {
    const platform = os.platform();
    
    console.log(`📌 ACTION: Restarting PC`);
    console.log(`⏳ Status: In Progress...`);
    console.log(`⚠️  WARNING: System will restart in 10 seconds!`);
    
    if (platform === 'win32') {
      console.log(`🪟 Executing Windows restart command: shutdown /r /t 10`);
      console.log('🔄 Restarting PC (Windows)...');
      execSync('shutdown /r /t 10', { stdio: 'inherit' });
    } else if (platform === 'darwin') {
      console.log(`🍎 Executing macOS restart command`);
      console.log('🔄 Restarting PC (macOS)...');
      execSync('osascript -e "tell application \\"System Events\\" to restart"', { stdio: 'inherit' });
    } else if (platform === 'linux') {
      console.log(`🐧 Executing Linux restart command: sudo shutdown -r +1`);
      console.log('🔄 Restarting PC (Linux)...');
      execSync('sudo shutdown -r +1', { stdio: 'inherit' });
    }
    
    console.log(`✅ SUCCESS: Restart command executed`);
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'restart', status: 'success' });
  } catch (error) {
    console.error(`❌ FAILED: Restart failed`);
    console.error(`📋 Error Details: ${error}`);
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'restart', status: 'failed', error });
  }
}

// Shutdown PC function - KEPT
function shutdownPC() {
  try {
    const platform = os.platform();
    
    console.log(`📌 ACTION: Shutting down PC`);
    console.log(`⏳ Status: In Progress...`);
    console.log(`⚠️  WARNING: System will shutdown in 10 seconds!`);
    
    if (platform === 'win32') {
      console.log(`🪟 Executing Windows shutdown command: shutdown /s /t 10`);
      console.log('⏹️ Shutting down PC (Windows)...');
      execSync('shutdown /s /t 10', { stdio: 'inherit' });
    } else if (platform === 'darwin') {
      console.log(`🍎 Executing macOS shutdown command`);
      console.log('⏹️ Shutting down PC (macOS)...');
      execSync('osascript -e "tell application \\"System Events\\" to shut down"', { stdio: 'inherit' });
    } else if (platform === 'linux') {
      console.log(`🐧 Executing Linux shutdown command: sudo shutdown -h +1`);
      console.log('⏹️ Shutting down PC (Linux)...');
      execSync('sudo shutdown -h +1', { stdio: 'inherit' });
    }
    
    console.log(`✅ SUCCESS: Shutdown command executed`);
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'shutdown', status: 'success' });
  } catch (error) {
    console.error(`❌ FAILED: Shutdown failed`);
    console.error(`📋 Error Details: ${error}`);
    console.log(`${'='.repeat(60)}\n`);
    mainSocket.emit('command-executed', { command: 'shutdown', status: 'failed', error });
  }
}

// ✅ NEW: Graceful shutdown handler
function gracefulShutdown() {
  console.log('\n📴 Shutting down PC Client gracefully...');
  
  // Stop timer if active
  if (timerActive) {
    stopTimer('System Shutdown');
  }
  
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }
  if (mainSocket) {
    mainSocket.disconnect();
  }
  httpServer.close(() => {
    console.log('✅ PC Client closed');
    process.exit(0);
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ✅ NEW: Initialize config and start PC client
initializeConfig();
connectToMainServer();

const PORT = process.env.PC_PORT || 5001;
httpServer.listen(PORT, () => {
  console.log(`🖥️ PC Client running on port ${PORT}`);
  console.log(`📡 Connecting to main server: http://localhost:5000`);
  console.log(`\n✅ Available Endpoints:`);
  console.log(`   POST   http://localhost:${PORT}/api/timer/start - Start timer`);
  console.log(`   POST   http://localhost:${PORT}/api/timer/stop - Stop timer`);
  console.log(`   GET    http://localhost:${PORT}/api/timer/status - Get timer status`);
  console.log(`   GET    http://localhost:${PORT}/api/pc/info - Get PC info`);
  console.log(`   GET    http://localhost:${PORT}/api/health - Health check\n`);
  if (pcId) {
    console.log(`🔄 Will resume with PC ID: ${pcId}`);
  }
});
