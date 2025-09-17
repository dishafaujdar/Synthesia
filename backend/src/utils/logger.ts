import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from './config';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, correlationId, userId, service, ...meta }) => {
    const logEntry: any = {
      timestamp,
      level,
      message,
      service: service || config.monitoring.otelServiceName,
    };
    
    if (correlationId) {
      logEntry.correlationId = correlationId;
    }
    
    if (userId) {
      logEntry.userId = userId;
    }
    
    if (Object.keys(meta).length > 0) {
      logEntry.meta = meta;
    }
    
    return JSON.stringify(logEntry);
  })
);

// Create transports based on environment
const transports: winston.transport[] = [];

// Console transport for development
if (config.nodeEnv === 'development') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, correlationId }) => {
          const correlation = correlationId ? ` [${correlationId}]` : '';
          return `${timestamp} ${level}${correlation}: ${message}`;
        })
      ),
    })
  );
}

// File transports for production
if (config.nodeEnv === 'production') {
  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );

  // Combined logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );

  // Access logs for API requests
  transports.push(
    new DailyRotateFile({
      filename: 'logs/access-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxSize: '50m',
      maxFiles: '30d',
      zippedArchive: true,
      level: 'http',
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: config.monitoring.logLevel,
  format: logFormat,
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: config.nodeEnv === 'production' ? [
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  ] : [],
  rejectionHandlers: config.nodeEnv === 'production' ? [
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  ] : [],
});

// Add custom log level for HTTP access logs
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  http: 'magenta',
  debug: 'green',
});

// Structured logging helper functions
export const createLogger = (service?: string) => {
  const childLogger = logger.child({ service });
  
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      childLogger.debug(message, meta),
    
    info: (message: string, meta?: Record<string, unknown>) =>
      childLogger.info(message, meta),
    
    warn: (message: string, meta?: Record<string, unknown>) =>
      childLogger.warn(message, meta),
    
    error: (message: string, error?: Error, meta?: Record<string, unknown>) =>
      childLogger.error(message, { error, ...meta }),
    
    http: (message: string, meta?: Record<string, unknown>) =>
      childLogger.http(message, meta),
    
    // Context-aware logging
    withContext: (context: { correlationId?: string; userId?: string; requestId?: string }) => ({
      debug: (message: string, meta?: Record<string, unknown>) =>
        childLogger.debug(message, { ...context, ...meta }),
      
      info: (message: string, meta?: Record<string, unknown>) =>
        childLogger.info(message, { ...context, ...meta }),
      
      warn: (message: string, meta?: Record<string, unknown>) =>
        childLogger.warn(message, { ...context, ...meta }),
      
      error: (message: string, error?: Error, meta?: Record<string, unknown>) =>
        childLogger.error(message, { error, ...context, ...meta }),
      
      http: (message: string, meta?: Record<string, unknown>) =>
        childLogger.http(message, { ...context, ...meta }),
    }),
  };
};

// Default logger instance
export default createLogger();

// Performance logging utility
export const performanceLogger = {
  start: (operation: string, context?: Record<string, unknown>) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    return {
      end: (additionalContext?: Record<string, unknown>) => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        logger.info('Performance measurement', {
          operation,
          duration: `${duration.toFixed(2)}ms`,
          memoryUsage: {
            heapUsed: `${Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024 * 100) / 100}MB`,
            external: `${Math.round((endMemory.external - startMemory.external) / 1024 / 1024 * 100) / 100}MB`,
          },
          ...context,
          ...additionalContext,
        });
        
        return duration;
      },
    };
  },
};

// Audit logging for security events
export const auditLogger = createLogger('audit');

// System health logging
export const healthLogger = createLogger('health');

// Job processing logging
export const jobLogger = createLogger('jobs');
