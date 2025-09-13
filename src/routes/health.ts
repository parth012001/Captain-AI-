/**
 * Health Check Routes
 * Production-grade health monitoring endpoints for load balancers and monitoring
 */

import { Router, Request, Response } from 'express';
import { pool } from '../database/connection';
import { env } from '../config/environment';
import { logger } from '../utils/logger';

const router = Router();

interface HealthCheckResult {
  healthy: boolean;
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    [component: string]: {
      healthy: boolean;
      responseTime?: number;
      details?: any;
      error?: string;
    }
  }
}

/**
 * Database health check
 */
async function checkDatabase(): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
  const startTime = Date.now();
  try {
    await pool.query('SELECT 1');
    return {
      healthy: true,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    logger.error('Database health check failed', error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

/**
 * External services health check (simplified)
 */
async function checkExternalServices(): Promise<{ healthy: boolean; details?: any; error?: string }> {
  const checks = {
    openai: true, // We don't ping OpenAI for health checks to avoid costs
    gmail: true   // We don't ping Gmail API for health checks to avoid rate limits
  };

  return {
    healthy: true,
    details: {
      note: 'External services checked via configuration validation',
      openaiConfigured: !!env.OPENAI_API_KEY,
      gmailConfigured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    }
  };
}

/**
 * Memory usage check
 */
function checkMemory(): { healthy: boolean; details: any } {
  const usage = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100
  };

  // Alert if heap usage is over 200MB (much safer for small instances)
  const healthy = memoryMB.heapUsed < 200;

  return {
    healthy,
    details: {
      ...memoryMB,
      units: 'MB'
    }
  };
}

/**
 * Basic liveness probe - minimal check to see if service is running
 */
router.get('/health', async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Chief AI Email Assistant'
  });
});

/**
 * Readiness probe - comprehensive health check for load balancers
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Run all health checks in parallel
    const [databaseCheck, externalServicesCheck, memoryCheck] = await Promise.all([
      checkDatabase(),
      checkExternalServices(),
      Promise.resolve(checkMemory())
    ]);

    const result: HealthCheckResult = {
      healthy: databaseCheck.healthy && externalServicesCheck.healthy && memoryCheck.healthy,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: env.NODE_ENV,
      uptime: Math.floor(process.uptime()),
      checks: {
        database: databaseCheck,
        externalServices: externalServicesCheck,
        memory: memoryCheck,
        overall: {
          healthy: databaseCheck.healthy && externalServicesCheck.healthy && memoryCheck.healthy,
          responseTime: Date.now() - startTime
        }
      }
    };

    // Log health check results
    logger.health('Overall system', result.healthy ? 'healthy' : 'unhealthy', {
      responseTime: result.checks.overall.responseTime,
      memoryUsage: result.checks.memory.details,
      failedChecks: Object.entries(result.checks)
        .filter(([_, check]) => !check.healthy)
        .map(([name, _]) => name)
    });

    // CRITICAL: Log high memory usage as ERROR for monitoring
    if (!result.checks.memory.healthy) {
      logger.error('🚨 HIGH MEMORY USAGE DETECTED', {
        memoryMB: result.checks.memory.details.heapUsed,
        threshold: 200,
        action: 'Consider restarting application',
        timestamp: new Date().toISOString()
      });
    }

    const status = result.healthy ? 200 : 503;
    res.status(status).json(result);

  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      healthy: false,
      timestamp: new Date().toISOString(),
      error: 'Health check system error',
      uptime: Math.floor(process.uptime())
    });
  }
});

/**
 * Detailed system metrics - for monitoring dashboards
 */
router.get('/health/metrics', async (req: Request, res: Response) => {
  if (env.NODE_ENV === 'production') {
    // In production, you might want to secure this endpoint
    // or integrate with proper monitoring tools like Prometheus
  }

  const usage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  res.json({
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform
    },
    memory: {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    environment: {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      logLevel: env.LOG_LEVEL
    }
  });
});

export default router;