import io, { Socket } from 'socket.io-client';

export interface PCMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}

export class PCClientService {
  private socket: Socket | null = null;
  private pcId: string = '';
  private metricsInterval: ReturnType<typeof setInterval> | null = null;

  connect(serverUrl: string, pcId: string, pcName: string, location: string, ipAddress: string) {
    this.pcId = pcId;
    this.socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('✓ Connected to server');
      this.socket?.emit('pc-register', { pcId, name: pcName, location, ipAddress });
      this.startMetricsCollection();
    });

    this.socket.on('execute-command', this.handleCommand.bind(this));
    this.socket.on('lock-screen', this.lockScreen.bind(this));
    this.socket.on('disconnect', () => this.stopMetricsCollection());
  }

  private startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getSystemMetrics();
      this.socket?.emit('pc-metrics', { pcId: this.pcId, ...metrics });
    }, 5000);
  }

  private stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private getSystemMetrics(): PCMetrics {
    // Simulated metrics - replace with actual system calls
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
    console.log('Locking screen...');
    // Platform-specific implementation
  }

  private restartPC() {
    console.log('Restarting PC...');
  }

  private shutdownPC() {
    console.log('Shutting down PC...');
  }

  private logoutUser() {
    console.log('Logging out user...');
  }

  startSession(userName: string) {
    this.socket?.emit('session-start', { pcId: this.pcId, userName, startTime: new Date().toISOString() });
  }

  endSession(sessionDuration: number) {
    this.socket?.emit('session-end', { pcId: this.pcId, sessionDuration });
  }

  disconnect() {
    this.stopMetricsCollection();
    this.socket?.disconnect();
  }
}

export default new PCClientService();