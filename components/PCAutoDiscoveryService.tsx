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
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private SERVER_URL: string = 'http://localhost:5000';

  /**
   * Auto-detect and register PC when server is available
   */
  autoDetectAndConnect(customName?: string, customLocation?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔍 Auto-detecting PC...');

        this.socket = io(this.SERVER_URL, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
          console.log('✓ Connected to server');

          // Auto-register with optional custom data
          this.socket?.emit('pc-auto-register', {
            name: customName,
            location: customLocation,
          });
        });

        // Receive PC ID confirmation
        this.socket.on('pc-registered', (data: { pcId: string; name: string }) => {
          this.pcId = data.pcId;
          console.log(`✅ PC Auto-registered: ${data.name}`);
          console.log(`   ID: ${this.pcId}`);

          this.startMetricsCollection();
          resolve(this.pcId);
        });

        this.socket.on('execute-command', this.handleCommand.bind(this));
        this.socket.on('lock-screen', this.lockScreen.bind(this));

        this.socket.on('disconnect', () => {
          console.log('❌ Disconnected from server');
          this.stopMetricsCollection();
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

  private startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getSystemMetrics();
      this.socket?.emit('pc-metrics', { pcId: this.pcId, ...metrics });
    }, 5000);
  }

  private stopMetricsCollection() {
    if (this.metricsInterval) clearInterval(this.metricsInterval);
  }

  private getSystemMetrics(): PCMetrics {
    // Simulated metrics - in production, use system monitoring library
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
    };
  }

  private handleCommand(data: { command: string; params?: any }) {
    console.log('Executing command:', data.command);
    switch (data.command) {
      case 'restart':
        this.restartPC();
        break;
      case 'shutdown':
        this.shutdownPC();
        break;
      case 'logout':
        this.logoutUser();
        break;
      default:
        console.warn('Unknown command:', data.command);
    }
  }

  private lockScreen() {
    console.log('🔒 Locking screen...');
  }

  private restartPC() {
    console.log('🔄 Restarting PC...');
  }

  private shutdownPC() {
    console.log('⏹️ Shutting down PC...');
  }

  private logoutUser() {
    console.log('👤 Logging out user...');
  }

  startSession(userName: string) {
    this.socket?.emit('session-start', {
      pcId: this.pcId,
      userName,
      startTime: new Date().toISOString(),
    });
  }

  endSession(sessionDuration: number) {
    this.socket?.emit('session-end', { pcId: this.pcId, sessionDuration });
  }

  getPCId(): string {
    return this.pcId;
  }

  disconnect() {
    this.stopMetricsCollection();
    this.socket?.disconnect();
  }
}

export default new PCAutoDiscoveryService();