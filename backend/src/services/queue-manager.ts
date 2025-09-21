// Direct implementation using the job processor
import { ResearchJobData } from '../types'

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  total: number
}

// Simple in-memory job processor - embedded directly
class EmbeddedJobProcessor {
  private jobs: Map<string, any> = new Map()
  private processing = false

  async addJob(data: ResearchJobData): Promise<{ id: string }> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    this.jobs.set(jobId, {
      data,
      status: 'waiting',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    console.log(`📋 Adding job: ${jobId} for topic "${data.topic}"`)
    
    // Start processing if not already running
    if (!this.processing) {
      setImmediate(() => this.processNextJob())
    }

    return { id: jobId }
  }

  private async processNextJob(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      // Find next waiting job
      for (const [jobId, job] of this.jobs.entries()) {
        if (job.status === 'waiting') {
          console.log(`� Processing job ${jobId}: "${job.data.topic}"`)
          
          job.status = 'active'
          job.updatedAt = new Date()
          
          try {
            // Use the research worker
            const { ResearchWorker } = await import('../workers/research.worker')
            const worker = new ResearchWorker()
            await worker.processResearchTask(job.data)
            
            job.status = 'completed'
            job.updatedAt = new Date()
            console.log(`✅ Job ${jobId} completed successfully`)
            
            // Remove completed job after a delay
            setTimeout(() => {
              this.jobs.delete(jobId)
            }, 30000) // Keep for 30 seconds
            
          } catch (error: any) {
            console.error(`❌ Job ${jobId} failed:`, error.message)
            job.status = 'failed'
            job.error = error.message
            job.updatedAt = new Date()
          }
          
          break // Process one job at a time
        }
      }
    } finally {
      this.processing = false
      
      // Check if there are more jobs to process
      const hasWaitingJobs = Array.from(this.jobs.values()).some(job => job.status === 'waiting')
      if (hasWaitingJobs) {
        setTimeout(() => this.processNextJob(), 1000) // Process next job after 1 second
      }
    }
  }

  getStats(): QueueStats {
    const stats: QueueStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
    }

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'waiting':
          stats.waiting++
          break
        case 'active':
          stats.active++
          break
        case 'completed':
          stats.completed++
          break
        case 'failed':
          stats.failed++
          break
      }
      stats.total++
    }

    return stats
  }
}

export class QueueManager {
  private static instance: QueueManager
  private processor: EmbeddedJobProcessor

  private constructor() {
    this.processor = new EmbeddedJobProcessor()
    console.log('✅ Queue Manager with embedded processor initialized')
  }

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager()
    }
    return QueueManager.instance
  }

  async initialize(): Promise<boolean> {
    console.log('🔄 Initializing Queue Manager with embedded processor...')
    console.log('✅ Queue Manager initialized successfully (Embedded Processor)')
    return true
  }

  isAvailable(): boolean {
    // Always available with embedded processor
    return true
  }

  async addJob(jobData: { id: string; topic: string; priority?: string }) {
    try {
      console.log('📋 Adding job to embedded processor:', jobData)

      const job = await this.processor.addJob({
        id: jobData.id,
        topic: jobData.topic,
        priority: (jobData.priority as 'low' | 'normal' | 'high') || 'normal',
        correlationId: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })

      console.log(`✅ Job added to embedded processor: ${job.id}`)
      return job
    } catch (error: any) {
      console.error('❌ Failed to add job to embedded processor:', error.message)
      throw error
    }
  }

  async getQueueStats(): Promise<{
    isHealthy: boolean
    stats: QueueStats | null
    error?: string
  } | null> {
    try {
      const stats = this.processor.getStats()
      return {
        isHealthy: true,
        stats
      }
    } catch (error: any) {
      console.error('❌ Failed to get queue stats:', error.message)
      return {
        isHealthy: false,
        stats: null,
        error: error.message
      }
    }
  }

  async shutdown() {
    console.log('🛑 Queue Manager shutdown (embedded processor)')
  }
}

export const queueManager = QueueManager.getInstance()
