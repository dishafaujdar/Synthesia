import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { prisma } from './config/database'
import { testRedisConnection } from './config/redis'
import { queueManager } from './services/queue-manager'
import researchRoutes from './routes/research.routes'
// import debugRoutes from './api/debug'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env['PORT'] || 3000

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env['FRONTEND_URL'] || 'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Enhanced health check endpoint
app.get('/health', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    
    // Check Redis connection
    const redisOk = await testRedisConnection()
    
    // Check queue manager
    const queueAvailable = queueManager.isAvailable()
    const queueStatsResult = await queueManager.getQueueStats()
    
    const allHealthy = redisOk && queueAvailable
    
    res.status(allHealthy ? 200 : 503).json({ 
      status: allHealthy ? 'OK' : 'DEGRADED', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: redisOk ? 'connected' : 'disconnected',
        queue: queueAvailable ? 'available' : 'unavailable',
        queueStats: queueStatsResult?.stats || { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 }
      }
    })
  } catch (error: any) {
    console.error('❌ Health check failed:', error)
    res.status(503).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// API routes
app.use('/api', researchRoutes)
// Note: debug routes temporarily disabled due to legacy imports
// app.use('/api/v1/debug', debugRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  })
})

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('❌ Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env['NODE_ENV'] === 'development' ? err.message : 'Something went wrong'
  })
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...')
  
  try {
    await queueManager.shutdown()
    await prisma.$disconnect()
    console.log('✅ Cleanup completed')
  } catch (error: any) {
    console.error('❌ Error during shutdown:', error)
  }
  
  process.exit(0)
})

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting AI Research Agent Backend...')
    
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // Test Redis connection
    const redisOk = await testRedisConnection()
    if (!redisOk) {
      console.warn('⚠️ Redis connection failed - queue will not be available')
    }
    
    // Initialize queue manager
    console.log('📋 Initializing Queue Manager...')
    await queueManager.initialize()
    
    if (queueManager.isAvailable()) {
      console.log('✅ Queue Manager ready - research tasks will be processed')
    } else {
      console.warn('⚠️ Queue Manager not available - research will not be processed')
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 API available at http://localhost:${PORT}/api`)
      console.log(`🔍 Health check: http://localhost:${PORT}/health`)
      
      console.log('\n📋 Service Status:')
      console.log(`  Database: ✅ Connected`)
      console.log(`  Redis: ${redisOk ? '✅ Connected' : '❌ Failed'}`)
      console.log(`  Queue: ${queueManager.isAvailable() ? '✅ Available' : '❌ Unavailable'}`)
    })
    
  } catch (error: any) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
