import { PrismaClient } from '@prisma/client'

// Singleton Prisma client with optimized configuration
class DatabaseClient {
  private static instance: PrismaClient | null = null

  static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new PrismaClient({
        log: ['error', 'warn'],
        errorFormat: 'minimal',
      })

      // Handle cleanup on app termination
      process.on('beforeExit', async () => {
        await DatabaseClient.instance?.$disconnect()
      })
    }
    return DatabaseClient.instance
  }

  static async disconnect() {
    if (DatabaseClient.instance) {
      await DatabaseClient.instance.$disconnect()
      DatabaseClient.instance = null
    }
  }
}

// Export the singleton instance
export const db = DatabaseClient.getInstance()

// Database helper functions
export class DatabaseHelper {
  /**
   * Test database connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      await db.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('Database connection failed:', error)
      return false
    }
  }

  /**
   * Get comprehensive table statistics
   */
  static async getTableStats() {
    try {
      const [requests, results, articles, logs, users] = await Promise.all([
        db.researchRequest.count(),
        db.researchResult.count(),
        db.article.count(),
        db.taskLog.count(),
        db.user.count()
      ])

      return {
        research_requests: requests,
        research_results: results,
        articles: articles,
        task_logs: logs,
        users: users,
        total_records: requests + results + articles + logs + users
      }
    } catch (error) {
      console.error('Failed to get table stats:', error)
      return null
    }
  }

  /**
   * Clean up old logs (older than specified days)
   */
  static async cleanupOldLogs(daysToKeep: number = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    try {
      const deleted = await db.taskLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      })

      return deleted.count
    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
      return 0
    }
  }

  /**
   * Get database connection info
   */
  static async getConnectionInfo() {
    try {
      const result = await db.$queryRaw<Array<{
        current_database: string
        current_user: string
        version: string
      }>>`
        SELECT 
          current_database(),
          current_user,
          version()
      `

      return result[0]
    } catch (error) {
      console.error('Failed to get connection info:', error)
      return null
    }
  }

  /**
   * Execute raw SQL with proper error handling
   */
  static async executeRaw(sql: string, params: any[] = []) {
    try {
      return await db.$queryRawUnsafe(sql, ...params)
    } catch (error) {
      console.error('Raw query failed:', error)
      throw error
    }
  }

  /**
   * Graceful shutdown
   */
  static async shutdown() {
    console.log('Shutting down database connection...')
    await DatabaseClient.disconnect()
  }
}

// Database transaction helper
export async function withTransaction<T>(
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return db.$transaction(callback, {
    maxWait: 5000, // 5 seconds
    timeout: 10000, // 10 seconds
  })
}

// Export the main client
export default db