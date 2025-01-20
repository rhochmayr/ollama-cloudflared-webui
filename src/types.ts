export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  user_id: string;
}

export interface Model {
  name: string;
  modified_at: string;
  size: number;
}

export interface OllamaInstance {
  id: string;
  status: 'requested' | 'starting' | 'ready' | 'error' | 'retired';
  endpoint?: string;
  error?: string;
  last_active?: string;
  health_status?: 'healthy' | 'unhealthy' | 'unknown';
}

export interface ErrorDetails {
  message: string;
  name: string;
  stack?: string;
}

export interface ErrorLog {
  message: string;
  details?: {
    endpoint?: string;
    model?: string;
    input?: string;
    error?: ErrorDetails | string;
    [key: string]: any;
  };
}

export interface EndpointHealth {
  isConnected: boolean;
  lastChecked: string;
  responseTime?: number;
  consecutiveFailures?: number;
  isInGracePeriod?: boolean;
  gracePeriodRemaining?: number;
  metrics?: {
    totalRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  };
}