import Redis from 'ioredis';
import config from './config';

// Create Redis client with retry strategy
const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    return err.message.includes(targetError);
  },
});

// Health check
export const healthCheck = async (): Promise<boolean> => {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    return false;
  }
};

// Cache utilities
export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  },

  set: async (key: string, value: unknown, ttl?: number): Promise<boolean> => {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      return false;
    }
  },

  del: async (key: string): Promise<boolean> => {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      return false;
    }
  },

  exists: async (key: string): Promise<boolean> => {
    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      return false;
    }
  },
};

// Rate limiting utilities
export const rateLimiter = {
  check: async (key: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
    try {
      const current = await redis.incr(key);
      
      if (current === 1) {
        await redis.expire(key, window);
      }
      
      const ttl = await redis.ttl(key);
      const resetTime = Date.now() + (ttl * 1000);
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime,
      };
    } catch (error) {
      // Allow request on Redis failure
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + (window * 1000),
      };
    }
  },
};

// Graceful shutdown
const gracefulShutdown = async () => {
  await redis.quit();
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default redis;
