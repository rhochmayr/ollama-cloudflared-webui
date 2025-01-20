import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { ConnectionStatus } from '../ConnectionStatus';
import { endpointManager } from '../../lib/endpoint';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  loading: boolean;
  disabled: boolean;
  placeholder: string;
  endpoint: string;
}

export function ChatInput({ onSubmit, loading, disabled, placeholder, endpoint }: ChatInputProps) {
  const [input, setInput] = useState('');
  const health = endpoint ? endpointManager.getHealth(endpoint) : null;
  const isDisconnected = !health?.isConnected;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || disabled || isDisconnected) return;
    onSubmit(input);
    setInput('');
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex-shrink-0 mb-2">
          <ConnectionStatus endpoint={endpoint} showTimer={false} />
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isDisconnected ? "Disconnected from Ollama" : placeholder}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
            disabled={loading || disabled || isDisconnected}
          />
          <button
            type="submit"
            disabled={loading || disabled || isDisconnected || !input.trim()}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white 
              ${loading || disabled || isDisconnected || !input.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
          >
            {loading ? (
              'Sending...'
            ) : (
              <>
                Send
                <Send className="ml-2 h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}