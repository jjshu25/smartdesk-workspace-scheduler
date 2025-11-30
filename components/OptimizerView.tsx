
import React, { useState, useCallback } from 'react';
import { Desk, User } from '../types';
import { optimizeSeatArrangement } from '../services/geminiService';

interface OptimizerViewProps {
  desks: Desk[];
  users: User[];
}

interface ArrangementResult {
  arrangement: { userId: string, deskId: string }[];
  explanation: string;
}

const OptimizerView: React.FC<OptimizerViewProps> = ({ desks, users }) => {
  const [constraints, setConstraints] = useState<string>('Team "Engineering" needs to sit together near the windows (low column numbers).\nSasuke from team "Design" requires a quiet desk (low noise level).');
  const [result, setResult] = useState<ArrangementResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleOptimize = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await optimizeSeatArrangement(desks, users, constraints);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [desks, users, constraints]);

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.name || 'Unknown User';

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800 mb-6 border-b pb-4">Seat Arrangement Optimizer</h2>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="constraints" className="block text-lg font-medium text-slate-700 mb-2">Enter Constraints</label>
          <textarea
            id="constraints"
            rows={5}
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            className="w-full p-3 text-base border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-brand-secondary rounded-md shadow-sm"
            placeholder="e.g., Team A sits together, John needs a quiet spot..."
          />
        </div>
        <button
          onClick={handleOptimize}
          disabled={isLoading}
          className="w-full bg-brand-primary text-white font-semibold py-3 px-6 rounded-lg hover:bg-brand-dark transition-colors duration-300 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Optimizing...
            </>
          ) : 'Generate Optimal Arrangement'}
        </button>
      </div>

      {error && <div className="mt-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">{error}</div>}
      
      {result && (
        <div className="mt-8 pt-6 border-t">
          <h3 className="text-2xl font-bold text-slate-800 mb-4">Suggested Arrangement</h3>
          <p className="bg-brand-light text-brand-dark p-4 rounded-md mb-6">{result.explanation}</p>
          <ul className="space-y-2">
            {result.arrangement.map(item => (
              <li key={`${item.userId}-${item.deskId}`} className="p-3 bg-slate-50 rounded-md flex justify-between items-center">
                <span className="font-medium text-slate-700">{getUserName(item.userId)}</span>
                <span className="text-slate-500">→</span>
                <span className="font-medium text-slate-700">Desk {item.deskId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OptimizerView;