import { PrismaClient } from '@prisma/client';
import config from './config';
import logger from './logger';

// Extend Prisma client with custom functionality
class DatabaseClient extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: config.database.url,
        },
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Log database queries in development
    if (config.nodeEnv === 'development') {
      (this as any).$on('query', (e: any) => {
        logger.debug('Database query', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        });
      });
    }

    // Log database errors
    (this as any).$on('error', (e: any) => {
      logger.error('Database error', new Error(e.message));
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await (this as any).$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', error as Error);
      return false;
    }
  }

  async getConnectionCount(): Promise<number> {
    try {
      const result = await (this as any).$queryRaw`
        SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      ` as [{ count: bigint }];
      
      return Number(result[0].count);
    } catch (error) {
      logger.error('Failed to get database connection count', error as Error);
      return 0;
    }
  }

  async disconnect(): Promise<void> {
    await (this as any).$disconnect();
    logger.info('Database connection closed');
  }
}

// Create singleton database client
const db = new DatabaseClient();

// Graceful shutdown handler
const gracefulShutdown = async () => {
  logger.info('Closing database connection...');
  await db.disconnect();
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default db;

// Transaction utility with retry logic
export const withTransaction = async <T>(
  operation: (tx: PrismaClient) => Promise<T>,
  maxRetries = 3
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await (db as any).$transaction(operation, {
        timeout: 10000, // 10 second timeout
        isolationLevel: 'ReadCommitted',
      });
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Transaction attempt ${attempt} failed`, {
        error: error as Error,
        attempt,
        maxRetries,
      });
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  logger.error('Transaction failed after all retries', lastError!);
  throw lastError;
};
