import React, { useState, useEffect } from 'react';
import { io as ioClient } from 'socket.io-client';

interface PC {
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
  lastActive: Date;
  bootTime?: Date;
  autoDetected: boolean;
}

interface TimerStatus {
  active: boolean;
  timeRemaining: number;
  totalDuration: number;
}

const PCMonitoringDashboard: React.FC = () => {
  const [pcs, setPCs] = useState<PC[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [timerStatus, setTimerStatus] = useState<{ [key: string]: TimerStatus }>({});
  const [socket, setSocket] = useState<any>(null);
  
  // ✅ NEW: Global timer controls
  const [globalTimerDuration, setGlobalTimerDuration] = useState<number>(0);
  const [selectedPCForTimer, setSelectedPCForTimer] = useState<string>('');
  const [activeTimerPC, setActiveTimerPC] = useState<string>('');

  // ✅ NEW: Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = ioClient('http://localhost:5000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('📡 Connected to server via Socket.IO');
    });

    // ✅ NEW: Listen for real-time timer updates
    newSocket.on('pc-timer-updated', (data: { pcId: string; timeRemaining: number; active: boolean }) => {
      setTimerStatus((prev) => ({
        ...prev,
        [data.pcId]: {
          active: data.active,
          timeRemaining: data.timeRemaining,
          totalDuration: prev[data.pcId]?.totalDuration || 0,
        },
      }));

      if (!data.active) {
        setActiveTimerPC('');
      } else {
        setActiveTimerPC(data.pcId);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Fetch PCs from server
    const checkPCs = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/pcs');
        const data = await response.json();
        setPCs(data);
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Failed to fetch PCs:', error);
        setConnectionStatus('disconnected');
      }
    };

    checkPCs();
    const interval = setInterval(checkPCs, 5000);

    return () => clearInterval(interval);
  }, []);

  // ✅ NEW: Format time display
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ✅ NEW: Start global timer
  const startGlobalTimer = async () => {
    if (!selectedPCForTimer) {
      alert('⚠️ Please select a PC');
      return;
    }

    const duration = Math.max(parseInt(String(globalTimerDuration || 0), 10), 1);

    if (!duration || duration <= 0) {
      alert('⚠️ Please enter a valid duration (in seconds)');
      return;
    }

    const pc = pcs.find((p) => p.id === selectedPCForTimer);

    if (!pc) {
      alert('⚠️ PC not found');
      return;
    }

    if (pc.status === 'offline') {
      alert('⚠️ PC is currently offline. Cannot start timer.');
      return;
    }

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`⏱️  TIMER START REQUEST`);
      console.log(`${'='.repeat(60)}`);
      console.log(`🖥️  PC: ${pc.name} (${selectedPCForTimer})`);
      console.log(`📍 Location: ${pc.location}`);
      console.log(`🌐 IP: ${pc.ipAddress}`);
      console.log(`⏳ Duration: ${duration} seconds`);
      console.log(`⏳ Formatted: ${formatTime(duration)}`);
      console.log(`${'='.repeat(60)}\n`);

      const response = await fetch(`http://localhost:5000/api/pc/${selectedPCForTimer}/timer/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: duration,
          userName: pc.name,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ Timer started successfully on ${pc.name}`);
        console.log(`📋 Response: ${JSON.stringify(result)}\n`);

        setTimerStatus((prev) => ({
          ...prev,
          [selectedPCForTimer]: {
            active: true,
            timeRemaining: duration,
            totalDuration: duration,
          },
        }));

        setActiveTimerPC(selectedPCForTimer);
        alert(`✅ Timer started on ${pc.name}\n⏳ Duration: ${formatTime(duration)}`);
      } else {
        console.error(`❌ Failed to start timer`);
        alert(`❌ Failed to start timer: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error starting timer:', error);
      alert(`❌ Error starting timer: ${error}`);
    }
  };

  // ✅ NEW: Stop global timer
  const stopGlobalTimer = async () => {
    if (!activeTimerPC) {
      alert('⚠️ No active timer');
      return;
    }

    const pc = pcs.find((p) => p.id === activeTimerPC);

    if (!pc) {
      alert('⚠️ PC not found');
      return;
    }

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`⏹️  TIMER STOP REQUEST`);
      console.log(`${'='.repeat(60)}`);
      console.log(`🖥️  PC: ${pc.name} (${activeTimerPC})`);
      console.log(`📍 Location: ${pc.location}`);
      console.log(`👤 Stopped by: Admin`);
      console.log(`${'='.repeat(60)}\n`);

      const response = await fetch(`http://localhost:5000/api/pc/${activeTimerPC}/timer/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: 'Admin',
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ Timer stopped successfully on ${pc.name}`);

        setTimerStatus((prev) => ({
          ...prev,
          [activeTimerPC]: {
            active: false,
            timeRemaining: 0,
            totalDuration: 0,
          },
        }));

        setActiveTimerPC('');
        alert(`✅ Timer stopped on ${pc.name}`);
      } else {
        console.error(`❌ Failed to stop timer`);
        alert(`❌ Failed to stop timer: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error stopping timer:', error);
      alert(`❌ Error stopping timer: ${error}`);
    }
  };

  // Send command to PC
  const sendCommand = async (pcId: string, command: string) => {
    const pc = pcs.find((p) => p.id === pcId);

    if (!pc) {
      alert('⚠️ PC not found');
      return;
    }

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📤 SENDING COMMAND FROM DASHBOARD`);
      console.log(`${'='.repeat(60)}`);
      console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
      console.log(`🖥️  PC: ${pc.name} (${pcId})`);
      console.log(`🌐 IP: ${pc.ipAddress}`);
      console.log(`🎬 Command: ${command.toUpperCase()}`);
      console.log(`${'='.repeat(60)}\n`);

      const response = await fetch(`http://localhost:5000/api/pc/${pcId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ Command sent successfully`);
        console.log(`📋 Response: ${JSON.stringify(result)}\n`);
        alert(`✅ Command '${command}' sent to ${pc.name} successfully`);
      } else {
        console.error(`❌ Failed to send command`);
        console.error(`📋 Error: ${result.error}\n`);
        alert(`❌ Failed to send command: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error sending command:', error);
      console.error(`${'='.repeat(60)}\n`);
      alert(`❌ Error sending command: ${error}`);
    }
  };

  const sendDangerousCommand = (pcId: string, command: string) => {
    const confirmMessage = {
      logout: '⚠️  This will log out the current user. Continue?',
      restart: '⚠️  This will restart the PC in 10 seconds. Continue?',
      shutdown: '⚠️  This will shut down the PC in 10 seconds. Continue?',
    };

    const message = confirmMessage[command as keyof typeof confirmMessage];
    if (message && confirm(message)) {
      sendCommand(pcId, command);
    }
  };

  const getStatusStats = () => {
    return {
      online: pcs.filter((p) => p.status === 'online').length,
      inUse: pcs.filter((p) => p.status === 'in-use').length,
      offline: pcs.filter((p) => p.status === 'offline').length,
    };
  };

  const stats = getStatusStats();

  return (
    <div className="space-y-6 p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total PCs</p>
              <p className="text-3xl font-bold text-blue-600">{pcs.length}</p>
            </div>
            <span className="text-4xl">🖥️</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Online</p>
              <p className="text-3xl font-bold text-green-600">{stats.online}</p>
            </div>
            <span className="text-4xl">🟢</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">In Use</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.inUse}</p>
            </div>
            <span className="text-4xl">🟡</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Offline</p>
              <p className="text-3xl font-bold text-red-600">{stats.offline}</p>
            </div>
            <span className="text-4xl">🔴</span>
          </div>
        </div>
      </div>

      {/* ✅ NEW: Global Timer Control Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          {/* PC Selection */}
          <div>
            <label className="block text-sm font-semibold mb-2">Select PC</label>
            <select
              value={selectedPCForTimer}
              onChange={(e) => setSelectedPCForTimer(e.target.value)}
              disabled={activeTimerPC !== ''}
              className="w-full px-3 py-2 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-300"
            >
              <option value="">-- Choose PC --</option>
              {pcs
                .filter((pc) => pc.status !== 'offline')
                .map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    {pc.name} ({pc.location})
                  </option>
                ))}
            </select>
          </div>

          {/* Duration Input */}
          <div>
            <label className="block text-sm font-semibold mb-2">Duration (seconds)</label>
            <input
              type="number"
              value={globalTimerDuration || ''}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                setGlobalTimerDuration(value);
              }}
              placeholder="Enter seconds..."
              min="0"
              disabled={activeTimerPC !== ''}
              className="w-full px-3 py-2 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-300"
            />
          </div>

          {/* Formatted Time Display */}
          <div>
            <label className="block text-sm font-semibold mb-2">Formatted Time</label>
            <div className="px-3 py-2 bg-white bg-opacity-20 rounded-lg text-center font-mono text-lg font-bold">
              {formatTime(globalTimerDuration || 0)}
            </div>
          </div>

          {/* Active Timer Display */}
          {activeTimerPC && (
            <div>
              <label className="block text-sm font-semibold mb-2">⏱️ Active Timer</label>
              <div className="px-3 py-2 bg-white bg-opacity-30 rounded-lg text-center font-mono text-2xl font-bold">
                {formatTime(timerStatus[activeTimerPC]?.timeRemaining || 0)}
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-2">
            <button
              onClick={startGlobalTimer}
              disabled={activeTimerPC !== '' || !selectedPCForTimer || globalTimerDuration <= 0}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTimerPC !== '' || !selectedPCForTimer || globalTimerDuration <= 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              ▶️ Start
            </button>
            <button
              onClick={stopGlobalTimer}
              disabled={activeTimerPC === ''}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTimerPC === ''
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              ⏹️ Stop
            </button>
          </div>
        </div>
      </div>

      {/* PC Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pcs.map((pc) => (
          <div
            key={pc.id}
            className={`bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow ${
              activeTimerPC === pc.id ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            {/* PC Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{pc.name}</h3>
                  <p className="text-blue-200 text-sm">{pc.location}</p>
                </div>
                <span className="text-3xl">
                  {pc.status === 'online' ? '🟢' : pc.status === 'in-use' ? '🟡' : '🔴'}
                </span>
              </div>
            </div>

            {/* PC Info */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">OS</p>
                  <p className="font-semibold">{pc.osType}</p>
                </div>
                <div>
                  <p className="text-gray-600">IP Address</p>
                  <p className="font-semibold text-xs">{pc.ipAddress}</p>
                </div>
              </div>

              {/* ✅ NEW: Active Timer Indicator (Only if this PC has active timer) */}
              {timerStatus[pc.id]?.active && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 rounded">
                  <p className="text-sm font-semibold text-yellow-800">⏱️ Timer Active</p>
                  <p className="text-3xl font-mono font-bold text-yellow-700">
                    {formatTime(timerStatus[pc.id]?.timeRemaining || 0)}
                  </p>
                </div>
              )}

              {/* Metrics */}
              <div className="space-y-2 border-t pt-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>CPU</span>
                    <span className="font-bold text-blue-600">{pc.cpuUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${pc.cpuUsage}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>RAM</span>
                    <span className="font-bold text-green-600">{pc.memoryUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${pc.memoryUsage}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>DISK</span>
                    <span className="font-bold text-orange-600">{pc.diskUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full transition-all"
                      style={{ width: `${pc.diskUsage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Command Buttons */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase">PC Actions</p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendCommand(pc.id, 'logout')}
                    disabled={pc.status === 'offline'}
                    className={`px-3 py-2 text-white text-sm rounded font-semibold transition-colors flex items-center justify-center gap-1 ${
                      pc.status === 'offline'
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-yellow-500 hover:bg-yellow-600'
                    }`}
                  >
                    👤 Logout
                  </button>

                  <button
                    onClick={() => sendDangerousCommand(pc.id, 'restart')}
                    disabled={pc.status === 'offline'}
                    className={`px-3 py-2 text-white text-sm rounded font-semibold transition-colors flex items-center justify-center gap-1 ${
                      pc.status === 'offline'
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                  >
                    🔄 Restart
                  </button>
                </div>

                <button
                  onClick={() => sendDangerousCommand(pc.id, 'shutdown')}
                  disabled={pc.status === 'offline'}
                  className={`w-full px-3 py-2 text-white text-sm rounded font-semibold transition-colors ${
                    pc.status === 'offline'
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gray-800 hover:bg-gray-900'
                  }`}
                >
                  ⏹️ Shutdown
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {pcs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No PCs connected yet...</p>
          <p className="text-gray-400">Waiting for PC clients to register</p>
        </div>
      )}
    </div>
  );
};

export default PCMonitoringDashboard;