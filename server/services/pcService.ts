import { Socket } from 'socket.io';

export interface ConnectedPC {
  id: string;
  name: string;
  location: string;
  ipAddress: string;
  status: 'online' | 'offline' | 'in-use';
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  currentUser?: string;
  sessionStartTime?: Date;
  lastActive: Date;
  bootTime?: Date;
}

export interface PCCommand {
  pcId: string;
  command: 'restart' | 'shutdown' | 'logout' | 'lock' | 'unlock';
  params?: Record<string, any>;
  timestamp: Date;
}

export class PCService {
  private pcs: Map<string, ConnectedPC> = new Map();
  private commandHistory: PCCommand[] = [];

  registerPC(pcId: string, data: Omit<ConnectedPC, 'lastActive' | 'status' | 'cpuUsage' | 'memoryUsage' | 'diskUsage'>): ConnectedPC {
    const pc: ConnectedPC = {
      ...data,
      status: 'online',
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      lastActive: new Date(),
      bootTime: new Date(),
    };
    this.pcs.set(pcId, pc);
    return pc;
  }

  updateMetrics(pcId: string, metrics: { cpuUsage: number; memoryUsage: number; diskUsage: number }): ConnectedPC | null {
    const pc = this.pcs.get(pcId);
    if (pc) {
      pc.cpuUsage = metrics.cpuUsage;
      pc.memoryUsage = metrics.memoryUsage;
      pc.diskUsage = metrics.diskUsage;
      pc.lastActive = new Date();
      return pc;
    }
    return null;
  }

  startSession(pcId: string, userName: string): ConnectedPC | null {
    const pc = this.pcs.get(pcId);
    if (pc) {
      pc.currentUser = userName;
      pc.status = 'in-use';
      pc.sessionStartTime = new Date();
      return pc;
    }
    return null;
  }

  endSession(pcId: string): ConnectedPC | null {
    const pc = this.pcs.get(pcId);
    if (pc) {
      pc.currentUser = undefined;
      pc.sessionStartTime = undefined;
      pc.status = 'online';
      return pc;
    }
    return null;
  }

  executeCommand(command: PCCommand): void {
    this.commandHistory.push(command);
  }

  getPCById(pcId: string): ConnectedPC | undefined {
    return this.pcs.get(pcId);
  }

  getAllPCs(): ConnectedPC[] {
    return Array.from(this.pcs.values());
  }

  getCommandHistory(): PCCommand[] {
    return this.commandHistory;
  }

  removePCById(pcId: string): void {
    this.pcs.delete(pcId);
  }
}

export const pcService = new PCService();