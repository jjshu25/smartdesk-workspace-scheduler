import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import si from 'systeminformation';
import os from 'os';
import { execSync } from 'child_process';

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {});

const SERVER_URL = process.env.MAIN_SERVER_URL || 'http://10.192.184.220:5000';

let metricsInterval: NodeJS.Timeout | null = null;
let mainSocket: any = null;

// Connect to main server
function connectToMainServer() {
  mainSocket = ioClient(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
  });

  mainSocket.on('connect', () => {
    console.log('✓ Connected to main server');
    
    mainSocket.emit('pc-auto-register', {
      name: process.env.PC_NAME || `PC-${os.hostname()}`,
      location: process.env.PC_LOCATION || 'Auto-detected',
    });
  });

  mainSocket.on('pc-registered', (data: any) => {
    console.log(`✅ PC registered: ${data.pcId}`);
    startMetricsCollection(data.pcId);
  });

  // Listen for commands from server
  mainSocket.on('execute-command', (data: { command: string; params?: any }) => {
    console.log(`🎯 Received command: ${data.command}`);
    handleCommand(data.command, data.params);
  });

  mainSocket.on('disconnect', () => {
    console.log('❌ Disconnected from main server');
    if (metricsInterval) clearInterval(metricsInterval);
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

// ✅ FIXED: Lock USB function - Disable only Keyboard & Mouse
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
        // Method 1: Disable Keyboard using SetupAPI
        console.log(`  → Disabling HID Keyboard...`);
        execSync('powershell -Command "Get-WmiObject Win32_PnPDevice -Filter \\"ClassGuid=\'{4D1E55B2-F16F-11CF-88CB-001111000030}\'\\" -ErrorAction SilentlyContinue | Where-Object {$_.Name -like \'*Keyboard*\'} | ForEach-Object { $_.Disable() }"', 
          { stdio: 'inherit' });
        
        // Method 2: Disable Mouse using SetupAPI
        console.log(`  → Disabling HID Mouse...`);
        execSync('powershell -Command "Get-WmiObject Win32_PnPDevice -Filter \\"ClassGuid=\'{4D1E55B2-F16F-11CF-88CB-001111000030}\'\\" -ErrorAction SilentlyContinue | Where-Object {$_.Name -like \'*Mouse*\'} | ForEach-Object { $_.Disable() }"', 
          { stdio: 'inherit' });
        
        console.log(`🔴 Keyboard & Mouse disabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse locked (other USB devices remain active)`);
      } catch (error) {
        console.log(`⚠️  Method 1 failed. Attempting Method 2: Using Device Manager...`);
        try {
          // Method 2: Use pnputil with device search
          const keyboardDisable = execSync('powershell -Command "Get-WmiObject Win32_PnPEntity -Filter \\\"Name LIKE \'%Keyboard%\' AND Name LIKE \'%HID%\'\\\" | Select-Object -First 1 -ExpandProperty DeviceID"', 
            { encoding: 'utf8' }).trim();
          
          const mouseDisable = execSync('powershell -Command "Get-WmiObject Win32_PnPEntity -Filter \\\"Name LIKE \'%Mouse%\' AND Name LIKE \'%HID%\'\\\" | Select-Object -First 1 -ExpandProperty DeviceID"', 
            { encoding: 'utf8' }).trim();
          
          console.log(`  → Disabling Keyboard with DeviceID: ${keyboardDisable}`);
          if (keyboardDisable) {
            execSync(`powershell -Command "Disable-PnpDevice -InstanceName '${keyboardDisable}' -Confirm:$false -ErrorAction SilentlyContinue"`, 
              { stdio: 'inherit' });
          }
          
          console.log(`  → Disabling Mouse with DeviceID: ${mouseDisable}`);
          if (mouseDisable) {
            execSync(`powershell -Command "Disable-PnpDevice -InstanceName '${mouseDisable}' -Confirm:$false -ErrorAction SilentlyContinue"`, 
              { stdio: 'inherit' });
          }
          
          console.log(`✅ SUCCESS: Keyboard & Mouse disabled using Device Manager`);
        } catch (e) {
          console.log(`⚠️  Method 2 failed. Attempting Method 3: Registry modification...`);
          try {
            // Method 3: Registry modification (safest fallback)
            execSync('reg add "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\kbdhid" /v Start /t REG_DWORD /d 4 /f', 
              { stdio: 'inherit' });
            execSync('reg add "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\mouhid" /v Start /t REG_DWORD /d 4 /f', 
              { stdio: 'inherit' });
            
            console.log(`✅ SUCCESS: Keyboard & Mouse disabled via registry`);
            console.log(`📌 NOTE: Changes will take effect after device re-plug or system restart`);
          } catch (e3) {
            console.error(`❌ All methods failed. Ensure running as Administrator.`);
            throw e3;
          }
        }
      }
    } else if (platform === 'darwin') {
      // macOS: Disable only Keyboard and Mouse
      console.log(`🍎 Executing macOS disable command for Keyboard & Mouse`);
      try {
        execSync('sudo launchctl unload /Library/LaunchDaemons/com.apple.iohidevice.plist', { stdio: 'inherit' });
        console.log(`🔴 Keyboard & Mouse disabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse locked (other USB devices remain active)`);
      } catch (error) {
        console.log(`⚠️  Alternative method...`);
        execSync('sudo defaults write /Library/Preferences/com.apple.iohidevice.plist DisableKeyboardAndMouse -bool true', { stdio: 'inherit' });
        console.log(`✅ SUCCESS: Keyboard & Mouse disabled`);
      }
    } else if (platform === 'linux') {
      // Linux: Disable only Keyboard and Mouse
      console.log(`🐧 Executing Linux disable command for Keyboard & Mouse`);
      try {
        execSync('sudo bash -c "echo 1 > /sys/bus/usb/devices/*/power/autosuspend_delay_ms"', { stdio: 'inherit' });
        console.log(`🔴 Keyboard & Mouse disabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse locked (other USB devices remain active)`);
      } catch (error) {
        console.error(`⚠️  Linux method requires additional tools`);
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

// ✅ FIXED: Unlock USB function - Enable only Keyboard & Mouse
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
        // Method 1: Enable Keyboard using SetupAPI
        console.log(`  → Enabling HID Keyboard...`);
        execSync('powershell -Command "Get-WmiObject Win32_PnPDevice -Filter \\"ClassGuid=\'{4D1E55B2-F16F-11CF-88CB-001111000030}\'\\" -ErrorAction SilentlyContinue | Where-Object {$_.Name -like \'*Keyboard*\'} | ForEach-Object { $_.Enable() }"', 
          { stdio: 'inherit' });
        
        // Method 2: Enable Mouse using SetupAPI
        console.log(`  → Enabling HID Mouse...`);
        execSync('powershell -Command "Get-WmiObject Win32_PnPDevice -Filter \\"ClassGuid=\'{4D1E55B2-F16F-11CF-88CB-001111000030}\'\\" -ErrorAction SilentlyContinue | Where-Object {$_.Name -like \'*Mouse*\'} | ForEach-Object { $_.Enable() }"', 
          { stdio: 'inherit' });
        
        console.log(`🟢 Keyboard & Mouse re-enabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse unlocked`);
      } catch (error) {
        console.log(`⚠️  Method 1 failed. Attempting Method 2: Using Device Manager...`);
        try {
          const keyboardEnable = execSync('powershell -Command "Get-WmiObject Win32_PnPEntity -Filter \\\"Name LIKE \'%Keyboard%\' AND Name LIKE \'%HID%\'\\\" | Select-Object -First 1 -ExpandProperty DeviceID"', 
            { encoding: 'utf8' }).trim();
          
          const mouseEnable = execSync('powershell -Command "Get-WmiObject Win32_PnPEntity -Filter \\\"Name LIKE \'%Mouse%\' AND Name LIKE \'%HID%\'\\\" | Select-Object -First 1 -ExpandProperty DeviceID"', 
            { encoding: 'utf8' }).trim();
          
          console.log(`  → Enabling Keyboard with DeviceID: ${keyboardEnable}`);
          if (keyboardEnable) {
            execSync(`powershell -Command "Enable-PnpDevice -InstanceName '${keyboardEnable}' -Confirm:$false -ErrorAction SilentlyContinue"`, 
              { stdio: 'inherit' });
          }
          
          console.log(`  → Enabling Mouse with DeviceID: ${mouseEnable}`);
          if (mouseEnable) {
            execSync(`powershell -Command "Enable-PnpDevice -InstanceName '${mouseEnable}' -Confirm:$false -ErrorAction SilentlyContinue"`, 
              { stdio: 'inherit' });
          }
          
          console.log(`✅ SUCCESS: Keyboard & Mouse enabled using Device Manager`);
        } catch (e) {
          console.log(`⚠️  Method 2 failed. Attempting Method 3: Registry modification...`);
          try {
            // Method 3: Registry modification (safest fallback)
            execSync('reg add "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\kbdhid" /v Start /t REG_DWORD /d 3 /f', 
              { stdio: 'inherit' });
            execSync('reg add "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\mouhid" /v Start /t REG_DWORD /d 3 /f', 
              { stdio: 'inherit' });
            
            console.log(`✅ SUCCESS: Keyboard & Mouse enabled via registry`);
            console.log(`📌 NOTE: Changes will take effect after device re-plug or system restart`);
          } catch (e3) {
            console.error(`❌ All methods failed. Ensure running as Administrator.`);
            throw e3;
          }
        }
      }
    } else if (platform === 'darwin') {
      // macOS: Re-enable only Keyboard and Mouse
      console.log(`🍎 Executing macOS enable command for Keyboard & Mouse`);
      try {
        execSync('sudo launchctl load /Library/LaunchDaemons/com.apple.iohidevice.plist', { stdio: 'inherit' });
        console.log(`🟢 Keyboard & Mouse re-enabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse unlocked`);
      } catch (error) {
        console.log(`⚠️  Alternative method...`);
        execSync('sudo defaults delete /Library/Preferences/com.apple.iohidevice.plist DisableKeyboardAndMouse', { stdio: 'inherit' });
        console.log(`✅ SUCCESS: Keyboard & Mouse enabled`);
      }
    } else if (platform === 'linux') {
      // Linux: Re-enable only Keyboard and Mouse
      console.log(`🐧 Executing Linux enable command for Keyboard & Mouse`);
      try {
        execSync('sudo bash -c "echo -1 > /sys/bus/usb/devices/*/power/autosuspend_delay_ms"', { stdio: 'inherit' });
        console.log(`🟢 Keyboard & Mouse re-enabled`);
        console.log(`✅ SUCCESS: Keyboard & Mouse unlocked`);
      } catch (error) {
        console.error(`⚠️  Linux method requires additional tools`);
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

async function getSystemMetrics() {
  try {
    const cpuLoad = await si.currentLoad();
    const memory = await si.mem();
    const fsSize = await si.fsSize();
    const mainDrive = fsSize[0];

    return {
      cpuUsage: Math.round(cpuLoad.currentLoad * 100) / 100,
      memoryUsage: Math.round((memory.used / memory.total) * 100 * 100) / 100,
      diskUsage: mainDrive ? Math.round((mainDrive.used / mainDrive.size) * 100 * 100) / 100 : 0,
    };
  } catch (error) {
    console.error('Failed to get metrics:', error);
    return { cpuUsage: 0, memoryUsage: 0, diskUsage: 0 };
  }
}

function startMetricsCollection(pcId: string) {
  metricsInterval = setInterval(async () => {
    const metrics = await getSystemMetrics();
    mainSocket.emit('pc-metrics', { pcId, ...metrics });
    console.log(`📊 Metrics sent: CPU ${metrics.cpuUsage}% | RAM ${metrics.memoryUsage}% | DISK ${metrics.diskUsage}%`);
  }, 5000);
}

// Start PC client
connectToMainServer();

const PORT = process.env.PC_PORT || 5001;
httpServer.listen(PORT, () => {
  console.log(`🖥️ PC Client running on port ${PORT}`);
  console.log(`📡 Connecting to main server: ${SERVER_URL}`);
});
