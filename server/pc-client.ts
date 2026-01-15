import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';  // ← ADD THIS IMPORT
import si from 'systeminformation';
import os from 'os';

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {});

const SERVER_URL = process.env.MAIN_SERVER_URL || 'http://localhost:5000';

let metricsInterval: NodeJS.Timeout | null = null;
let mainSocket: any = null;

// Connect to main server
function connectToMainServer() {
  mainSocket = ioClient(SERVER_URL, {  // ← REMOVE require(), use imported ioClient
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
  });

  mainSocket.on('connect', () => {
    console.log('✓ Connected to main server');
    
    // Auto-register this PC
    mainSocket.emit('pc-auto-register', {
      name: process.env.PC_NAME || `PC-${os.hostname()}`,
      location: process.env.PC_LOCATION || 'Auto-detected',
    });
  });

  mainSocket.on('pc-registered', (data: any) => {
    console.log(`✅ PC registered: ${data.pcId}`);
    startMetricsCollection(data.pcId);
  });

  mainSocket.on('disconnect', () => {
    console.log('❌ Disconnected from main server');
    if (metricsInterval) clearInterval(metricsInterval);
  });
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