import React, { useState, useEffect } from 'react';

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

const PCMonitoringDashboard: React.FC = () => {
  const [pcs, setPCs] = useState<PC[]>([]);
  const [selectedPC, setSelectedPC] = useState<PC | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

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

  // ✅ ENHANCE THIS: Send command to PC
  const sendCommand = async (pcId: string, command: string) => {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📤 SENDING COMMAND FROM DASHBOARD`);
      console.log(`${'='.repeat(60)}`);
      console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
      console.log(`🖥️  PC ID: ${pcId}`);
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
        alert(`✅ Command '${command}' sent to PC successfully`);
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

  // ✅ ADD THIS: Confirm before dangerous actions
  const sendDangerousCommand = (pcId: string, command: string) => {
    const confirmMessage = {
      'logout': '⚠️  This will log out the current user. Continue?',
      'restart': '⚠️  This will restart the PC in 10 seconds. Continue?',
      'shutdown': '⚠️  This will shut down the PC in 10 seconds. Continue?',
    };

    const message = confirmMessage[command as keyof typeof confirmMessage];
    if (message && confirm(message)) {
      sendCommand(pcId, command);
    }
  };

  const getStatusStats = () => {
    return {
      online: pcs.filter(p => p.status === 'online').length,
      inUse: pcs.filter(p => p.status === 'in-use').length,
      offline: pcs.filter(p => p.status === 'offline').length,
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

      {/* PC Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pcs.map((pc) => (
          <div key={pc.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            {/* PC Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{pc.name}</h3>
                  <p className="text-blue-200 text-sm">{pc.location}</p>
                </div>
                <span className="text-3xl">{pc.status === 'online' ? '🟢' : pc.status === 'in-use' ? '🟡' : '🔴'}</span>
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

              {/* ✅ UPDATE THESE: Command Buttons */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase">Actions</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendCommand(pc.id, 'lock-usb')}
                    className="px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors font-semibold flex items-center justify-center gap-1"
                    title="Disable keyboard, mouse, and USB devices"
                  >
                    🔒 Lock USB
                  </button>

                  <button
                    onClick={() => sendCommand(pc.id, 'unlock-usb')}
                    className="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors font-semibold flex items-center justify-center gap-1"
                    title="Re-enable keyboard, mouse, and USB devices"
                  >
                    🔓 Unlock USB
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendCommand(pc.id, 'logout')}
                    className="px-3 py-2 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition-colors font-semibold flex items-center justify-center gap-1"
                  >
                    👤 Logout
                  </button>

                  <button
                    onClick={() => sendDangerousCommand(pc.id, 'restart')}
                    className="px-3 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition-colors font-semibold flex items-center justify-center gap-1"
                  >
                    🔄 Restart
                  </button>
                </div>

                <button
                  onClick={() => sendDangerousCommand(pc.id, 'shutdown')}
                  className="w-full px-3 py-2 bg-gray-800 text-white text-sm rounded hover:bg-gray-900 transition-colors font-semibold"
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