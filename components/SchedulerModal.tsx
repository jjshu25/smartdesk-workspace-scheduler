
import React, { useState } from 'react';
import { Desk, User } from '../types';
import Icon from './Icon';

interface SchedulerModalProps {
  desk: Desk;
  users: User[];
  onClose: () => void;
  onConfirm: (deskId: string, userId: string, duration: number) => void;
  existingBookings: { deskId: string; userId: string; }[];
}

const SchedulerModal: React.FC<SchedulerModalProps> = ({ desk, users, onClose, onConfirm, existingBookings }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [duration, setDuration] = useState<number>(60); // Default 60 minutes
  const [error, setError] = useState<string>('');

  const handleConfirm = () => {
    // Anti-Duplicate Scheduling Shield
    const isAlreadyBooked = existingBookings.some(b => b.userId === selectedUserId);
    if (isAlreadyBooked) {
      setError('This user already has an active booking. Please select another user.');
      return;
    }
    setError('');
    onConfirm(desk.id, selectedUserId, duration);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md transform transition-all">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Book Desk {desk.id}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon name="x" className="w-6 h-6" />
          </button>
        </div>
        
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">{error}</div>}

        <div className="space-y-6">
          <div>
            <label htmlFor="user" className="block text-sm font-medium text-slate-700 mb-1">Select User</label>
            <select
              id="user"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm rounded-md"
            >
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name} ({user.team})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min="15"
              step="15"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm rounded-md"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors duration-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="bg-brand-primary text-white font-semibold py-2 px-6 rounded-lg hover:bg-brand-dark transition-colors duration-300"
          >
            Confirm Booking
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchedulerModal;
