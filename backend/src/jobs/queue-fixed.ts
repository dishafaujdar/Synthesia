// Fixed queue.ts based on comprehensive implementation guide
import { ResearchJobData } from '../types';

// Types for better type safety
interface JobWithStatus {
  data: ResearchJobData;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

class SimpleJobProcessor {
  private jobs: Map<string, JobWithStatus> = new Map();
  private processing = false;

  async addJob(data: ResearchJobData): Promise<{ id: string }> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.jobs.set(jobId, {
      data,
      status: 'waiting',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`Adding job: ${jobId} for topic "${data.topic}"`);
    
    // Start processing if not already running
    if (!this.processing) {
      setImmediate(() => this.processNextJob());
    }

    return { id: jobId };
  }

  private async processNextJob(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      // Find next waiting job
      for (const [jobId, job] of this.jobs.entries()) {
        if (job.status === 'waiting') {
          console.log(`Processing job ${jobId}: "${job.data.topic}"`);
          
          job.status = 'active';
          job.updatedAt = new Date();
          
          try {
            // Simulate processing
            await this.processResearch(job.data);
            
            job.status = 'completed';
            job.updatedAt = new Date();
            console.log(`Job ${jobId} completed successfully`);
            
            // Remove completed job after a delay
            setTimeout(() => {
              this.jobs.delete(jobId);
            }, 30000); // Keep for 30 seconds
            
          } catch (error: any) {
            console.error(`Job ${jobId} failed:`, error.message);
            job.status = 'failed';
            job.error = error.message;
            job.updatedAt = new Date();
          }
          
          break; // Process one job at a time
        }
      }
    } finally {
      this.processing = false;
      
      // Check if there are more jobs to process
      const hasWaitingJobs = Array.from(this.jobs.values()).some(job => job.status === 'waiting');
      if (hasWaitingJobs) {
        setTimeout(() => this.processNextJob(), 1000); // Process next job after 1 second
      }
    }
  }

  private async processResearch(data: ResearchJobData): Promise<any> {
    console.log(`Researching topic: "${data.topic}"`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
    
    // Generate realistic mock research results
    const topic = data.topic;
    const keywords = topic.toLowerCase().split(' ').filter(word => word.length > 2);
    
    return {
      summary: `Comprehensive research analysis for "${topic}" reveals significant insights.`,
      keyInsights: [
        `${topic} represents a rapidly evolving field with significant potential`,
        'Recent developments show promising applications and use cases',
        'Industry experts predict continued growth and innovation'
      ],
      keywords: [...keywords, 'research', 'analysis', 'trends'].slice(0, 8),
      totalArticles: 4,
      processingTime: 3000,
      confidence: 0.87,
    };
  }

  getStats(): QueueStats {
    const stats: QueueStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'waiting':
          stats.waiting++;
          break;
        case 'active':
          stats.active++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
      stats.total++;
    }

    return stats;
  }

  getJob(jobId: string): JobWithStatus | null {
    return this.jobs.get(jobId) || null;
  }

  isHealthy(): boolean {
    return true; // Simple processor is always healthy
  }
}

// Create singleton instance
const jobProcessor = new SimpleJobProcessor();

console.log('Simple Job Processor initialized and ready');

// Export a Bull-compatible interface
export const queueManager = {
  addJob: async (data: ResearchJobData, priority?: string) => {
    const job = await jobProcessor.addJob(data);
    return {
      id: job.id,
      data,
      opts: { priority },
    };
  },

  getJob: async (jobId: string) => {
    return jobProcessor.getJob(jobId);
  },

  getQueueStats: async (): Promise<QueueStats> => {
    return jobProcessor.getStats();
  },

  testQueueHealth: async () => {
    return { 
      available: true, 
      stats: jobProcessor.getStats(),
      message: 'Simple Job Processor is operational'
    };
  },

  isReady: () => true,

  cleanQueue: async () => {
    console.log('Queue cleaned (no-op for simple processor)');
  },

  removeJob: async (jobId: string) => {
    console.log(`Removing job ${jobId} (no-op for simple processor)`);
    return true;
  },
};

export { jobProcessor as researchQueue };
export default jobProcessor;

console.log('Queue module exports created:', { 
  queueManager: !!queueManager, 
  researchQueue: !!jobProcessor,
  defaultExport: !!jobProcessor
});
