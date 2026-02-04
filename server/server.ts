import express, { type Express, type Request, type Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import { initializeDatabase } from './database/db.js';
import { SessionRepository, type SessionLog as DBSessionLog } from './services/sessionRepository.js';

dotenv.config();

// Initialize database
initializeDatabase();

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
  lastDisconnected?: Date;
  bootTime?: Date;
  autoDetected: boolean;
}

const connectedPCs = new Map<string, ConnectedPC>();

// ✅ NEW: Track timer state for each PC
interface PCTimer {
  active: boolean;
  timeRemaining: number;
  startTime: Date;
  totalDuration: number;
}

const pcTimers = new Map<string, PCTimer>();

// Database session management - SessionLog type imported from repository

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

  // ✅ NEW: Handle PC resume on reconnection
  socket.on('pc-resume', (data: { pcId: string; timestamp: string }) => {
    const pc = connectedPCs.get(data.pcId);
    
    if (pc) {
      // ✅ FIXED: PC found - update it
      console.log(`✅ PC resumed: ${data.pcId}`);
      pc.lastActive = new Date();
      pc.socketId = socket.id;
      
      socket.emit('pc-resumed', {
        pcId: data.pcId,
        message: 'PC session resumed successfully',
      });
      
      io.emit('pc-updated', pc);
      console.log(`📡 Broadcasting PC update after resume`);
    } else {
      // ✅ FIXED: PC not found - send failure event
      console.log(`⚠️  PC Resume failed: ${data.pcId} not found`);
      
      socket.emit('pc-resume-failed', {
        pcId: data.pcId,
        message: 'PC not found in registry. Please re-register.',
      });
      
      console.log(`🔄 Requesting client to re-register...`);
    }
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
      // ✅ CHANGED: Ensure status stays 'online' when receiving metrics
      if (pc.status === 'offline') {
        pc.status = 'online';
        console.log(`🟢 PC came back online: ${pc.name}`);
      }
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
  socket.on('session-start', (data: { pcId: string; userName: string; startTime: string; allocatedDuration?: number }) => {
    const pc = connectedPCs.get(data.pcId);
    if (pc) {
      pc.currentUser = data.userName;
      pc.status = 'in-use';
      pc.sessionStartTime = new Date();
      
      // ✅ NEW: Create session log entry in database
      const sessionId = `SESSION-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const sessionLog: DBSessionLog = {
        id: sessionId,
        pcId: data.pcId,
        pcName: pc.name,
        userName: data.userName,
        connectedAt: new Date(),
        sessionDuration: 0,
        allocatedDuration: data.allocatedDuration || 0,
        status: 'active',
        deskId: data.pcId,
      };

      try {
        SessionRepository.createSession(sessionLog);
        console.log(`👤 Session: ${data.userName} on ${pc.name}`);
        console.log(`📝 Session ID: ${sessionId}`);
      } catch (error) {
        console.error(`❌ Failed to create session: ${error}`);
      }

      io.emit('pc-updated', pc);
      io.emit('session-logged', sessionLog);
    }
  });

  // Session ended
  socket.on('session-end', (data: { pcId: string; sessionDuration: number }) => {
    const pc = connectedPCs.get(data.pcId);
    if (pc) {
      pc.currentUser = undefined;
      pc.status = 'online';
      pc.sessionStartTime = undefined;

      // ✅ NEW: Update session log entry in database
      const activeSessions = SessionRepository.getSessions({
        pcId: data.pcId,
        status: 'active',
        limit: 1,
      });

      if (activeSessions.length > 0) {
        const lastSession = activeSessions[0];
        const updatedSession = SessionRepository.endSession(lastSession.id, data.sessionDuration);

        console.log(`⏱️ Session ended: ${pc.name} (${data.sessionDuration}ms)`);
        console.log(`📝 Session: ${lastSession.id}`);

        if (updatedSession) {
          io.emit('session-logged', updatedSession);
        }
      }

      io.emit('pc-updated', pc);
    }
  });

  // ✅ NEW: Listen for timer updates from PC
  socket.on('timer-tick', (data: { pcId: string; timeRemaining: number; totalDuration: number }) => {
    const pc = connectedPCs.get(data.pcId);
    if (pc) {
      // Update server-side timer tracking
      pcTimers.set(data.pcId, {
        active: true,
        timeRemaining: data.timeRemaining,
        startTime: new Date(Date.now() - (data.totalDuration * 1000)),
        totalDuration: data.totalDuration,
      });

      // Broadcast timer update to all dashboards
      io.emit('pc-timer-updated', {
        pcId: data.pcId,
        timeRemaining: data.timeRemaining,
        active: true,
      });
    }
  });

  // ✅ NEW: Listen for timer stop from PC
  socket.on('timer-stopped', (data: { pcId: string }) => {
    const pc = connectedPCs.get(data.pcId);
    if (pc) {
      pcTimers.delete(data.pcId);
      
      // Update PC status back to online if timer was in-use
      if (pc.status === 'in-use') {
        pc.status = 'online';
      }

      // Broadcast timer stop to all dashboards
      io.emit('pc-timer-updated', {
        pcId: data.pcId,
        timeRemaining: 0,
        active: false,
      });

      io.emit('pc-updated', pc);
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
      if (pc) {
        pc.status = 'offline';
        pc.lastDisconnected = new Date();
        pcTimers.delete(disconnectedPC); // ✅ NEW: Clear timer if PC disconnects
        console.log(`⚠️  PC Disconnected (Offline): ${pc.name}`);
        console.log(`   Will stay in dashboard until it reconnects or times out`);
        
        io.emit('pc-list-updated', Array.from(connectedPCs.values()));
        io.emit('pc-updated', pc);
      }
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

// ✅ UPDATED: Start timer for PC via server relay
app.post('/api/pc/:pcId/timer/start', (req: Request, res: Response) => {
  const { pcId } = req.params;
  const { duration, userName } = req.body;

  const pc = connectedPCs.get(pcId);
  if (!pc) {
    console.error(`❌ Timer Start Failed: PC ${pcId} not found`);
    return res.status(404).json({ error: 'PC not found' });
  }

  // ✅ FIX: Validate duration properly
  const validDuration = Math.max(parseInt(String(duration), 10), 1);
  
  if (!validDuration || validDuration <= 0) {
    return res.status(400).json({ error: 'Invalid duration - must be greater than 0' });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`⏱️  TIMER START REQUEST (via Server)`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🖥️  PC: ${pc.name} (${pcId})`);
  console.log(`📍 Location: ${pc.location}`);
  console.log(`🌐 IP: ${pc.ipAddress}`);
  console.log(`⏳ Duration: ${validDuration} seconds`); // ✅ Log actual duration
  console.log(`⏳ Formatted: ${formatTime(validDuration)}`); // ✅ Log formatted time
  console.log(`👤 User: ${userName}`);
  console.log(`📊 PC Status: ${pc.status}`);
  console.log(`${'='.repeat(60)}\n`);

  // Send start-timer event to PC via Socket.IO
  io.to(`pc-${pcId}`).emit('start-timer', {
    pcId: pcId,
    duration: validDuration, // ✅ Send validated duration
    userName: userName || 'Unknown',
  });

  console.log(`📡 Timer start command emitted to PC with ${validDuration}s duration\n`);

  res.json({
    success: true,
    message: `Timer started on ${pc.name} for ${validDuration} seconds`,
    pcId: pcId,
    pcName: pc.name,
    duration: validDuration,
    formattedDuration: formatTime(validDuration),
  });
});

// Helper function to format time (add to server.ts if not present)
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ✅ NEW: Stop timer for PC via server relay
app.post('/api/pc/:pcId/timer/stop', (req: Request, res: Response) => {
  const { pcId } = req.params;
  const { userName } = req.body;

  const pc = connectedPCs.get(pcId);
  if (!pc) {
    console.error(`❌ Timer Stop Failed: PC ${pcId} not found`);
    return res.status(404).json({ error: 'PC not found' });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`⏹️  TIMER STOP REQUEST (via Server)`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🖥️  PC: ${pc.name} (${pcId})`);
  console.log(`📍 Location: ${pc.location}`);
  console.log(`👤 Stopped by: ${userName || 'Admin'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Send stop-timer event to PC via Socket.IO
  io.to(`pc-${pcId}`).emit('stop-timer', {
    pcId: pcId,
    userName: userName || 'Admin',
  });

  console.log(`📡 Timer stop command emitted to PC\n`);

  res.json({
    success: true,
    message: `Timer stopped on ${pc.name}`,
    pcId: pcId,
    pcName: pc.name,
  });
});

// ✅ UPDATED: Get timer status for PC from server tracking
app.get('/api/pc/:pcId/timer/status', (req: Request, res: Response) => {
  const { pcId } = req.params;

  const pc = connectedPCs.get(pcId);
  if (!pc) {
    return res.status(404).json({ error: 'PC not found' });
  }

  const timerData = pcTimers.get(pcId);

  res.json({
    success: true,
    pcId: pcId,
    active: timerData?.active || false,
    timeRemaining: timerData?.timeRemaining || 0,
    totalDuration: timerData?.totalDuration || 0,
  });
});

// ✅ NEW: API endpoint to get all session logs from database
app.get('/api/sessions', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as any;
    
    const sessions = SessionRepository.getSessions({
      status,
      limit,
      offset,
    });
    
    res.json(sessions);
  } catch (error) {
    console.error(`❌ Error fetching sessions: ${error}`);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ✅ NEW: API endpoint to get sessions for specific PC from database
app.get('/api/pc/:pcId/sessions', (req: Request, res: Response) => {
  try {
    const { pcId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const sessions = SessionRepository.getSessionsByPcId(pcId, limit, offset);
    
    res.json(sessions);
  } catch (error) {
    console.error(`❌ Error fetching PC sessions: ${error}`);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ✅ NEW: API endpoint to get online PCs with status
app.get('/api/pcs/online', (req: Request, res: Response) => {
  const onlinePCs = Array.from(connectedPCs.values()).map(pc => ({
    ...pc,
    connectedAt: pc.lastActive,
    onlineStatus: pc.status,
    isOnline: pc.status !== 'offline',
  }));

  res.json(onlinePCs);
});

// ✅ NEW: API endpoint to get session statistics
app.get('/api/sessions/stats', (req: Request, res: Response) => {
  try {
    const pcId = req.query.pcId as string;
    const stats = SessionRepository.getSessionStats(pcId);
    res.json(stats);
  } catch (error) {
    console.error(`❌ Error fetching session stats: ${error}`);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ✅ NEW: API endpoint to get session by ID
app.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = SessionRepository.getSessionById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (error) {
    console.error(`❌ Error fetching session: ${error}`);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Internet Café Server running on http://localhost:${PORT}`);
  console.log(`✓ Socket.IO endpoint: ws://localhost:${PORT}`);
  console.log(`✓ CORS enabled`);
  console.log(`✓ Waiting for PC connections...\n`);
});