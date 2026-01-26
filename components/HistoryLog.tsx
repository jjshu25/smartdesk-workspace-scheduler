import React from 'react';
import { Booking, User, Desk } from '../types';

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

interface HistoryLogProps {
  bookings?: Booking[] | null;
  users?: User[] | null;
  desks?: Desk[] | null;
  pcSessions?: PCSessionLog[] | null;
}

const HistoryLog: React.FC<HistoryLogProps> = ({ 
  bookings = [], 
  users = [], 
  desks = [], 
  pcSessions = [] 
}) => {
  // ✅ Ensure all arrays are valid
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safePCSessions = Array.isArray(pcSessions) ? pcSessions : [];

  const findUserName = (userId: string) => 
    safeUsers.find(u => u.id === userId)?.name || 'Unknown User';

  const sortedBookings = [...safeBookings].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  
  const sortedPCSessions = [...safePCSessions].sort(
    (a, b) => new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime()
  );

  const formatSeconds = (seconds: number): string => {
    if (!seconds || seconds < 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'terminated':
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

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800 mb-8 border-b pb-4">System Activity Log</h2>

      {/* PC Client Sessions Tab */}
      <div className="mb-12">
        <h3 className="text-2xl font-bold text-slate-700 mb-4 flex items-center">
          <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
          PC Client Sessions
          <span className="ml-2 text-sm text-slate-500 font-normal">({sortedPCSessions.length})</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">PC Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">PC ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Connected</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Disconnected</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Allocated Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Used Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {sortedPCSessions.length > 0 ? (
                sortedPCSessions.map(session => (
                  <tr key={session.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      💻 {session.pcName || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                      {session.pcId || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      👤 {session.userName || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDateTime(session.connectedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDateTime(session.disconnectedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      ⏳ {formatSeconds(session.allocatedDuration)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ✓ {formatSeconds(session.sessionDuration)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(session.status)}`}>
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">
                    📭 No PC client sessions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Desk Usage History Tab */}
      <div>
        <h3 className="text-2xl font-bold text-slate-700 mb-4 flex items-center">
          <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
          Desk Usage History
          <span className="ml-2 text-sm text-slate-500 font-normal">({sortedBookings.length})</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Desk ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {sortedBookings.length > 0 ? (
                sortedBookings.map(booking => {
                  const startDate = typeof booking.startTime === 'string' 
                    ? new Date(booking.startTime) 
                    : booking.startTime;
                  const endDate = typeof booking.endTime === 'string' 
                    ? new Date(booking.endTime) 
                    : booking.endTime;
                  const durationMs = endDate.getTime() - startDate.getTime();
                  const durationMinutes = Math.round(durationMs / 60000);
                  
                  return (
                    <tr key={booking.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        🏢 {booking.deskId || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {findUserName(booking.userId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {formatDateTime(booking.startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {formatDateTime(booking.endTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                        {durationMinutes} min
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    📭 No historical data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryLog;
