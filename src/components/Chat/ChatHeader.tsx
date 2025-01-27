import React from 'react';
import { Bot, Settings, Trash2 } from 'lucide-react';
import { OllamaInstanceRequest } from '../OllamaInstanceRequest';
import { endpointManager } from '../../lib/endpoint';
import { useChatStore } from '../../lib/store';

interface ChatHeaderProps {
  selectedModel: string;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onClearChat: () => void;
}

export function ChatHeader({ selectedModel, onOpenSettings, onSignOut, onClearChat }: ChatHeaderProps) {
  const { ollamaEndpoint } = useChatStore();
  const health = ollamaEndpoint ? endpointManager.getHealth(ollamaEndpoint) : null;
  const showInstanceRequest = !ollamaEndpoint || (health && !health.isConnected);

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Bot className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-semibold text-gray-900">Lily Chat</h1>
            {selectedModel && (
              <span className="ml-2 px-2 py-1 text-sm bg-indigo-100 text-indigo-800 rounded-md">
                {selectedModel}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={onClearChat}
              className="p-2 text-gray-600 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md"
              title="Clear chat history"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={onSignOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
            >
              Sign out
            </button>
          </div>
        </div>
        {showInstanceRequest && (
          <div className="flex justify-center mt-4">
            <OllamaInstanceRequest />
          </div>
        )}
      </div>
    </header>
  );
}