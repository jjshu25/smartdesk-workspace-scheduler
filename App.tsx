
import React, { useState, useEffect } from 'react';
import { Desk, DeskStatus, User, Booking } from './types';
import Header from './components/Header';
import DeskCard from './components/DeskCard';
import SchedulerModal from './components/SchedulerModal';
import OptimizerView from './components/OptimizerView';
import HistoryLog from './components/HistoryLog';

// --- MOCK DATA ---
const createInitialDesks = (): Desk[] =>
  Array.from({ length: 12 }, (_, i) => ({
    id: `D${101 + i}`,
    status: DeskStatus.Available,
    temperature: parseFloat((20 + Math.random() * 5).toFixed(1)),
    noiseLevel: Math.floor(30 + Math.random() * 20),
    isBeaconOn: false,
    isLocked: false,
    location: { row: Math.floor(i / 4) + 1, col: (i % 4) + 1 },
  }));

const createInitialUsers = (): User[] => [
  { id: 'u1', name: 'Kurt', team: 'Engineering' },
  { id: 'u2', name: 'Aiya', team: 'Design' },
  { id: 'u3', name: 'Cristine', team: 'Engineering' },
  { id: 'u4', name: 'Sedrick', team: 'Marketing' },
  { id: 'u5', name: 'Goku', team: 'Design' },
  { id: 'u6', name: 'Naruto', team: 'Engineering' },
  { id: 'u7', name: 'Sasuke', team: 'Design' },
];

// Helper to get data from localStorage
const getFromStorage = <T,>(key: string, defaultValue: T, reviver?: (key: any, value: any) => any): T => {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item, reviver) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage key “${key}”:`, error);
    return defaultValue;
  }
};

// Date reviver for JSON.parse
const dateReviver = (key: string, value: any) => {
  if (key === 'startTime' || key === 'endTime') {
    return new Date(value);
  }
  return value;
};


type View = 'dashboard' | 'optimizer' | 'history';

const App: React.FC = () => {
  const [desks, setDesks] = useState<Desk[]>(() => getFromStorage('smartdesk-desks', createInitialDesks()));
  const [users] = useState<User[]>(createInitialUsers);
  const [bookings, setBookings] = useState<Booking[]>(() => getFromStorage('smartdesk-bookings', [], dateReviver));
  const [history, setHistory] = useState<Booking[]>(() => getFromStorage('smartdesk-history', [], dateReviver));

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);

  // --- OFFLINE SUPPORT: Persist state to localStorage ---
  useEffect(() => {
    localStorage.setItem('smartdesk-desks', JSON.stringify(desks));
  }, [desks]);
  
  useEffect(() => {
    localStorage.setItem('smartdesk-bookings', JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    localStorage.setItem('smartdesk-history', JSON.stringify(history));
  }, [history]);

  // --- HARDWARE SIMULATION: Dynamic Sensor Data ---
  useEffect(() => {
    const interval = setInterval(() => {
      setDesks(prevDesks => prevDesks.map(desk => ({
        ...desk,
        temperature: parseFloat((desk.temperature + (Math.random() - 0.5) * 0.2).toFixed(1)),
        noiseLevel: Math.max(30, Math.min(60, desk.noiseLevel + Math.floor((Math.random() - 0.5) * 3))),
      })));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);


  const handleBookClick = (desk: Desk) => {
    setSelectedDesk(desk);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDesk(null);
  };

  const handleConfirmBooking = (deskId: string, userId: string, durationMinutes: number) => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    const newBooking: Booking = {
      id: `b${Date.now()}`,
      deskId,
      userId,
      startTime,
      endTime,
    };

    setBookings((prev) => [...prev, newBooking]);
    setDesks((prev) =>
      prev.map((d) =>
        d.id === deskId ? { ...d, status: DeskStatus.Occupied, isBeaconOn: true } : d
      )
    );
    
    // HARDWARE SIMULATION: Beacon turns off after 30 seconds
    setTimeout(() => {
        setDesks(prev => prev.map(d => d.id === deskId ? { ...d, isBeaconOn: false } : d));
    }, 30000);

    handleCloseModal();
  };

  const handleEndBooking = (bookingId: string) => {
    const bookingToEnd = bookings.find(b => b.id === bookingId);
    if (!bookingToEnd) return;

    const endedBooking = { ...bookingToEnd, endTime: new Date() };

    setHistory(prev => [...prev, endedBooking]);
    setBookings(prev => prev.filter(b => b.id !== bookingId));
    setDesks(prev => prev.map(d => 
        // HARDWARE SIMULATION: Auto-lock desk after use
        d.id === endedBooking.deskId ? { ...d, status: DeskStatus.Available, isLocked: true } : d
    ));
  };

  const handleToggleLock = (deskId: string) => {
    setDesks(prev => prev.map(d => 
        d.id === deskId ? { ...d, isLocked: !d.isLocked } : d
    ));
  };

  const handleScanQR = (deskId: string) => {
    console.log(`Simulating QR scan for Desk ${deskId}`);
    alert(`QR code scanned for Desk ${deskId}. In a real app, this might auto-book or check-in.`);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-10">
      <Header 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        {currentView === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {desks.map((desk) => {
              const booking = bookings.find((b) => b.deskId === desk.id);
              const user = booking ? users.find((u) => u.id === booking.userId) : null;
              return (
                <DeskCard
                  key={desk.id}
                  desk={desk}
                  currentUser={user}
                  booking={booking || null}
                  onBook={() => handleBookClick(desk)}
                  onEndBooking={handleEndBooking}
                  onToggleLock={handleToggleLock}
                  onScanQR={handleScanQR}
                />
              );
            })}
          </div>
        )}
        {currentView === 'optimizer' && <OptimizerView desks={desks} users={users} />}
        {currentView === 'history' && <HistoryLog bookings={history} users={users} desks={desks} />}
      </main>
      {isModalOpen && selectedDesk && (
        <SchedulerModal
          desk={selectedDesk}
          users={users}
          onClose={handleCloseModal}
          onConfirm={handleConfirmBooking}
          existingBookings={bookings.map(({ deskId, userId }) => ({ deskId, userId }))}
        />
      )}
    </div>
  );
};

export default App;
