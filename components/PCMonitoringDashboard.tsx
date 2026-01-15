import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';

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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    // Listen for PC updates from the global service
    const checkPCs = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/pcs');
        const pcs = await response.json();
        setPCs(pcs);
      } catch (error) {
        console.error('Failed to fetch PCs:', error);
      }
    };

    checkPCs();
    const interval = setInterval(checkPCs, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  const sendCommand = (pcId: string, command: string) => {
    socket?.emit('send-command', { pcId, command });
  };

  const lockPC = (pcId: string) => {
    socket?.emit('lock-pc', { pcId });
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
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">Workspace Scheduling System</h1>
          <p className="text-slate-600 mt-1">Real-time PC monitoring and control</p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-600 animate-pulse' : 'bg-red-600'}`}></div>
          {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg shadow">
          <div className="text-3xl font-bold text-green-600">{stats.online}</div>
          <div className="text-slate-600">Online PCs</div>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg shadow">
          <div className="text-3xl font-bold text-blue-600">{stats.inUse}</div>
          <div className="text-slate-600">In Use</div>
        </div>
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow">
          <div className="text-3xl font-bold text-red-600">{stats.offline}</div>
          <div className="text-slate-600">Offline</div>
        </div>
      </div>

      {/* PC Grid & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* PC List */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Connected PCs ({pcs.length})</h2>
            {pcs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg">🖥️ No PCs detected yet</p>
                <p className="text-sm mt-2">Waiting for PC connections...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pcs.map(pc => (
                  <div
                    key={pc.id}
                    onClick={() => setSelectedPC(pc)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedPC?.id === pc.id
                        ? 'border-blue-500 shadow-lg bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-slate-800">{pc.name}</h3>
                        <p className="text-xs text-slate-500">{pc.location}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        pc.status === 'online' ? 'bg-green-100 text-green-800' :
                        pc.status === 'in-use' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {pc.status === 'online' ? '● Online' : pc.status === 'in-use' ? '● In Use' : '● Offline'}
                      </span>
                    </div>

                    {pc.currentUser && <p className="text-xs text-slate-600 mb-2">👤 {pc.currentUser}</p>}

                    <div className="space-y-1 text-xs mb-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">CPU</span>
                        <span className="font-semibold">{pc.cpuUsage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pc.cpuUsage}%` }}></div>
                      </div>

                      <div className="flex justify-between mt-2">
                        <span className="text-slate-600">Memory</span>
                        <span className="font-semibold">{pc.memoryUsage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pc.memoryUsage}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PC Details Panel */}
        <div className="bg-white rounded-xl shadow-lg p-6 h-fit">
          {selectedPC ? (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-800">{selectedPC.name}</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">PC ID:</span> {selectedPC.id}</p>
                <p><span className="font-semibold">IP:</span> {selectedPC.ipAddress}</p>
                <p><span className="font-semibold">MAC:</span> {selectedPC.macAddress}</p>
                <p><span className="font-semibold">OS:</span> {selectedPC.osType} {selectedPC.osVersion}</p>
                <p><span className="font-semibold">Location:</span> {selectedPC.location}</p>
                <p><span className="font-semibold">Status:</span> <span className={`px-2 py-1 rounded text-xs font-bold ${selectedPC.status === 'online' ? 'bg-green-100 text-green-800' : selectedPC.status === 'in-use' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{selectedPC.status}</span></p>
                {selectedPC.currentUser && <p><span className="font-semibold">User:</span> {selectedPC.currentUser}</p>}
              </div>
              <div className="space-y-2 mt-4">
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">CPU: {selectedPC.cpuUsage.toFixed(1)}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${selectedPC.cpuUsage}%` }}></div></div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Memory: {selectedPC.memoryUsage.toFixed(1)}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${selectedPC.memoryUsage}%` }}></div></div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Disk: {selectedPC.diskUsage.toFixed(1)}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${selectedPC.diskUsage}%` }}></div></div>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <button onClick={() => sendCommand(selectedPC.id, 'restart')} className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 font-semibold text-sm">Restart</button>
                <button onClick={() => sendCommand(selectedPC.id, 'shutdown')} className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 font-semibold text-sm">Shutdown</button>
                <button onClick={() => lockPC(selectedPC.id)} className="w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600 font-semibold text-sm">Lock Screen</button>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">Select a PC to view details</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PCMonitoringDashboard;