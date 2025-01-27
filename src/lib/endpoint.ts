import { debounce } from './utils';
import { supabase } from './supabase';
import type { EndpointHealth } from '../types';

const HEALTH_CHECK_INTERVAL = 3000; // 3 seconds
const HEALTH_CHECK_TIMEOUT = 1000; // 1 second timeout
const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const DNS_RESOLUTION_DELAY = 5000; // 5 seconds for DNS resolution
const MAX_CONSECUTIVE_FAILURES = 5; // Maximum number of consecutive failures before marking endpoint as error

class EndpointManager {
  private healthChecks: Map<string, EndpointHealth> = new Map();
  private checkIntervals: Map<string, number> = new Map();
  private metrics: Map<string, { requests: number; failures: number; totalTime: number }> = new Map();
  private listeners: Set<() => void> = new Set();
  private activeChecks: Map<string, Promise<boolean>> = new Map();
  private monitoringRefs: Map<string, number> = new Map();
  private endpointStartTimes: Map<string, number> = new Map();
  private isPaused: boolean = false;
  private consecutiveFailures: Map<string, number> = new Map();
  private isErrorState: Map<string, boolean> = new Map();

  private async updateInstanceStatus(endpoint: string, status: 'error', errorMessage: string) {
    try {
      const { error } = await supabase
        .from('ollama_instances')
        .update({ 
          status: status,
          error: errorMessage
        })
        .eq('endpoint', endpoint);

      if (error) throw error;
    } catch (error) {
      // Log error but don't throw - we don't want to break the health check flow
      console.warn('Failed to update instance status:', 
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  pause() {
    this.isPaused = true;
    // Clear all existing intervals
    this.checkIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.checkIntervals.clear();
    this.notifyListeners();
  }

  resume() {
    this.isPaused = false;
    // Restart monitoring for all endpoints that have refs
    this.monitoringRefs.forEach((_, endpoint) => {
      this.startMonitoringInterval(endpoint);
    });
    this.notifyListeners();
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  async checkEndpointHealth(endpoint: string): Promise<boolean> {
    if (this.isPaused) {
      return false;
    }

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
          this.handleFailure(endpoint);
        }

        this.recordRequest(endpoint, isHealthy, responseTime);
        this.updateHealthStatus(endpoint, isHealthy, responseTime);

        return isHealthy;
      } catch (error) {
        if (error instanceof TypeError) {
          console.warn('Network error during health check:', error);
        } else if (error.name === 'AbortError') {
          console.warn(`Health check timed out after ${HEALTH_CHECK_TIMEOUT}ms`);
        } else {
          console.error('Health check failed:', error);
        }

        this.handleFailure(endpoint);
        
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

  private async handleFailure(endpoint: string) {
    const failures = (this.consecutiveFailures.get(endpoint) || 0) + 1;
    this.consecutiveFailures.set(endpoint, failures);

    // If we've reached max failures and haven't marked as error yet
    if (failures >= MAX_CONSECUTIVE_FAILURES && !this.isErrorState.get(endpoint)) {
      this.isErrorState.set(endpoint, true);
      
      // Pause health checks
      this.pause();
      
      // Stop monitoring this endpoint
      this.stopMonitoring(endpoint);
      
      // Update the instance status in the database
      await this.updateInstanceStatus(endpoint, 'error', 
        `Endpoint failed health check ${MAX_CONSECUTIVE_FAILURES} times consecutively`
      );
    }
  }

  private updateHealthStatus(endpoint: string, isConnected: boolean, responseTime?: number) {
    const metrics = this.metrics.get(endpoint);
    const startTime = this.endpointStartTimes.get(endpoint);
    const isWaitingForDNS = startTime && (Date.now() - startTime) < DNS_RESOLUTION_DELAY;
    
    const newHealth: EndpointHealth = {
      isConnected: isConnected,
      lastChecked: new Date().toISOString(),
      responseTime,
      isWaitingForDNS,
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

  startMonitoring(endpoint: string, isNewEndpoint: boolean = false, delayStart: boolean = false) {
    if (!endpoint) return;

    // Increment reference count
    const refCount = (this.monitoringRefs.get(endpoint) || 0) + 1;
    this.monitoringRefs.set(endpoint, refCount);

    // If this endpoint is already being monitored, just return
    // If this endpoint is already being monitored and we're not paused, just return
    if (refCount > 1) {
      if (!this.isPaused) {
      return;
      }
    }

    // Start new monitoring
    if (delayStart) {
      // Wait for DNS resolution before starting health checks
      this.endpointStartTimes.set(endpoint, Date.now());
      this.updateHealthStatus(endpoint, false, undefined);
      
      setTimeout(() => {
        if (!this.isPaused) {
          this.endpointStartTimes.delete(endpoint);
          this.startMonitoringInterval(endpoint);
        }
      }, DNS_RESOLUTION_DELAY);
    } else if (!this.isPaused) {
      this.startMonitoringInterval(endpoint);
    }
  }

  private startMonitoringInterval(endpoint: string) {
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

    // Clear error state when stopping monitoring
    this.isErrorState.delete(endpoint);
    this.consecutiveFailures.delete(endpoint);

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
    this.endpointStartTimes.delete(endpoint);
    this.notifyListeners();
    
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
    this.activeChecks.clear();
    this.consecutiveFailures.clear();
    this.isErrorState.clear();
    this.monitoringRefs.clear();
    this.endpointStartTimes.clear();
    this.isPaused = false;
  }
}

export const endpointManager = new EndpointManager();