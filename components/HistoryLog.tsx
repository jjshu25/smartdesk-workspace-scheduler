
import React from 'react';
import { Booking, User, Desk } from '../types';

interface HistoryLogProps {
  bookings: Booking[];
  users: User[];
  desks: Desk[];
}

const HistoryLog: React.FC<HistoryLogProps> = ({ bookings, users, desks }) => {
  const findUserName = (userId: string) => users.find(u => u.id === userId)?.name || 'Unknown User';

  const sortedBookings = [...bookings].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800 mb-6 border-b pb-4">Desk Usage History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
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
            {sortedBookings.length > 0 ? sortedBookings.map(booking => {
              const durationMs = booking.endTime.getTime() - booking.startTime.getTime();
              const durationMinutes = Math.round(durationMs / 60000);
              return (
                <tr key={booking.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{booking.deskId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{findUserName(booking.userId)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{booking.startTime.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{booking.endTime.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{durationMinutes} min</td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No historical data available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryLog;
