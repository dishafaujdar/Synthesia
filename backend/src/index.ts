import app from './app';
import config from './utils/config';
import { healthCheck } from './utils/db';
import './jobs/queue'; // Import to initialize job processing

const startServer = async () => {
  try {
    // Test database connection
    const dbHealthy = await healthCheck();
    if (!dbHealthy) {
      console.warn('Database connection failed, running in mock mode');
      // Don't exit - allow mock mode to work
    } else {
      console.log('✅ Database connection established');
    }

    // Test Redis connection (for job queue)
    try {
      const { researchQueue } = await import('./jobs/queue');
      console.log('✅ Job queue initialized');
      
      // Log queue stats on startup
      const stats = await researchQueue.getWaiting();
      console.log(`📊 Queue stats: ${stats.length} jobs waiting`);
    } catch (error) {
      console.warn('⚠️ Redis/Queue connection failed:', error);
      console.warn('Job processing will not be available');
    }

    // Start server
    const server = app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`📡 API Version: ${config.apiVersion}`);
      console.log(`🔗 API URL: http://localhost:${config.port}/api/${config.apiVersion}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      console.log('🛑 Shutting down gracefully...');
      
      try {
        const { shutdown } = await import('./jobs/queue');
        await shutdown();
        console.log('✅ Job queue shut down');
      } catch (error) {
        console.warn('⚠️ Error shutting down job queue:', error);
      }

      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
