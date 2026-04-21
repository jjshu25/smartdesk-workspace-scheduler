import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface PCSessionLog {
  id: string;
  pcId: string;
  pcName: string;
  userName: string;
  connectedAt: Date;
  disconnectedAt?: Date;
  sessionDuration: number; // in seconds
  allocatedDuration: number; // in seconds
  status: 'active' | 'completed' | 'terminated';
  deskId?: string;
}

interface OnlinePC {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'in-use';
  lastActive: Date;
  currentUser?: string;
  ipAddress: string;
  location: string;
}

interface HistoryLogProps {
  bookings?: any[] | null;
  users?: any[] | null;
  desks?: any[] | null;
  pcSessions?: PCSessionLog[] | null;
}

interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  terminatedSessions: number;
  totalDuration: number;
  averageDuration: number;
}

const HistoryLog: React.FC<HistoryLogProps> = () => {
  const [sessions, setSessions] = useState<PCSessionLog[]>([]);
  const [onlinePCs, setOnlinePCs] = useState<OnlinePC[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'terminated'>('all');

  useEffect(() => {
    // Connect to server
    const newSocket = io('http://localhost:5000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server');
      fetchSessions();
      fetchOnlinePCs();
      fetchSessionStats();
    });

    // ✅ NEW: Listen for real-time session updates
    newSocket.on('session-logged', (session: PCSessionLog) => {
      console.log('📝 New session logged:', session);
      // Refresh sessions to get updated data from database
      fetchSessions();
      fetchSessionStats();
    });

    // ✅ NEW: Listen for PC status updates
    newSocket.on('pc-updated', (pc: OnlinePC) => {
      console.log('🖥️ PC updated:', pc);
      setOnlinePCs(prev => {
        const index = prev.findIndex(p => p.id === pc.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = pc;
          return updated;
        }
        return [pc, ...prev];
      });
    });

    setSocket(newSocket);
    setLoading(false);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const fetchSessions = async () => {
    try {
      const offset = (currentPage - 1) * pageSize;
      const statusQuery = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const response = await fetch(`http://localhost:5000/api/sessions?limit=${pageSize}&offset=${offset}${statusQuery}`);
      const data = await response.json();
      // Convert date strings to Date objects
      const sessionsWithDates = data.map((session: any) => ({
        ...session,
        connectedAt: new Date(session.connectedAt),
        disconnectedAt: session.disconnectedAt ? new Date(session.disconnectedAt) : undefined,
      }));
      setSessions(sessionsWithDates);
    } catch (error) {
      console.error('❌ Error fetching sessions:', error);
    }
  };

  const fetchOnlinePCs = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/pcs/online');
      const data = await response.json();
      setOnlinePCs(data);
    } catch (error) {
      console.error('❌ Error fetching online PCs:', error);
    }
  };

  const fetchSessionStats = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/sessions/stats');
      const data = await response.json();
      setSessionStats(data);
    } catch (error) {
      console.error('❌ Error fetching session stats:', error);
    }
  };

  const formatSeconds = (seconds: number): string => {
    if (!seconds || seconds < 0) return '00:00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'terminated':
        return 'bg-red-100 text-red-800';
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'in-use':
        return 'bg-yellow-100 text-yellow-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const formatDateTime = (date: any): string => {
    if (!date) return '—';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleString();
    } catch {
      return '—';
    }
  };

  const handleStatusFilterChange = (newStatus: 'all' | 'active' | 'completed' | 'terminated') => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
    // Fetch with new filter
    const offset = 0;
    const statusQuery = newStatus !== 'all' ? `&status=${newStatus}` : '';
    fetch(`http://localhost:5000/api/sessions?limit=${pageSize}&offset=${offset}${statusQuery}`)
      .then(res => res.json())
      .then(data => {
        const sessionsWithDates = data.map((session: any) => ({
          ...session,
          connectedAt: new Date(session.connectedAt),
          disconnectedAt: session.disconnectedAt ? new Date(session.disconnectedAt) : undefined,
        }));
        setSessions(sessionsWithDates);
      })
      .catch(err => console.error('Error fetching filtered sessions:', err));
  };

  if (loading) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800 mb-8 border-b pb-4">System Activity Log</h2>

      {/* Online PCs Status Tab */}
      <div className="mb-12">
        <h3 className="text-2xl font-bold text-slate-700 mb-4 flex items-center">
          <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
          Online PC Clients
          <span className="ml-2 text-sm text-slate-500 font-normal">({onlinePCs.length})</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">PC Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">IP Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Current User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Last Active</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {onlinePCs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-slate-500">
                    No online PCs
                  </td>
                </tr>
              ) : (
                onlinePCs.map((pc) => (
                  <tr key={pc.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">{pc.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{pc.ipAddress}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{pc.location}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(pc.status)}`}>
                        {pc.status === 'in-use' ? 'In Use' : pc.status.charAt(0).toUpperCase() + pc.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{pc.currentUser || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(pc.lastActive)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session History Tab */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-700 flex items-center">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            Session History
            {sessionStats && (
              <span className="ml-4 text-sm text-slate-500 font-normal">
                Total: {sessionStats.totalSessions} | Active: {sessionStats.activeSessions} | Completed: {sessionStats.completedSessions}
              </span>
            )}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusFilterChange('all')}
              className={`px-3 py-1 rounded text-sm font-medium ${statusFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
            >
              All
            </button>
            <button
              onClick={() => handleStatusFilterChange('active')}
              className={`px-3 py-1 rounded text-sm font-medium ${statusFilter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
            >
              Active
            </button>
            <button
              onClick={() => handleStatusFilterChange('completed')}
              className={`px-3 py-1 rounded text-sm font-medium ${statusFilter === 'completed'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
            >
              Completed
            </button>
            <button
              onClick={() => handleStatusFilterChange('terminated')}
              className={`px-3 py-1 rounded text-sm font-medium ${statusFilter === 'terminated'
                ? 'bg-red-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
            >
              Terminated
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">PC Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Connected At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Disconnected At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-slate-500">
                    No sessions recorded
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">{session.pcName}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{session.userName}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(session.connectedAt)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(session.disconnectedAt) || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {session.status === 'active' ? '—' : formatSeconds(session.sessionDuration)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(session.status)}`}>
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-slate-600">
            Page {currentPage} | Showing {sessions.length} sessions per page
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                  fetchSessions();
                }
              }}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded text-sm font-medium ${currentPage === 1
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
            >
              Previous
            </button>
            <button
              onClick={() => {
                if (sessions.length === pageSize) {
                  setCurrentPage(currentPage + 1);
                  fetchSessions();
                }
              }}
              disabled={sessions.length < pageSize}
              className={`px-4 py-2 rounded text-sm font-medium ${sessions.length < pageSize
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryLog;
