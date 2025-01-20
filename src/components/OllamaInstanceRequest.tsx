import React, { useState } from 'react';
import { Loader2, Server, AlertCircle } from 'lucide-react';
import { useChatStore } from '../lib/store';
import { endpointManager } from '../lib/endpoint';
import { DockerCommandModal } from './DockerCommandModal';
import type { OllamaInstance } from '../types';

interface StatusDisplayProps {
  instance: OllamaInstance;
  onRetry: () => void;
}

function StatusDisplay({ instance, onRetry }: StatusDisplayProps) {
  const health = instance.endpoint ? endpointManager.getHealth(instance.endpoint) : null;

  switch (instance.status) {
    case 'requested':
      return (
        <div className="flex items-center space-x-2 text-indigo-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Requested Ollama instance...</span>
        </div>
      );
    case 'starting':
      return (
        <div className="flex items-center space-x-2 text-indigo-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Starting Ollama instance...</span>
        </div>
      );
    case 'ready':
      if (health?.isInGracePeriod) {
        const remainingSeconds = Math.ceil((health.gracePeriodRemaining || 0) / 1000);
        return (
          <div className="flex items-center space-x-2 text-indigo-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Connecting to Ollama instance... ({remainingSeconds}s)</span>
          </div>
        );
      }
      return null;
    case 'error':
      return (
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-600">{instance.error || 'Failed to start instance'}</span>
          <button
            onClick={onRetry}
            className="ml-2 px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      );
    default:
      return null;
  }
}

export function OllamaInstanceRequest() {
  const { ollamaInstance, requestOllamaInstance, ollamaEndpoint } = useChatStore();
  const [showCommandModal, setShowCommandModal] = useState(false);
  const health = ollamaEndpoint ? endpointManager.getHealth(ollamaEndpoint) : null;

  const handleRequestInstance = () => {
    setShowCommandModal(true);
    requestOllamaInstance();
  };

  // Show status display during grace period even if instance is 'ready'
  const shouldShowStatus = ollamaInstance && (
    ollamaInstance.status !== 'ready' || 
    (health?.isInGracePeriod && ollamaInstance.endpoint === ollamaEndpoint)
  );

  // Only show request button if no instance or connection failed after grace period
  const shouldShowRequestButton = !ollamaEndpoint || 
    (health && !health.isConnected && !health.isInGracePeriod);

  return (
    <>
      {shouldShowStatus ? (
        <StatusDisplay
          instance={ollamaInstance}
          onRetry={requestOllamaInstance}
        />
      ) : shouldShowRequestButton ? (
        <button
          onClick={handleRequestInstance}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Server className="h-5 w-5 mr-2" />
          Request Ollama Instance
        </button>
      ) : health?.isConnected ? (
        <div className="flex items-center space-x-2 text-green-600">
          <Server className="h-5 w-5" />
          <span>Connected to Ollama at: {ollamaEndpoint}</span>
        </div>
      ) : null}

      {ollamaInstance && (
        <DockerCommandModal
          show={showCommandModal}
          onClose={() => setShowCommandModal(false)}
          instanceId={ollamaInstance.id}
        />
      )}
    </>
  );
}