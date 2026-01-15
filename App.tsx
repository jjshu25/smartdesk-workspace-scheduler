import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import PCMonitoringDashboard from './components/PCMonitoringDashboard';
import HistoryLog from './components/HistoryLog';
import PCAutoDiscoveryService from './components/PCAutoDiscoveryService';

type View = 'pc-management' | 'optimizer' | 'history';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('pc-management');

  useEffect(() => {
    const initConnection = async () => {
      try {
        console.log('🔍 Initializing dashboard connection...');
        await PCAutoDiscoveryService.connectToDashboard('http://localhost:5000');
        console.log('✅ Dashboard connected successfully');
      } catch (error) {
        console.error('❌ Failed to connect:', error);
      }
    };

    initConnection();

    return () => {
      PCAutoDiscoveryService.disconnect();
    };
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen pb-10">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        {currentView === 'pc-management' && <PCMonitoringDashboard />}
        {currentView === 'history' && <HistoryLog />}
      </main>
    </div>
  );
};

export default App;
