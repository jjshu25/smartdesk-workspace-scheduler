import express, { type Express, type Request, type Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

// Configure CORS for Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// In-memory store for connected PCs
interface ConnectedPC {
  id: string;
  socketId: string;
  name: string;
  location: string;
  ipAddress: string;
  macAddress: string;
  osType: string;
  osVersion: string;
  status: 'online' | 'offline' | 'in-use';
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  currentUser?: string;
  sessionStartTime?: Date;
  lastActive: Date;
  bootTime?: Date;
  autoDetected: boolean;
}

const connectedPCs = new Map<string, ConnectedPC>();

// Helper function to get local IP
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Helper function to generate unique PC ID
function generatePCId(): string {
  return `PC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Socket.IO Events
io.on('connection', (socket) => {
  console.log(`\n🔗 New connection attempt: ${socket.id}`);
  console.log(`📍 Client IP: ${socket.handshake.address}`);

  // Auto-detect PC on connection
  socket.on('pc-auto-register', (data?: { name?: string; location?: string }) => {
    const pcId = generatePCId();
    const ipAddress = socket.handshake.address || '127.0.0.1';
    
    const pc: ConnectedPC = {
      id: pcId,
      socketId: socket.id,
      name: data?.name || `PC-${pcId.split('-')[1]}`,
      location: data?.location || 'Auto-detected',
      ipAddress,
      macAddress: os.networkInterfaces().eth0?.[0]?.mac || 'N/A',
      osType: os.type(),
      osVersion: os.release(),
      status: 'online',
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      lastActive: new Date(),
      bootTime: new Date(Date.now() - os.uptime() * 1000),
      autoDetected: true,
    };

    connectedPCs.set(pcId, pc);
    socket.join(`pc-${pcId}`);
    
    console.log(`✅ PC Auto-registered: ${pc.name}`);
    console.log(`   ID: ${pcId}`);
    console.log(`   IP: ${ipAddress}`);
    console.log(`   OS: ${pc.osType} ${pc.osVersion}\n`);

    // Send confirmation to PC
    socket.emit('pc-registered', { pcId, name: pc.name });

    // Broadcast to all admin dashboards
    io.emit('pc-list-updated', Array.from(connectedPCs.values()));
  });

  // Manual PC registration (fallback)
  socket.on('pc-register', (data: { pcId?: string; name: string; location: string; ipAddress?: string }) => {
    const pcId = data.pcId || generatePCId();
    const ipAddress = data.ipAddress || socket.handshake.address || '127.0.0.1';

    const pc: ConnectedPC = {
      id: pcId,
      socketId: socket.id,
      name: data.name,
      location: data.location,
      ipAddress,
      macAddress: 'N/A',
      osType: os.type(),
      osVersion: os.release(),
      status: 'online',
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      lastActive: new Date(),
      bootTime: new Date(),
      autoDetected: false,
    };

    connectedPCs.set(pcId, pc);
    socket.join(`pc-${pcId}`);

    console.log(`✅ PC Registered: ${data.name}`);
    io.emit('pc-list-updated', Array.from(connectedPCs.values()));
    socket.emit('pc-registered', { pcId });
  });

  // Receive metrics from PC
  socket.on('pc-metrics', (data: { pcId: string; cpuUsage: number; memoryUsage: number; diskUsage: number }) => {
    const pc = connectedPCs.get(data.pcId);
    if (pc) {
      pc.cpuUsage = data.cpuUsage;
      pc.memoryUsage = data.memoryUsage;
      pc.diskUsage = data.diskUsage;
      pc.lastActive = new Date();
      io.emit('pc-updated', pc);
    }
  });

  // Send command to PC
  socket.on('send-command', (data: { pcId: string; command: string; params?: any }) => {
    console.log(`📤 Command: ${data.command} → ${data.pcId}`);
    io.to(`pc-${data.pcId}`).emit('execute-command', { 
      command: data.command, 
      params: data.params,
      timestamp: new Date(),
    });
  });

  // Lock PC
  socket.on('lock-pc', (data: { pcId: string }) => {
    console.log(`🔒 Locking: ${data.pcId}`);
    io.to(`pc-${data.pcId}`).emit('lock-screen');
  });

  // Session started
  socket.on('session-start', (data: { pcId: string; userName: string; startTime: string }) => {
    const pc = connectedPCs.get(data.pcId);
    if (pc) {
      pc.currentUser = data.userName;
      pc.status = 'in-use';
      pc.sessionStartTime = new Date();
      io.emit('pc-updated', pc);
      console.log(`👤 Session: ${data.userName} on ${pc.name}`);
    }
  });

  // Session ended
  socket.on('session-end', (data: { pcId: string; sessionDuration: number }) => {
    const pc = connectedPCs.get(data.pcId);
    if (pc) {
      pc.currentUser = undefined;
      pc.status = 'online';
      pc.sessionStartTime = undefined;
      io.emit('pc-updated', pc);
      console.log(`⏱️ Session ended: ${pc.name} (${data.sessionDuration}ms)`);
    }
  });

  socket.on('disconnect', () => {
    let disconnectedPC: string | null = null;
    connectedPCs.forEach((pc, key) => {
      if (pc.socketId === socket.id) {
        disconnectedPC = key;
      }
    });

    if (disconnectedPC) {
      const pc = connectedPCs.get(disconnectedPC);
      connectedPCs.delete(disconnectedPC);
      io.emit('pc-list-updated', Array.from(connectedPCs.values()));
      console.log(`❌ PC Disconnected: ${pc?.name}`);
    }
  });

  socket.on('error', (error) => {
    console.error(`⚠️ Socket error: ${error}`);
  });
});

// REST API Endpoints
app.get('/api/pcs', (req: Request, res: Response) => {
  res.json(Array.from(connectedPCs.values()));
});

app.get('/api/pc/:pcId', (req: Request, res: Response) => {
  const pc = connectedPCs.get(req.params.pcId);
  if (pc) {
    res.json(pc);
  } else {
    res.status(404).json({ error: 'PC not found' });
  }
});

app.post('/api/command', (req: Request, res: Response) => {
  const { pcId, command, params } = req.body;

  if (!pcId || !command) {
    res.status(400).json({ error: 'Missing pcId or command' });
    return;
  }

  io.to(`pc-${pcId}`).emit('execute-command', { command, params });
  res.json({ success: true, message: 'Command sent', pcId, command });
});

// Send command to specific PC
app.post('/api/pc/:pcId/command', (req: Request, res: Response) => {
  const { pcId } = req.params;
  const { command } = req.body;

  const pc = connectedPCs.get(pcId);
  if (!pc) {
    console.error(`❌ Command failed: PC ${pcId} not found`);
    return res.status(404).json({ error: 'PC not found' });
  }

  // ✅ DETAILED LOGGING
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 COMMAND REQUESTED FROM DASHBOARD`);
  console.log(`${'='.repeat(60)}`);
  console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
  console.log(`🖥️  Target PC: ${pc.name} (${pcId})`);
  console.log(`📍 Location: ${pc.location}`);
  console.log(`💻 OS: ${pc.osType} ${pc.osVersion}`);
  console.log(`🌐 IP Address: ${pc.ipAddress}`);
  console.log(`📊 Current Status: ${pc.status}`);
  console.log(`🎬 Command: ${command.toUpperCase()}`);
  
  // ✅ ADD THIS: Special logging for USB commands
  if (command === 'lock-usb') {
    console.log(`⚠️  ACTION: Disabling USB Hub (Keyboard, Mouse, USB Devices)`);
    console.log(`💡 Monitor will remain functional`);
  } else if (command === 'unlock-usb') {
    console.log(`✅ ACTION: Re-enabling USB Hub`);
  }
  
  console.log(`${'='.repeat(60)}\n`);

  // Send command to PC via Socket.IO
  io.to(`pc-${pcId}`).emit('execute-command', { command });

  console.log(`📡 Command emitted to Socket.IO room: pc-${pcId}`);

  res.json({ 
    success: true, 
    message: `Command '${command}' sent to ${pc.name}` 
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date(),
    connectedPCs: connectedPCs.size,
    allowedOrigins,
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Internet Café Server is running',
    timestamp: new Date(),
    connectedPCs: connectedPCs.size,
    version: '1.0.0',
  });
});

// Handle OPTIONS requests
app.options('*', cors());

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Internet Café Server running on http://localhost:${PORT}`);
  console.log(`✓ Socket.IO endpoint: ws://localhost:${PORT}`);
  console.log(`✓ CORS enabled`);
  console.log(`✓ Waiting for PC connections...\n`);
});