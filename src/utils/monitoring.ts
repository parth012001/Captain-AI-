/**
 * Basic Monitoring and Metrics Collection
 * Simple metrics collection for production monitoring
 */

import { env } from '../config/environment';
import { logger } from './logger';

interface MetricData {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

interface SystemMetrics {
  requests: {
    total: number;
    byStatus: Record<number, number>;
    byEndpoint: Record<string, number>;
  };
  performance: {
    averageResponseTime: number;
    slowQueries: MetricData[];
  };
  errors: {
    total: number;
    recent: Array<{
      timestamp: number;
      error: string;
      endpoint: string;
    }>;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    lastHealthCheck: number;
  };
}

class MonitoringService {
  private metrics: SystemMetrics;
  private requestTimes: number[] = [];
  private readonly MAX_SLOW_QUERIES = 10;
  private readonly MAX_RECENT_ERRORS = 20;

  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byStatus: {},
        byEndpoint: {}
      },
      performance: {
        averageResponseTime: 0,
        slowQueries: []
      },
      errors: {
        total: 0,
        recent: []
      },
      system: {
        uptime: 0,
        memoryUsage: process.memoryUsage(),
        lastHealthCheck: Date.now()
      }
    };

    // Update system metrics periodically
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Record a request
   */
  recordRequest(endpoint: string, statusCode: number, responseTime: number): void {
    this.metrics.requests.total++;
    
    // Track by status code
    this.metrics.requests.byStatus[statusCode] = 
      (this.metrics.requests.byStatus[statusCode] || 0) + 1;
    
    // Track by endpoint
    this.metrics.requests.byEndpoint[endpoint] = 
      (this.metrics.requests.byEndpoint[endpoint] || 0) + 1;

    // Track response times
    this.requestTimes.push(responseTime);
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-500); // Keep last 500
    }

    // Record slow queries
    if (responseTime > 5000) { // Slower than 5 seconds
      this.recordSlowQuery(endpoint, responseTime);
    }

    // Update average response time
    this.updateAverageResponseTime();
  }

  /**
   * Record an error
   */
  recordError(error: string, endpoint: string): void {
    this.metrics.errors.total++;
    
    this.metrics.errors.recent.unshift({
      timestamp: Date.now(),
      error,
      endpoint
    });

    // Keep only recent errors
    if (this.metrics.errors.recent.length > this.MAX_RECENT_ERRORS) {
      this.metrics.errors.recent = this.metrics.errors.recent.slice(0, this.MAX_RECENT_ERRORS);
    }

    logger.error('Application error recorded', { error, endpoint });
  }

  /**
   * Record a slow query/operation
   */
  recordSlowQuery(operation: string, duration: number): void {
    this.metrics.performance.slowQueries.unshift({
      timestamp: Date.now(),
      value: duration,
      labels: { operation }
    });

    // Keep only recent slow queries
    if (this.metrics.performance.slowQueries.length > this.MAX_SLOW_QUERIES) {
      this.metrics.performance.slowQueries = this.metrics.performance.slowQueries.slice(0, this.MAX_SLOW_QUERIES);
    }

    logger.warn('Slow operation detected', { operation, duration: `${duration}ms` });
  }

  /**
   * Get current metrics
   */
  getMetrics(): SystemMetrics {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    healthy: boolean;
    issues: string[];
    metrics: Partial<SystemMetrics>;
  } {
    const issues: string[] = [];
    const recentErrors = this.metrics.errors.recent.filter(
      e => Date.now() - e.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );

    // Check for issues
    if (recentErrors.length > 10) {
      issues.push(`High error rate: ${recentErrors.length} errors in last 5 minutes`);
    }

    if (this.metrics.performance.averageResponseTime > 2000) {
      issues.push(`High response time: ${this.metrics.performance.averageResponseTime}ms average`);
    }

    const memoryUsageMB = this.metrics.system.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 1024) {
      issues.push(`High memory usage: ${Math.round(memoryUsageMB)}MB`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics: {
        requests: this.metrics.requests,
        errors: {
          total: this.metrics.errors.total,
          recent: recentErrors
        },
        performance: this.metrics.performance,
        system: this.metrics.system
      }
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.metrics = {
      requests: { total: 0, byStatus: {}, byEndpoint: {} },
      performance: { averageResponseTime: 0, slowQueries: [] },
      errors: { total: 0, recent: [] },
      system: {
        uptime: 0,
        memoryUsage: process.memoryUsage(),
        lastHealthCheck: Date.now()
      }
    };
    this.requestTimes = [];
  }

  private updateAverageResponseTime(): void {
    if (this.requestTimes.length === 0) {
      this.metrics.performance.averageResponseTime = 0;
      return;
    }

    const sum = this.requestTimes.reduce((a, b) => a + b, 0);
    this.metrics.performance.averageResponseTime = Math.round(sum / this.requestTimes.length);
  }

  private updateSystemMetrics(): void {
    this.metrics.system.uptime = Math.floor(process.uptime());
    this.metrics.system.memoryUsage = process.memoryUsage();
    this.metrics.system.lastHealthCheck = Date.now();
  }
}

// Global monitoring instance
export const monitoring = new MonitoringService();

/**
 * Express middleware for monitoring
 */
export function monitoringMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(chunk?: any) {
      const responseTime = Date.now() - startTime;
      monitoring.recordRequest(req.route?.path || req.path, res.statusCode, responseTime);
      originalEnd.call(this, chunk);
    };

    next();
  };
}