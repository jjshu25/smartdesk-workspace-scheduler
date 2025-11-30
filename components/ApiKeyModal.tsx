
import React, { useState } from 'react';
import Icon from './Icon';

interface ApiKeyModalProps {
  onSave: (apiKey: string) => void;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, onClose }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSave = () => {
    if (apiKey.trim()) {
      onSave(apiKey.trim());
    }
  };
  
  const hasExistingKey = !!localStorage.getItem('gemini-api-key');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md transform transition-all">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Gemini API Key</h2>
           {!hasExistingKey && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <Icon name="x" className="w-6 h-6" />
            </button>
           )}
        </div>
        
        <p className="text-slate-600 mb-4">
          To use the AI Optimizer, please enter your Google Gemini API key.
          Your key will be saved securely in your browser's local storage.
        </p>

        <div className="space-y-6">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm rounded-md"
              placeholder="Enter your API key here"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-brand-primary font-semibold py-2 px-4 rounded-lg hover:bg-brand-primary/10 transition-colors duration-300 flex items-center"
          >
            Get a Key
          </a>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="bg-brand-primary text-white font-semibold py-2 px-6 rounded-lg hover:bg-brand-dark transition-colors duration-300 disabled:bg-slate-400"
          >
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
