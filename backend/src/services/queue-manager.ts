// Direct implementation using the job processor.
// Queue processes jobs by priority (high → normal → low), then FIFO within same priority.
// Each job runs the research worker to search for the job's topic.
import { ResearchJobData } from '../types'

const PRIORITY_ORDER: Record<'high' | 'normal' | 'low', number> = {
  high: 3,
  normal: 2,
  low: 1
}

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  total: number
}

interface QueuedJob {
  data: ResearchJobData
  status: 'waiting' | 'active' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
  error?: string
}

// In-memory job processor: priority-ordered queue, processes one job at a time, runs search by topic
class EmbeddedJobProcessor {
  private jobs: Map<string, QueuedJob> = new Map()
  private processing = false

  async addJob(data: ResearchJobData): Promise<{ id: string }> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    this.jobs.set(jobId, {
      data,
      status: 'waiting',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    console.log(`📋 Adding job: ${jobId} for topic "${data.topic}" (priority: ${data.priority})`)

    if (!this.processing) {
      setImmediate(() => this.processNextJob())
    }

    return { id: jobId }
  }

  /** Pick next job: highest priority first, then oldest (FIFO) within same priority */
  private getNextWaitingJob(): [string, QueuedJob] | null {
    const waiting = Array.from(this.jobs.entries())
      .filter(([, job]) => job.status === 'waiting')
      .sort(([, a], [, b]) => {
        const priorityDiff = (PRIORITY_ORDER[b.data.priority] ?? 2) - (PRIORITY_ORDER[a.data.priority] ?? 2)
        if (priorityDiff !== 0) return priorityDiff
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
    return waiting.length > 0 ? waiting[0] : null
  }

  private async processNextJob(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      const next = this.getNextWaitingJob()
      if (!next) return

      const [jobId, job] = next
      console.log(`🔄 Processing job ${jobId}: "${job.data.topic}" (priority: ${job.data.priority})`)

      job.status = 'active'
      job.updatedAt = new Date()

      try {
        const { ResearchWorker } = await import('../workers/research.worker')
        const worker = new ResearchWorker()
        await worker.processResearchTask(job.data)
        job.status = 'completed'
        job.updatedAt = new Date()
        console.log(`✅ Job ${jobId} completed successfully`)
        setTimeout(() => this.jobs.delete(jobId), 30000)
      } catch (error: any) {
        console.error(`❌ Job ${jobId} failed:`, error.message)
        job.status = 'failed'
        job.error = error.message
        job.updatedAt = new Date()
      }

      const hasWaitingJobs = Array.from(this.jobs.values()).some(j => j.status === 'waiting')
      if (hasWaitingJobs) {
        setTimeout(() => this.processNextJob(), 1000)
      }
    } finally {
      this.processing = false
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
