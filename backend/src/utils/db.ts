import { PrismaClient } from '@prisma/client';
import config from './config';

// Create Prisma client
const db = new PrismaClient({
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});

export default db;

// Health check utility
export const healthCheck = async (): Promise<boolean> => {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  await db.$disconnect();
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
