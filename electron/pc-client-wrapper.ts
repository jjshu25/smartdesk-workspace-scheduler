import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';

let pcClientProcess: ChildProcess | null = null;

export function startPCClient() {
  try {
    // Path to compiled PC Client
    const pcClientPath = path.join(
      app.getAppPath(),
      'server/pc-client.js' // After building, this will be compiled
    );

    console.log(`🚀 Starting PC Client from: ${pcClientPath}`);

    pcClientProcess = spawn('node', [pcClientPath], {
      stdio: ['inherit', 'pipe', 'pipe'],
      detached: false,
    });

    pcClientProcess.stdout?.on('data', (data) => {
      console.log(`[PC-Client] ${data.toString()}`);
    });

    pcClientProcess.stderr?.on('data', (data) => {
      console.error(`[PC-Client ERROR] ${data.toString()}`);
    });

    pcClientProcess.on('close', (code) => {
      console.log(`[PC-Client] Process exited with code ${code}`);
      pcClientProcess = null;
    });

    return pcClientProcess;
  } catch (error) {
    console.error(`❌ Failed to start PC Client: ${error}`);
    return null;
  }
}

export function stopPCClient() {
  if (pcClientProcess) {
    console.log('🛑 Stopping PC Client...');
    pcClientProcess.kill();
    pcClientProcess = null;
  }
}

export function isPCClientRunning() {
  return pcClientProcess !== null && !pcClientProcess.killed;
}