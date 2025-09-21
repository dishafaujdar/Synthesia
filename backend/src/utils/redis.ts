import Redis from 'ioredis';
import config from './config';

// Minimal Redis client that definitely works with TypeScript
let redis: Redis | null = null;

try {
  if (!config.redis.url || !config.redis.url.startsWith('redis')) {
    console.warn('⚠️ Invalid or missing Redis URL. Redis disabled.');
    redis = null;
  } else {
    const url = new URL(config.redis.url);
    
    // Redis Cloud optimized configuration
    const redisOptions = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password,
      username: url.username || 'default',
      connectTimeout: 10000,  // Shorter timeout for Redis Cloud
      lazyConnect: false,     // Connect immediately for Redis Cloud
      enableOfflineQueue: true, // Enable offline queue for reliability
      maxRetriesPerRequest: 3,
      keepAlive: 30000,
    } as any; // Use 'as any' to bypass strict typing
    
    // Add TLS only if using rediss://
    if (url.protocol === 'rediss:') {
      redisOptions.tls = {
        rejectUnauthorized: false,
      };
    }

    redis = new Redis(redisOptions);

    // Event handlers
    redis.on('connect', () => {
      console.log('✅ Redis connected to Redis Cloud');
    });

    redis.on('error', (err: Error) => {
      console.warn('⚠️ Redis Cloud error:', err.message);
      if (err.message.includes('NOAUTH')) {
        console.error('🚨 Redis Cloud authentication failed! Check your password.');
      }
    });

    redis.on('ready', async () => {
      console.log('✅ Redis Cloud ready');
      // Test write permissions
      try {
        await redis?.set('test', 'ok', 'EX', 5);
        await redis?.del('test');
        console.log('✅ Redis Cloud write permissions confirmed');
      } catch (writeError) {
        console.error('❌ Redis Cloud write test failed:', writeError);
      }
    });
  }
} catch (error) {
  console.warn('⚠️ Redis initialization failed:', error);
  redis = null;
}

// Simple health check
export const healthCheck = async () => {
  try {
    if (!redis) return { connected: false, writable: false };
    
    const pong = await redis.ping();
    if (pong !== 'PONG') return { connected: false, writable: false };
    
    // Test write
    try {
      await redis.set('health', 'test', 'EX', 5);
      await redis.del('health');
      return { connected: true, writable: true };
    } catch {
      return { connected: true, writable: false };
    }
  } catch {
    return { connected: false, writable: false };
  }
};

// Simple cache utilities
export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      if (!redis) return null;
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  set: async (key: string, value: unknown, ttl?: number): Promise<boolean> => {
    try {
      if (!redis) return false;
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      return true;
    } catch {
      return false;
    }
  },

  del: async (key: string): Promise<boolean> => {
    try {
      if (!redis) return false;
      await redis.del(key);
      return true;
    } catch {
      return false;
    }
  },
};

export default redis;