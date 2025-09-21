import express from 'express'
import { queueManager } from '../services/queue-manager'
import { testRedisConnection } from '../config/redis'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()

// Redis and Queue health check
router.get('/health', async (_req, res) => {
  try {
    const redisOk = await testRedisConnection()
    const queueAvailable = queueManager.isAvailable()
    const queueStats = await queueManager.getQueueStats()
    
    const health = {
      timestamp: new Date().toISOString(),
      redis: {
        connected: redisOk,
        configured: !!process.env['REDIS_URL']
      },
      queue: {
        available: queueAvailable,
        stats: queueStats?.stats || null,
        healthy: queueStats?.isHealthy || false
      },
      environment: {
        nodeEnv: process.env['NODE_ENV'] || 'development',
        hasRedisUrl: !!process.env['REDIS_URL']
      }
    }

    const isHealthy = redisOk && queueAvailable
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      ...health
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// Get queue statistics
router.get('/queue-stats', async (_req, res) => {
  try {
    if (!queueManager.isAvailable()) {
      return res.status(503).json({ 
        error: 'Queue manager not available',
        stats: { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 }
      })
    }

    const health = await queueManager.getQueueStats()
    return res.json(health?.stats || { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 })
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Failed to get queue stats',
      message: error.message,
      stats: { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 }
    })
  }
})

// Test job processing
router.post('/test-job', async (req, res) => {
  try {
    const { topic = 'artificial intelligence test' } = req.body
    
    console.log(`Test job request received for topic: "${topic}"`)
    
    if (!queueManager.isAvailable()) {
      return res.status(503).json({
        error: 'Queue manager not available',
        message: 'Cannot add test job - queue system not initialized',
        topic
      })
    }

    const jobData = {
      id: `test-${uuidv4()}`,
      topic,
      priority: 'normal' as const
    }

    console.log(`Adding test job with data:`, jobData)
    
    const job = await queueManager.addJob(jobData)

    console.log(`Test job added successfully:`, {
      jobId: job.id,
      topic,
      status: 'queued'
    })

    return res.json({
      message: 'Test job added to queue',
      jobId: job.id,
      topic,
      status: 'queued',
      data: jobData
    })
  } catch (error: any) {
    console.error(`Failed to add test job:`, error)
    return res.status(500).json({
      error: 'Failed to add test job',
      message: error.message
    })
  }
})

// Redis health check only
router.get('/redis-health', async (_req, res) => {
  try {
    const connected = await testRedisConnection()
    
    const result = {
      timestamp: new Date().toISOString(),
      redis: {
        configured: !!process.env['REDIS_URL'],
        connected,
        url: process.env['REDIS_URL'] ? 'configured' : 'not configured'
      },
      environment: {
        redisUrl: process.env['REDIS_URL'] ? 'set' : 'not set',
        redisUrlFormat: process.env['REDIS_URL']?.startsWith('rediss://') ? 'TLS enabled' : 
                       process.env['REDIS_URL']?.startsWith('redis://') ? 'No TLS' : 'invalid format'
      }
    }
    
    res.status(connected ? 200 : 503).json({
      status: connected ? 'healthy' : 'unhealthy',
      ...result
    })
  } catch (error: any) {
    res.status(500).json({ 
      status: 'error',
      error: error.message
    })
  }
})

// Configuration check
router.get('/config', async (_req, res) => {
  try {
    res.json({
      redis: {
        configured: !!process.env['REDIS_URL'],
        format: process.env['REDIS_URL']?.startsWith('rediss://') ? 'TLS' : 
                process.env['REDIS_URL']?.startsWith('redis://') ? 'No TLS' : 'Invalid'
      },
      queue: {
        available: queueManager.isAvailable(),
        type: 'Bull.js with Redis backend'
      },
      environment: process.env['NODE_ENV'] || 'development'
    })
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get configuration',
      message: error.message
    })
  }
})

export default router