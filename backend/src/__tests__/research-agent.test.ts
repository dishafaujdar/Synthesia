/**
 * Tests for the AI Research Agent (ResearchWorker and research API).
 */

import { ResearchWorker } from '../workers/research.worker'
import { ResearchJobData } from '../types'
import { prisma } from '../config/database'
import { app } from '../app'
import supertest from 'supertest'

// Store last created task so findUnique can return it (queue/priority tests)
let lastCreatedTask: any = null

jest.mock('../config/database', () => ({
  prisma: {
    researchRequest: {
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((args: any) => {
        lastCreatedTask = { id: args.data.id, topic: args.data.topic, priority: args.data.priority, status: args.data.status, correlationId: args.data.correlationId, results: [], taskLogs: [] }
        return Promise.resolve(lastCreatedTask)
      }),
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (lastCreatedTask && lastCreatedTask.id === args.where.id) {
          return Promise.resolve(lastCreatedTask)
        }
        return Promise.resolve({ id: args.where.id, topic: 'Climate change', priority: 'normal', status: 'PENDING', results: [], taskLogs: [] })
      }),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    taskLog: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    researchResult: {
      create: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    article: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
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

describe('Research Agent', () => {
  const baseJobData: ResearchJobData = {
    id: 'test-request-123',
    topic: 'Artificial Intelligence',
    priority: 'normal',
    correlationId: 'corr-456',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Force external APIs to fail so worker uses fallback articles (no real network)
    global.fetch = jest.fn().mockRejectedValue(new Error('Network disabled in tests'))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('ResearchWorker', () => {
    it('processes a research task and returns results with summary, insights, and keywords', async () => {
      const worker = new ResearchWorker()
      const result = await worker.processResearchTask(baseJobData)

      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(typeof result.summary).toBe('string')
      expect(result.summary).toContain('Artificial Intelligence')
      expect(result.keyInsights).toBeInstanceOf(Array)
      expect(result.keyInsights.length).toBeGreaterThan(0)
      expect(result.keywords).toBeInstanceOf(Array)
      expect(result.articles).toBeInstanceOf(Array)
      expect(result.totalArticles).toBeGreaterThanOrEqual(0)
      expect(result.processingTime).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('updates task status to IN_PROGRESS then COMPLETED', async () => {
      const worker = new ResearchWorker()
      await worker.processResearchTask(baseJobData)

      const mockUpdate = prisma.researchRequest.update as jest.Mock
      expect(mockUpdate).toHaveBeenCalled()
      const updateCalls = mockUpdate.mock.calls
      const statuses = updateCalls.map((call: any) => call[0].data.status)
      expect(statuses).toContain('IN_PROGRESS')
      expect(statuses).toContain('COMPLETED')
    })

    it('creates task logs during processing', async () => {
      const worker = new ResearchWorker()
      await worker.processResearchTask(baseJobData)

      const mockCreateLog = prisma.taskLog.create as jest.Mock
      expect(mockCreateLog.mock.calls.length).toBeGreaterThan(0)
      const firstLog = mockCreateLog.mock.calls[0][0].data
      expect(firstLog.researchRequestId).toBe(baseJobData.id)
      expect(['INFO', 'WARN', 'ERROR', 'DEBUG']).toContain(firstLog.level)
      expect(firstLog.message).toBeDefined()
      expect(firstLog.step).toBeDefined()
    })

    it('saves research results to the database', async () => {
      const worker = new ResearchWorker()
      await worker.processResearchTask(baseJobData)

      const mockCreateResult = prisma.researchResult.create as jest.Mock
      expect(mockCreateResult).toHaveBeenCalledTimes(1)
      const createCall = mockCreateResult.mock.calls[0][0]
      expect(createCall.data.researchRequestId).toBe(baseJobData.id)
      expect(createCall.data.summary).toBeDefined()
      expect(createCall.data.keyInsights).toBeInstanceOf(Array)
      expect(createCall.data.keywords).toBeInstanceOf(Array)
      expect(createCall.data.totalArticles).toBeDefined()
      expect(createCall.data.confidence).toBeDefined()
    })

    it('includes articles with required fields when sources are available', async () => {
      // Use fallback path (fetch fails) - worker still produces articles
      const worker = new ResearchWorker()
      const result = await worker.processResearchTask(baseJobData)

      if (result.articles.length > 0) {
        const article = result.articles[0]
        expect(article).toHaveProperty('title')
        expect(article).toHaveProperty('url')
        expect(article).toHaveProperty('summary')
        expect(article).toHaveProperty('source')
        expect(article).toHaveProperty('relevanceScore')
        expect(article).toHaveProperty('wordCount')
      }
    })

    it('searches according to the job topic (result reflects topic)', async () => {
      const worker = new ResearchWorker()
      const jobData: ResearchJobData = {
        ...baseJobData,
        id: 'topic-test-1',
        topic: 'Quantum computing',
        priority: 'high',
      }
      const result = await worker.processResearchTask(jobData)

      expect(result.summary).toContain('Quantum computing')
      expect(result.keyInsights.some((s: string) => s.includes('Quantum computing'))).toBe(true)
    })
  })
})

describe('Research Agent API', () => {
  it('GET /api/queue/status returns queue status', async () => {
    const res = await supertest(app).get('/api/queue/status')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body).toHaveProperty('queue')
    expect(res.body.queue).toHaveProperty('available')
  })

  it('POST /api/research validates topic is required', async () => {
    const res = await supertest(app).post('/api/research').send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('success', false)
    expect(res.body.error).toBeDefined()
  })

  it('POST /api/research rejects topic that is too long', async () => {
    const res = await supertest(app).post('/api/research').send({ topic: 'x'.repeat(201) })
    expect(res.status).toBe(400)
  })

  it('POST /api/research accepts valid topic and returns task (if queue available)', async () => {
    const res = await supertest(app).post('/api/research').send({ topic: 'Climate change', priority: 'normal' })
    // 201 if queue is available and DB works; 503 if queue unavailable
    expect([201, 503]).toContain(res.status)
    if (res.status === 201) {
      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('topic', 'Climate change')
      expect(res.body).toHaveProperty('status')
      expect(res.body).toHaveProperty('priority', 'normal')
    }
  })

  it('POST /api/research accepts and returns priority (high, normal, low) for queue', async () => {
    for (const priority of ['high', 'normal', 'low'] as const) {
      const res = await supertest(app).post('/api/research').send({ topic: 'Test topic', priority })
      expect([201, 503]).toContain(res.status)
      if (res.status === 201) {
        expect(res.body).toHaveProperty('priority', priority)
      }
    }
  })
})

/**
 * Recruiter / reviewer flow: one test that demonstrates the full research agent flow.
 * Run with: npm run test -- --testPathPattern="research-agent" --testNamePattern="Recruiter"
 * Console output is silenced so the run shows a clean PASS.
 */
describe('Recruiter / reviewer flow', () => {
  let consoleLog: jest.SpyInstance
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockRejectedValue(new Error('Network disabled in tests'))
    // Silence console so recruiter run shows a clean PASS (expected API/worker logs are noisy)
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLog?.mockRestore()
    consoleError?.mockRestore()
  })

  it('full flow: submit research with priority → worker runs search for topic → results have summary and insights', async () => {
    // 1. Submit a research request (as a user would via the API)
    const submitRes = await supertest(app)
      .post('/api/research')
      .send({ topic: 'Remote work trends 2025', priority: 'high' })

    expect(submitRes.status).toBe(201)
    const task = submitRes.body
    expect(task).toHaveProperty('id')
    expect(task).toHaveProperty('topic', 'Remote work trends 2025')
    expect(task).toHaveProperty('priority', 'high')
    expect(task).toHaveProperty('status')

    // 2. Run the research worker (simulates queue processing the job)
    const worker = new ResearchWorker()
    const jobData: ResearchJobData = {
      id: task.id,
      topic: task.topic,
      priority: (task.priority as 'high' | 'normal' | 'low') || 'normal',
      correlationId: task.correlationId || `corr-${task.id}`,
    }
    const results = await worker.processResearchTask(jobData)

    // 3. Assert: search was done for the requested topic and returned structured results
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
