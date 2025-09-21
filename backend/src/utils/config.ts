import dotenv from 'dotenv';
import { Config } from '@/types';

// Load environment variables
dotenv.config();

const redis = "redis://default:3AD6UvtGLIBJaMOVAPOE6DPYnZNqzqGU@redis-10921.c74.us-east-1-4.ec2.redns.redis-cloud.com:10921"


const env = process.env;

const config: Config = {
  port: parseInt(env['PORT'] || '3001', 10),
  nodeEnv: (env['NODE_ENV'] as 'development' | 'production' | 'test') || 'development',
  apiVersion: env['API_VERSION'] || 'v1',
  
  database: {
    url: env['DATABASE_URL'] || 'postgresql://localhost:5432/ai_research_agent',
    connectionPoolSize: parseInt(env['DB_CONNECTION_POOL_SIZE'] || '20', 10),
  },
  
  redis: {
    url: env['REDIS_URL'] || redis,
  },
  
  auth: {
    jwtSecret: env['JWT_SECRET'] || 'your-secret-key',
    jwtExpiresIn: env['JWT_EXPIRES_IN'] || '7d',
    bcryptRounds: parseInt(env['BCRYPT_ROUNDS'] || '12', 10),
  },
  
  rateLimit: {
    windowMs: parseInt(env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    maxRequests: parseInt(env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
  },
  
  externalApis: {
    ...(env['OPENAI_API_KEY'] && {
      openai: {
        apiKey: env['OPENAI_API_KEY'],
      },
    }),
    ...(env['NEWS_API_KEY'] && {
      newsApi: {
        apiKey: env['NEWS_API_KEY'],
      },
    }),
    wikipedia: {
      baseUrl: env['WIKIPEDIA_API_BASE'] || 'https://en.wikipedia.org/api/rest_v1',
    },
  },
  
  jobs: {
    concurrency: parseInt(env['JOB_CONCURRENCY'] || '5', 10),
    maxRetries: parseInt(env['JOB_MAX_RETRIES'] || '3', 10),
    retryDelay: parseInt(env['JOB_RETRY_DELAY'] || '5000', 10),
  },
  
  monitoring: {
    logLevel: env['LOG_LEVEL'] || 'info',
    otelServiceName: env['OTEL_SERVICE_NAME'] || 'ai-research-agent-backend',
    ...(env['OTEL_EXPORTER_OTLP_ENDPOINT'] && {
      otelEndpoint: env['OTEL_EXPORTER_OTLP_ENDPOINT'],
    }),
  },
  
  cache: {
    ttl: parseInt(env['CACHE_TTL'] || '3600', 10),
  },
  
  apiTimeout: parseInt(env['API_TIMEOUT'] || '30000', 10),
};

// Validation
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];

if (config.nodeEnv === 'production') {
  requiredEnvVars.push('REDIS_URL');
}

const missingVars = requiredEnvVars.filter(varName => !env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

export default config;
