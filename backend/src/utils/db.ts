// Re-export the optimized database configuration
import { prisma, testDatabaseConnection, isDatabaseHealthy, disconnectDatabase } from '../config/database';

export default prisma;

// Health check utility
export const healthCheck = async (): Promise<boolean> => {
  return await testDatabaseConnection();
};

// Export additional utilities
export { testDatabaseConnection, isDatabaseHealthy, disconnectDatabase };
