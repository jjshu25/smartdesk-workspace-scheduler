import io, { Socket } from 'socket.io-client';

export interface PCMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}

export interface PCInfo {
  pcId: string;
  name: string;
  location: string;
}

class PCAutoDiscoveryService {
  private socket: Socket | null = null;
  private pcId: string = '';

  /**
   * Connect to dashboard (no metrics collection here)
   */
  connectToDashboard(serverUrl: string = 'http://localhost:5000'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔍 Connecting to dashboard server...');

        this.socket = io(serverUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
          console.log('✓ Connected to dashboard server');
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('❌ Disconnected from dashboard');
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  getPCId(): string {
    return this.pcId;
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

export default new PCAutoDiscoveryService();