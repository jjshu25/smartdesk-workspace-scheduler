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

// Logout function
function logoutUser() {
  try {
    const platform = os.platform();
    
    console.log(`📌 ACTION: Logging out user`);
    console.log(`⏳ Status: In Progress...`);
    
    if (platform === 'win32') {
      console.log(`🪟 Executing Windows logout command: shutdown /l /t 0`);
      console.log('👤 Logging out user from Windows...');
      execSync('shutdown /l /t 0', { stdio: 'inherit' });
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

// Restart PC function
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

// Shutdown PC function
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
