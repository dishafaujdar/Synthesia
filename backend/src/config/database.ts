import { PrismaClient } from '@prisma/client'

// Calculate optimal pool size based on process type
const getConnectionConfig = () => {
  const isDev = process.env['NODE_ENV'] === 'development'
  const processType = process.env['PROCESS_TYPE'] || 'api'
  
  const config = {
    api: {
      connectionLimit: isDev ? 15 : 25,
      poolTimeout: isDev ? 30 : 40,
      connectTimeout: 20
    },
    worker: {
      connectionLimit: isDev ? 5 : 10,
      poolTimeout: isDev ? 20 : 30,
      connectTimeout: 15
    }
  }
  
  return config[processType as keyof typeof config] || config.api
}

// Enhanced database URL with proper pooling
const getDatabaseUrl = () => {
  const baseUrl = process.env['DATABASE_URL']
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  
  const { connectionLimit, poolTimeout, connectTimeout } = getConnectionConfig()
  
  const url = new URL(baseUrl)
  url.searchParams.set('connection_limit', connectionLimit.toString())
  url.searchParams.set('pool_timeout', poolTimeout.toString())
  url.searchParams.set('connect_timeout', connectTimeout.toString())
  
  // Additional PostgreSQL optimizations
  url.searchParams.set('pgbouncer', 'true')
  url.searchParams.set('prepared_statements', 'false')
  
  console.log(`🔌 Database configured: ${connectionLimit} connections, ${poolTimeout}s timeout`)
  
  return url.toString()
}

// Singleton Prisma client with optimized configuration
class DatabaseManager {
  private static instance: PrismaClient
  private static isConnected = false
  
  static getInstance(): PrismaClient {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new PrismaClient({
        datasources: {
          db: {
            url: getDatabaseUrl()
          }
        },
        log: process.env['NODE_ENV'] === 'development' 
          ? ['error', 'warn'] 
          : ['error'],
        errorFormat: 'pretty'
      })
      
      DatabaseManager.setupEventHandlers()
    }
    
    return DatabaseManager.instance
  }
  
  private static setupEventHandlers() {
    const client = DatabaseManager.instance
    
    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`📡 ${signal} received, closing database connections...`)
      try {
        await client.$disconnect()
        console.log('✅ Database connections closed successfully')
        DatabaseManager.isConnected = false
        process.exit(0)
      } catch (error) {
        console.error('❌ Error closing database connections:', error)
        process.exit(1)
      }
    }
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('beforeExit', () => gracefulShutdown('beforeExit'))
  }
  
  static async testConnection(): Promise<boolean> {
    try {
      const client = DatabaseManager.getInstance()
      await client.$queryRaw`SELECT 1 as connection_test`
      DatabaseManager.isConnected = true
      console.log('✅ Database connection test successful')
      return true
    } catch (error) {
      console.error('❌ Database connection test failed:', error)
      DatabaseManager.isConnected = false
      return false
    }
  }
  
  static isHealthy(): boolean {
    return DatabaseManager.isConnected
  }

  static async disconnect(): Promise<void> {
    if (DatabaseManager.instance) {
      await DatabaseManager.instance.$disconnect()
      DatabaseManager.isConnected = false
    }
  }
}

// Export the singleton instance
export const prisma = DatabaseManager.getInstance()
export const testDatabaseConnection = DatabaseManager.testConnection
export const isDatabaseHealthy = DatabaseManager.isHealthy
export const disconnectDatabase = DatabaseManager.disconnect

export default prisma
