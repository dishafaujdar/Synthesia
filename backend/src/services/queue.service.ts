import Bull from 'bull'
import { ResearchJobData } from '../types/index'

// Parse Redis URL for Bull configuration
const parseRedisUrlForBull = (url: string) => {
  try {
    const urlObj = new URL(url)
    const config: any = {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 6379,
      db: 0,
    }
    
    if (urlObj.password) {
      config.password = urlObj.password
    }
    
    if (urlObj.username) {
      config.username = urlObj.username
    }
    
    return config
  } catch (error: any) {
    console.error('❌ Failed to parse Redis URL for Bull:', error.message)
    throw error
  }
}

const redisConfig = parseRedisUrlForBull(process.env['REDIS_URL']!)

console.log('🎯 Initializing Bull queue with Redis config:', {
  host: redisConfig.host,
  port: redisConfig.port,
  hasPassword: !!redisConfig.password,
  hasUsername: !!redisConfig.username,
})

export const researchQueue = new Bull<ResearchJobData>('research-queue', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    delay: 1000,
  },
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1,
  },
})

// Enhanced queue event listeners
researchQueue.on('ready', () => {
  console.log('🎉 Research queue is ready and connected!')
})

researchQueue.on('error', (error) => {
  console.error('❌ Queue error:', error.message)
  console.error('🔧 Queue error stack:', error.stack)
})

researchQueue.on('waiting', (jobId) => {
  console.log(`⏳ Job ${jobId} is waiting in queue`)
})

researchQueue.on('active', (job) => {
  console.log(`🔄 Job ${job.id} started processing (Topic: "${job.data.topic}")`)
})

researchQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully:`, {
    taskId: job.data.id,
    result: result
  })
})

researchQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, {
    taskId: job?.data?.id,
    topic: job?.data?.topic,
    error: err.message,
    attempts: job?.attemptsMade,
    maxAttempts: job?.opts?.attempts
  })
})

researchQueue.on('stalled', (job) => {
  console.warn(`⚠️ Job ${job.id} stalled and will be restarted`)
})

researchQueue.on('progress', (job, progress) => {
  console.log(`📊 Job ${job.id} progress: ${progress}%`)
})

// Queue health check function
export const checkQueueHealth = async (): Promise<{
  isHealthy: boolean
  stats: any
  error?: string
}> => {
  try {
    const waiting = await researchQueue.getWaiting()
    const active = await researchQueue.getActive()
    const completed = await researchQueue.getCompleted()
    const failed = await researchQueue.getFailed()
    
    const stats = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    }
    
    console.log('📊 Queue health stats:', stats)
    
    return {
      isHealthy: true,
      stats
    }
  } catch (error: any) {
    console.error('❌ Queue health check failed:', error.message)
    return {
      isHealthy: false,
      stats: null,
      error: error.message
    }
  }
}

// Process jobs with enhanced error handling
researchQueue.process('research-task', 1, async (job) => {
  console.log(`🚀 Processing research job: ${job.id}`)
  console.log(`📋 Job data:`, job.data)
  
  try {
    // Update progress
    await job.progress(10)
    
    // Use the research worker
    const { ResearchWorker } = await import('../workers/research.worker')
    const worker = new ResearchWorker()
    
    await job.progress(20)
    
    const result = await worker.processResearchTask(job.data)
    
    await job.progress(100)
    
    console.log(`✅ Job ${job.id} completed successfully`)
    return result
    
  } catch (error: any) {
    console.error(`❌ Job ${job.id} processing failed:`, error.message)
    throw error
  }
})

// Clean up old jobs periodically
setInterval(async () => {
  try {
    await researchQueue.clean(24 * 60 * 60 * 1000, 'completed') // Clean completed jobs older than 24h
    await researchQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed') // Clean failed jobs older than 7 days
  } catch (error: any) {
    console.error('❌ Queue cleanup failed:', error.message)
  }
}, 60 * 60 * 1000) // Run every hour

export default researchQueue
