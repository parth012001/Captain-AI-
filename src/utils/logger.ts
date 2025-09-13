/**
 * Professional Logging System
 * Production-grade logging with proper levels and formatting
 */

import { env } from '../config/environment';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

const LOG_LEVEL_NAMES = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR'
};

const LOG_LEVEL_COLORS = {
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[32m',  // Green
  [LogLevel.WARN]: '\x1b[33m',  // Yellow
  [LogLevel.ERROR]: '\x1b[31m'  // Red
};

const RESET_COLOR = '\x1b[0m';

class Logger {
  private currentLogLevel: LogLevel;
  private enableColors: boolean;
  private initialized = false;

  constructor() {
    // Initialize with safe defaults - will be updated when environment is available
    this.currentLogLevel = LogLevel.INFO;
    this.enableColors = true;
  }

  private ensureInitialized() {
    if (!this.initialized && typeof env !== 'undefined') {
      // Set log level based on environment
      const levelMap = {
        'debug': LogLevel.DEBUG,
        'info': LogLevel.INFO,
        'warn': LogLevel.WARN,
        'error': LogLevel.ERROR
      };
      
      this.currentLogLevel = levelMap[env.LOG_LEVEL || 'info'];
      this.enableColors = env.NODE_ENV !== 'production';
      this.initialized = true;
    }
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    const color = this.enableColors ? LOG_LEVEL_COLORS[level] : '';
    const reset = this.enableColors ? RESET_COLOR : '';
    
    let formattedMessage = `${color}[${timestamp}] ${levelName}:${reset} ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        formattedMessage += '\n' + JSON.stringify(data, null, 2);
      } else {
        formattedMessage += ` ${data}`;
      }
    }
    
    return formattedMessage;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    this.ensureInitialized();
    
    if (level < this.currentLogLevel) {
      return; // Skip if below current log level
    }

    const formattedMessage = this.formatMessage(level, message, data);
    
    if (level >= LogLevel.ERROR) {
      console.error(formattedMessage);
    } else if (level >= LogLevel.WARN) {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  // Service-specific logging helpers
  service(serviceName: string, message: string, data?: any): void {
    this.info(`[${serviceName}] ${message}`, data);
  }

  database(message: string, data?: any): void {
    this.debug(`[DATABASE] ${message}`, data);
  }

  webhook(message: string, data?: any): void {
    this.info(`[WEBHOOK] ${message}`, data);
  }

  auth(message: string, data?: any): void {
    this.info(`[AUTH] ${message}`, data);
  }

  email(message: string, data?: any): void {
    this.info(`[EMAIL] ${message}`, data);
  }

  ai(message: string, data?: any): void {
    this.info(`[AI] ${message}`, data);
  }

  // Performance logging
  performance(operation: string, startTime: number, additionalData?: any): void {
    const duration = Date.now() - startTime;
    this.info(`[PERFORMANCE] ${operation} completed in ${duration}ms`, additionalData);
  }

  // Health check logging
  health(component: string, status: 'healthy' | 'unhealthy', details?: any): void {
    const level = status === 'healthy' ? LogLevel.INFO : LogLevel.WARN;
    this.log(level, `[HEALTH] ${component}: ${status}`, details);
  }
}

// Global logger instance
export const logger = new Logger();

// Convenience function for performance measurement
export function measurePerformance<T>(
  operation: string, 
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    try {
      const result = await fn();
      logger.performance(operation, startTime);
      resolve(result);
    } catch (error) {
      logger.performance(operation, startTime, { error: true });
      logger.error(`${operation} failed`, error);
      reject(error);
    }
  });
}