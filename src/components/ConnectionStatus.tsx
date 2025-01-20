import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { endpointManager } from '../lib/endpoint';
import type { EndpointHealth } from '../types';

interface ConnectionStatusProps {
  endpoint: string;
}

export function ConnectionStatus({ endpoint }: ConnectionStatusProps) {
  const [health, setHealth] = useState<EndpointHealth | null>(null);

  useEffect(() => {
    if (!endpoint) {
      setHealth(null);
      return;
    }

    // Initial health state
    setHealth(endpointManager.getHealth(endpoint));

    // Subscribe to health updates
    const unsubscribe = endpointManager.subscribe(() => {
      const currentHealth = endpointManager.getHealth(endpoint);
      setHealth(currentHealth);
    });

    return () => unsubscribe();
  }, [endpoint]);

  if (!endpoint || !health) return null;

  // Simple connected/disconnected status
  return (
    <div className="flex items-center space-x-2">
      {health.isConnected ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-600">Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-600">Disconnected</span>
        </>
      )}
    </div>
  );
}