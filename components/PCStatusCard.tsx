import React from 'react';

interface PC {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'in-use';
  cpuUsage: number;
  memoryUsage: number;
  currentUser?: string;
}

interface PCStatusCardProps {
  pc: PC;
  isSelected: boolean;
  onSelect: (pc: PC) => void;
  onLock: (pcId: string) => void;
  onCommand: (pcId: string, command: string) => void;
}

const PCStatusCard: React.FC<PCStatusCardProps> = ({ pc, isSelected, onSelect, onLock, onCommand }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-50 border-green-200';
      case 'offline':
        return 'bg-red-50 border-red-200';
      case 'in-use':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      case 'in-use':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      onClick={() => onSelect(pc)}
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${getStatusColor(pc.status)} ${isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200'}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-slate-800">{pc.name}</h3>
          <p className="text-xs text-slate-500">{pc.location}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusBadgeColor(pc.status)}`}>
          {pc.status === 'in-use' ? '● In Use' : pc.status === 'online' ? '● Online' : '● Offline'}
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

      {isSelected && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={(e) => { e.stopPropagation(); onLock(pc.id); }}
            className="flex-1 text-xs bg-yellow-500 text-white py-1 rounded hover:bg-yellow-600 font-semibold"
          >
            Lock
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCommand(pc.id, 'logout'); }}
            className="flex-1 text-xs bg-red-500 text-white py-1 rounded hover:bg-red-600 font-semibold"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default PCStatusCard;