export enum PCStatus {
  Online = 'online',
  Offline = 'offline',
  InUse = 'in-use',
  Maintenance = 'maintenance',
}

export enum CommandType {
  Restart = 'restart',
  Shutdown = 'shutdown',
  Logout = 'logout',
  Lock = 'lock',
  Unlock = 'unlock',
  Screenshot = 'screenshot',
  MessageDisplay = 'message-display',
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkSpeed: number;
  temperature: number;
}

export interface PCSession {
  pcId: string;
  userName: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  costAmount?: number;
}

export interface BillingRecord {
  sessionId: string;
  pcId: string;
  userName: string;
  rate: number; // Cost per minute
  duration: number; // In minutes
  totalCost: number;
  paymentStatus: 'pending' | 'paid' | 'cancelled';
  timestamp: Date;
}

export interface MaintenanceLog {
  id: string;
  pcId: string;
  type: 'hardware' | 'software' | 'cleaning';
  description: string;
  startTime: Date;
  endTime?: Date;
  technician: string;
  status: 'scheduled' | 'in-progress' | 'completed';
}