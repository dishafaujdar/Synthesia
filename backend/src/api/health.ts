import { Router, Request, Response } from 'express';
import { prisma, testDatabaseConnection } from '../config/database';

const router = Router();

// Database health check
router.get('/database', async (_req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    await testDatabaseConnection();
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      connectionPoolSize: process.env['DB_CONNECTION_LIMIT'] || 'default',
      processType: process.env['PROCESS_TYPE'] || 'unknown'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database connection failed',
      timestamp: new Date().toISOString(),
      processType: process.env['PROCESS_TYPE'] || 'unknown'
    });
  }
});

// Connection pool statistics
router.get('/connections', async (_req: Request, res: Response) => {
  try {
    // Query connection stats from PostgreSQL
    const connectionStats = await prisma.$queryRaw<Array<{
      total_connections: bigint;
      active_connections: bigint;
      idle_connections: bigint;
    }>>`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    
    const stats = connectionStats[0];
    res.json({
      status: 'ok',
      stats: {
        total_connections: Number(stats.total_connections),
        active_connections: Number(stats.active_connections),
        idle_connections: Number(stats.idle_connections)
      },
      processType: process.env['PROCESS_TYPE'] || 'unknown',
      configuredLimit: process.env['DB_CONNECTION_LIMIT'] || 'default',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to get connection stats',
      timestamp: new Date().toISOString()
    });
  }
});

// Overall system health
router.get('/system', async (_req: Request, res: Response) => {
  try {
    const healthChecks = await Promise.allSettled([
      testDatabaseConnection(),
      // Add other service checks here (Redis, etc.)
    ]);

    const dbHealthy = healthChecks[0].status === 'fulfilled' && healthChecks[0].value;
    
    const overallStatus = dbHealthy ? 'healthy' : 'degraded';
    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        // Add other services here
      },
      processType: process.env['PROCESS_TYPE'] || 'unknown',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
