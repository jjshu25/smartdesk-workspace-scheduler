import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import PCMonitoringDashboard from './components/PCMonitoringDashboard';
import OptimizerView from './components/OptimizerView';
import HistoryLog from './components/HistoryLog';

type View = 'pc-management' | 'optimizer' | 'history';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('pc-management');

  return (
    <div className="bg-slate-50 min-h-screen pb-10">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        {currentView === 'pc-management' && <PCMonitoringDashboard />}
        {currentView === 'optimizer' && <OptimizerView />}
        {currentView === 'history' && <HistoryLog />}
      </main>
    </div>
  );
};

export default App;
