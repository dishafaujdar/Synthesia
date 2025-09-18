import express from 'express';
import { queueManager } from '@/jobs/queue';
import { ProcessedArticle } from '@/types';
// import DatabaseIntegrationService from '@/services/database-integration';
// import { db } from '@/utils/supabase';

const router = express.Router();
// const dbIntegration = new DatabaseIntegrationService(db);

// Get queue statistics
router.get('/queue-stats', async (_req, res) => {
  try {
    const stats = await queueManager.getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get queue stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test job processing with a simple topic
router.post('/test-job', async (req, res) => {
  try {
    const { topic = 'artificial intelligence' } = req.body;
    
    const job = await queueManager.addJob({
      id: `test-${Date.now()}`,
      topic,
      priority: 'normal',
      correlationId: `test-corr-${Date.now()}`,
      userId: 'test-user',
    }, 'normal');

    res.json({
      message: 'Test job added to queue',
      jobId: job.id,
      topic,
      status: 'queued'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to add test job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get job details
router.get('/job/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await queueManager.getJob(id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
      id: job.id,
      data: job.data,
      progress: job.progress(),
      state: await job.getState(),
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      attempts: job.opts.attempts,
      delay: job.opts.delay,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get job details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test external APIs
router.get('/test-apis/:topic?', async (req, res) => {
  const topic = req.params.topic || 'machine learning';
  
  try {
    const WikipediaClient = (await import('@/services/external/WikipediaClient')).default;
    const NewsAPIClient = (await import('@/services/external/NewsAPIClient')).default;
    
    const wikipedia = new WikipediaClient();
    const newsApi = new NewsAPIClient();
    
    // Test Wikipedia
    const wikiHealthy = await wikipedia.isHealthy();
    let wikiArticles: ProcessedArticle[] = [];
    if (wikiHealthy) {
      wikiArticles = await wikipedia.search(topic);
    }

    // Test NewsAPI
    const newsHealthy = await newsApi.isHealthy();
    let newsArticles: ProcessedArticle[] = [];
    if (newsHealthy) {
      newsArticles = await newsApi.search(topic);
    }

    res.json({
      topic,
      apis: {
        wikipedia: {
          healthy: wikiHealthy,
          articlesFound: wikiArticles.length,
          articles: wikiArticles.slice(0, 3).map(a => ({
            title: a.title,
            url: a.url,
            source: a.source
          }))
        },
        newsapi: {
          healthy: newsHealthy,
          articlesFound: newsArticles.length,
          articles: newsArticles.slice(0, 3).map(a => ({
            title: a.title,
            url: a.url,
            source: a.source
          }))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to test APIs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Redis health check
router.get('/redis-health', async (_req, res) => {
  try {
    // Try to import queue and check if it works
    const { researchQueue } = await import('@/jobs/queue');
    
    // Try to get queue stats as a health check
    await researchQueue.getWaiting();
    
    res.json({ 
      status: 'healthy',
      message: 'Redis connection is working'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clean queue
router.post('/clean-queue', async (_req, res) => {
  try {
    await queueManager.cleanQueue();
    res.json({ message: 'Queue cleaned successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clean queue',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database integration health check
router.get('/database-health', async (_req, res) => {
  try {
    // const healthCheck = await dbIntegration.healthCheck();
    res.json({ message: 'Database integration temporarily disabled' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check database health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database stats comparison
router.get('/database-stats', async (_req, res) => {
  try {
    // const stats = await dbIntegration.getStats();
    res.json({ message: 'Database stats temporarily disabled' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get database stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
