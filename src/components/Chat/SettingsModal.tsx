import React from 'react';
import { AlertCircle, Loader2, Clock, Activity } from 'lucide-react';
import { endpointManager } from '../../lib/endpoint';
import type { Model } from '../../types';
import { formatFileSize } from '../../lib/utils';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  endpoint: string;
  onEndpointChange: (endpoint: string) => void;
  onRefreshModels: () => void;
  models: Model[];
  selectedModel: string;
  onModelSelect: (model: string) => void;
  error: string | null;
  loading: boolean;
}

export function SettingsModal({
  show,
  onClose,
  onSave,
  endpoint,
  models,
  selectedModel,
  onModelSelect,
  error,
  loading
}: SettingsModalProps) {
  if (!show) return null;

  const health = endpoint ? endpointManager.getHealth(endpoint) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Model Selection</h2>
        
        {endpoint && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Current Endpoint</span>
              {health && (
                <div className="flex items-center space-x-2 text-sm">
                  {health.isConnected ? (
                    <span className="text-green-600">Connected</span>
                  ) : (
                    <span className="text-red-600">Disconnected</span>
                  )}
                  {health.responseTime && (
                    <div className="flex items-center text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {Math.round(health.responseTime)}ms
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-500 break-all">{endpoint}</div>
          </div>
        )}

        {models.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Available Models</span>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            </div>
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-200">
              {models.map((model) => (
                <button
                  key={model.name}
                  onClick={() => onModelSelect(model.name)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between ${
                    selectedModel === model.name ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                  }`}
                >
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-sm text-gray-500">
                      Size: {formatFileSize(model.size)}
                    </div>
                  </div>
                  {selectedModel === model.name && (
                    <Activity className="h-4 w-4 text-indigo-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && health?.isConnected && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Close
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
