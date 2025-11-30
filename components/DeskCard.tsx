import React from 'react';
import { Desk, DeskStatus, User, Booking } from '../types';
import Icon from './Icon';

interface DeskCardProps {
  desk: Desk;
  currentUser: User | null;
  booking: Booking | null;
  onBook: () => void;
  onEndBooking: (bookingId: string) => void;
  onToggleLock: (deskId: string) => void;
  onScanQR: (deskId: string) => void;
}

const statusClasses: Record<DeskStatus, { bg: string; text: string; ring: string }> = {
  [DeskStatus.Available]: { bg: 'bg-status-available/10', text: 'text-status-available', ring: 'ring-status-available/20' },
  [DeskStatus.Occupied]: { bg: 'bg-status-occupied/10', text: 'text-status-occupied', ring: 'ring-status-occupied/20' },
  [DeskStatus.Reserved]: { bg: 'bg-status-reserved/10', text: 'text-status-reserved', ring: 'ring-status-reserved/20' },
};

const DeskCard: React.FC<DeskCardProps> = ({ desk, currentUser, booking, onBook, onEndBooking, onToggleLock, onScanQR }) => {
  const { bg, text, ring } = statusClasses[desk.status];
  
  const handleEndBooking = () => {
    if (booking) {
      onEndBooking(booking.id);
    }
  };

  return (
    <div className={`rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 bg-white p-5 border border-slate-200 flex flex-col justify-between space-y-4`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Desk {desk.id}</h3>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
            {desk.status}
          </span>
        </div>
        <div className={`w-4 h-4 rounded-full transition-colors ${desk.isBeaconOn ? 'bg-blue-500 shadow-[0_0_8px_2px_rgba(59,130,246,0.5)]' : 'bg-slate-300'}`}>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-slate-600">
        <div className="flex items-center space-x-2">
          <Icon name="thermometer" className="w-5 h-5 text-brand-secondary" />
          <span>{desk.temperature}°C</span>
        </div>
        <div className="flex items-center space-x-2">
          <Icon name="volume" className="w-5 h-5 text-brand-secondary" />
          <span>{desk.noiseLevel} dB</span>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-500 mb-2 h-5">
          {desk.status === DeskStatus.Occupied && currentUser ? (
            <>
              In use by: <span className="font-semibold text-brand-primary">{currentUser.name}</span>
            </>
           ) : (
            `Location: Row ${desk.location.row}, Col ${desk.location.col}`
           )}
        </p>
        
        <div className="flex items-center justify-between space-x-2">
          <button onClick={() => onToggleLock(desk.id)} className={`p-2 rounded-full transition-colors ${desk.isLocked ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'}`}>
            <Icon name={desk.isLocked ? 'lock' : 'unlock'} className="w-5 h-5" />
          </button>
           <button onClick={() => onScanQR(desk.id)} title="Simulate QR Scan" className="p-2 rounded-full bg-brand-secondary/10 text-brand-secondary hover:bg-brand-secondary/20 transition-colors">
            <Icon name="qrcode" className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mt-auto">
        {desk.status === DeskStatus.Available && (
          <button onClick={onBook} className="w-full bg-brand-primary text-white font-semibold py-2 px-4 rounded-lg hover:bg-brand-dark transition-colors duration-300">
            Book Now
          </button>
        )}
        {desk.status === DeskStatus.Occupied && (
          <button onClick={handleEndBooking} className="w-full bg-status-occupied text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-300">
            End Session
          </button>
        )}
      </div>
    </div>
  );
};

export default DeskCard;