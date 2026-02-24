/**
 * Recruiter / reviewer: single test demonstrating the full research agent flow.
 * Run: npm run test -- --testPathPattern="research-agent.recruiter"
 */

import { ResearchWorker } from '../workers/research.worker'
import { ResearchJobData } from '../types'
import { app } from '../app'
import supertest from 'supertest'

let lastCreatedTask: any = null

jest.mock('../config/database', () => ({
  prisma: {
    researchRequest: {
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((args: any) => {
        lastCreatedTask = {
          id: args.data.id,
          topic: args.data.topic,
          priority: args.data.priority,
          status: args.data.status,
          correlationId: args.data.correlationId,
          results: [],
          taskLogs: [],
        }
        return Promise.resolve(lastCreatedTask)
      }),
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (lastCreatedTask && lastCreatedTask.id === args.where.id) {
          return Promise.resolve(lastCreatedTask)
        }
        return Promise.resolve({ id: args.where.id, topic: '', priority: 'normal', status: 'PENDING', results: [], taskLogs: [] })
      }),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    taskLog: { create: jest.fn().mockResolvedValue(undefined) },
    researchResult: {
      create: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    article: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  },
}))

jest.mock('../services/queue-manager', () => ({
  queueManager: {
    isAvailable: jest.fn().mockReturnValue(true),
    addJob: jest.fn().mockResolvedValue(undefined),
    getQueueStats: jest.fn().mockResolvedValue({ stats: { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 }, isHealthy: true }),
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('../config/redis', () => ({
  testRedisConnection: jest.fn().mockResolvedValue(true),
}))

describe('Recruiter / reviewer flow', () => {
  let consoleLog: jest.SpyInstance
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    lastCreatedTask = null
    global.fetch = jest.fn().mockRejectedValue(new Error('Network disabled in tests'))
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLog?.mockRestore()
    consoleError?.mockRestore()
  })

  it('full flow: submit research with priority → worker runs search for topic → results have summary and insights', async () => {
    const submitRes = await supertest(app)
      .post('/api/research')
      .send({ topic: 'Remote work trends 2025', priority: 'high' })

    expect(submitRes.status).toBe(201)
    const task = submitRes.body
    expect(task).toHaveProperty('id')
    expect(task).toHaveProperty('topic', 'Remote work trends 2025')
    expect(task).toHaveProperty('priority', 'high')
    expect(task).toHaveProperty('status')

    const worker = new ResearchWorker()
    const jobData: ResearchJobData = {
      id: task.id,
      topic: task.topic,
      priority: (task.priority as 'high' | 'normal' | 'low') || 'normal',
      correlationId: task.correlationId || `corr-${task.id}`,
    }
    const results = await worker.processResearchTask(jobData)

    expect(results.summary).toBeDefined()
    expect(results.summary).toContain('Remote work trends 2025')
    expect(results.keyInsights).toBeInstanceOf(Array)
    expect(results.keyInsights.length).toBeGreaterThan(0)
    expect(results.keywords).toBeInstanceOf(Array)
    expect(results.articles).toBeInstanceOf(Array)
    expect(typeof results.confidence).toBe('number')
    expect(results.processingTime).toBeGreaterThanOrEqual(0)
  })
})
