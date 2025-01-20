import { debounce } from './utils';
import type { EndpointHealth } from '../types';

const HEALTH_CHECK_INTERVAL = 3000; // 3 seconds
const HEALTH_CHECK_TIMEOUT = 1000; // 1 second timeout
const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const MAX_CONSECUTIVE_FAILURES = 3; // Number of failures before marking as disconnected
const NEW_ENDPOINT_GRACE_PERIOD = 2 * 60 * 1000; // 2 minutes grace period for new endpoints

class EndpointManager {
  private healthChecks: Map<string, EndpointHealth> = new Map();
  private checkIntervals: Map<string, number> = new Map();
  private metrics: Map<string, { requests: number; failures: number; totalTime: number }> = new Map();
  private listeners: Set<() => void> = new Set();
  private consecutiveFailures: Map<string, number> = new Map();
  private activeChecks: Map<string, Promise<boolean>> = new Map();
  private monitoringRefs: Map<string, number> = new Map();
  private endpointStartTimes: Map<string, number> = new Map();

  async checkEndpointHealth(endpoint: string): Promise<boolean> {
    if (!endpoint) return false;

    // If there's already an active check for this endpoint, return that promise
    const activeCheck = this.activeChecks.get(endpoint);
    if (activeCheck) {
      return activeCheck;
    }

    // Create a new health check promise
    const checkPromise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      try {
        const startTime = performance.now();
        const response = await fetch('/api/proxy/models', {
          headers: {
            'X-Ollama-Endpoint': endpoint
          },
          signal: controller.signal
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        const isHealthy = response.ok;
        
        if (isHealthy) {
          this.consecutiveFailures.set(endpoint, 0);
        } else {
          this.incrementFailures(endpoint);
        }
        
        this.recordRequest(endpoint, isHealthy, responseTime);
        this.updateHealthStatus(endpoint, isHealthy, responseTime);

        return isHealthy;
      } catch (error) {
        this.incrementFailures(endpoint);
        
        if (error instanceof TypeError) {
          console.warn('Network error during health check:', error);
        } else if (error.name === 'AbortError') {
          console.warn(`Health check timed out after ${HEALTH_CHECK_TIMEOUT}ms`);
        } else {
          console.error('Health check failed:', error);
        }
        
        this.recordRequest(endpoint, false, 0);
        this.updateHealthStatus(endpoint, false, undefined);
        return false;
      } finally {
        clearTimeout(timeoutId);
        this.activeChecks.delete(endpoint);
      }
    })();

    this.activeChecks.set(endpoint, checkPromise);
    return checkPromise;
  }

  private incrementFailures(endpoint: string) {
    const current = this.consecutiveFailures.get(endpoint) || 0;
    this.consecutiveFailures.set(endpoint, current + 1);
  }

  private updateHealthStatus(endpoint: string, isConnected: boolean, responseTime?: number) {
    const metrics = this.metrics.get(endpoint);
    const failures = this.consecutiveFailures.get(endpoint) || 0;
    const startTime = this.endpointStartTimes.get(endpoint);
    const isInGracePeriod = startTime && (Date.now() - startTime) < NEW_ENDPOINT_GRACE_PERIOD;
    
    // Only consider connected if we have a successful health check
    const actuallyConnected = isConnected;
    
    const newHealth: EndpointHealth = {
      isConnected: actuallyConnected,
      lastChecked: new Date().toISOString(),
      responseTime,
      consecutiveFailures: failures,
      isInGracePeriod,
      gracePeriodRemaining: isInGracePeriod ? NEW_ENDPOINT_GRACE_PERIOD - (Date.now() - startTime!) : 0,
      metrics: metrics ? {
        totalRequests: metrics.requests,
        failedRequests: metrics.failures,
        averageResponseTime: metrics.requests > 0 ? metrics.totalTime / metrics.requests : 0
      } : undefined
    };

    this.healthChecks.set(endpoint, newHealth);
    this.notifyListeners();
  }

  private notifyListeners = debounce(() => {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in health check listener:', error);
      }
    });
  }, 100);

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  startMonitoring(endpoint: string, isNewEndpoint: boolean = false) {
    if (!endpoint) return;

    // Increment reference count
    const refCount = (this.monitoringRefs.get(endpoint) || 0) + 1;
    this.monitoringRefs.set(endpoint, refCount);

    // If this endpoint is already being monitored, just return
    if (refCount > 1) {
      return;
    }

    // For new endpoints, start the grace period and initialize as disconnected
    if (isNewEndpoint) {
      this.endpointStartTimes.set(endpoint, Date.now());
      this.updateHealthStatus(endpoint, false, undefined);
    }

    // Start new monitoring
    this.consecutiveFailures.set(endpoint, 0);

    // Perform initial health check
    this.checkEndpointHealth(endpoint).catch(error => {
      console.error('Failed to perform initial health check:', error);
    });

    // Set up interval for periodic checks
    const intervalId = window.setInterval(() => {
      if (!this.activeChecks.has(endpoint)) {
        this.checkEndpointHealth(endpoint).catch(error => {
          console.error('Failed to perform periodic health check:', error);
        });
      }
    }, HEALTH_CHECK_INTERVAL);
    
    this.checkIntervals.set(endpoint, intervalId);
  }

  stopMonitoring(endpoint: string) {
    if (!endpoint) return;

    // Decrement reference count
    const refCount = (this.monitoringRefs.get(endpoint) || 1) - 1;
    
    if (refCount > 0) {
      this.monitoringRefs.set(endpoint, refCount);
      return;
    }

    // Clean up when no more references
    this.monitoringRefs.delete(endpoint);
    const intervalId = this.checkIntervals.get(endpoint);
    if (intervalId) {
      clearInterval(intervalId);
      this.checkIntervals.delete(endpoint);
    }

    // Clear all related data
    this.healthChecks.delete(endpoint);
    this.metrics.delete(endpoint);
    this.consecutiveFailures.delete(endpoint);
    this.endpointStartTimes.delete(endpoint);
    
    // Cancel any active check
    const activeCheck = this.activeChecks.get(endpoint);
    if (activeCheck) {
      this.activeChecks.delete(endpoint);
    }
  }

  getHealth(endpoint: string): EndpointHealth | null {
    return endpoint ? this.healthChecks.get(endpoint) || null : null;
  }

  private recordRequest(endpoint: string, success: boolean, responseTime: number) {
    const current = this.metrics.get(endpoint) || { requests: 0, failures: 0, totalTime: 0 };
    this.metrics.set(endpoint, {
      requests: current.requests + 1,
      failures: current.failures + (success ? 0 : 1),
      totalTime: current.totalTime + (success ? responseTime : 0)
    });
  }

  isEndpointRetired(lastActiveTime: string): boolean {
    try {
      const lastActive = new Date(lastActiveTime).getTime();
      return Date.now() - lastActive > INACTIVITY_THRESHOLD;
    } catch (error) {
      console.error('Failed to check endpoint retirement:', error);
      return false;
    }
  }

  cleanup() {
    // Clear all intervals
    this.checkIntervals.forEach(intervalId => clearInterval(intervalId));
    
    // Clear all maps
    this.checkIntervals.clear();
    this.healthChecks.clear();
    this.metrics.clear();
    this.listeners.clear();
    this.consecutiveFailures.clear();
    this.activeChecks.clear();
    this.monitoringRefs.clear();
    this.endpointStartTimes.clear();
  }
}

export const endpointManager = new EndpointManager();