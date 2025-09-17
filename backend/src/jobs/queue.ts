import Bull from 'bull';
import { ResearchJobData } from '@/types';
import config from '@/utils/config';
import ResearchProcessor from './processors/ResearchProcessor';

// Create job queue
export const researchQueue = new Bull<ResearchJobData>('research', config.redis.url, {
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: config.jobs.maxRetries,
    backoff: {
      type: 'exponential',
      delay: config.jobs.retryDelay,
    },
  },
  settings: {
    stalledInterval: 30 * 1000,
    maxStalledCount: 1,
  },
});

// Process jobs
researchQueue.process(config.jobs.concurrency, async (job) => {
  const processor = new ResearchProcessor(job);
  return await processor.execute();
});

// Job event handlers
researchQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

researchQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

researchQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`);
});

// Queue management utilities
export const queueManager = {
  addJob: async (data: ResearchJobData, priority?: 'low' | 'normal' | 'high') => {
    const priorityMap = { low: 1, normal: 5, high: 10 };
    const jobPriority = priority ? priorityMap[priority] : priorityMap.normal;
    
    return await researchQueue.add(data, {
      priority: jobPriority,
      delay: 0,
    });
  },

  getJob: async (jobId: string) => {
    return await researchQueue.getJob(jobId);
  },

  removeJob: async (jobId: string) => {
    const job = await researchQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  },

  getQueueStats: async () => {
    const waiting = await researchQueue.getWaiting();
    const active = await researchQueue.getActive();
    const completed = await researchQueue.getCompleted();
    const failed = await researchQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length,
    };
  },

  pauseQueue: async () => {
    return await researchQueue.pause();
  },

  resumeQueue: async () => {
    return await researchQueue.resume();
  },

  cleanQueue: async (grace: number = 5000) => {
    await researchQueue.clean(grace, 'completed');
    await researchQueue.clean(grace, 'failed');
  },
};

// Graceful shutdown
export const shutdown = async () => {
  await researchQueue.close();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
