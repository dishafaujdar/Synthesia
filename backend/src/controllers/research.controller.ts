import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'
import { queueManager } from '../services/queue-manager'
import { v4 as uuidv4 } from 'uuid'

const researchSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(200, 'Topic too long'),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal')
})

export class ResearchController {
  // POST /research - Submit new research topic
  static async submitResearch(req: Request, res: Response) {
    try {
      const { topic, priority } = researchSchema.parse(req.body)

      // Check if queue manager is available
      if (!queueManager.isAvailable()) {
        console.error('❌ Queue manager not available - research cannot be processed')
        return res.status(503).json({
          success: false,
          error: 'Research service is temporarily unavailable. Please try again later.',
          details: 'Queue manager is not ready'
        })
      }

      // Step 1: Input Parsing & Validation
      const taskId = uuidv4()
      const correlationId = uuidv4()
      console.log(`📝 Creating research task: ${taskId} for topic: "${topic}"`)

      const task = await prisma.researchRequest.create({
        data: {
          id: taskId,
          topic,
          priority,
          status: 'PENDING',
          correlationId
        }
      })

      // Step 2: Add job to queue
      try {
        await queueManager.addJob({
          id: task.id,
          topic,
          priority
        })

        console.log(`✅ Research task ${taskId} submitted successfully`)

        // Return the task object that matches frontend expectations
        const createdTask = await prisma.researchRequest.findUnique({
          where: { id: taskId },
          include: {
            results: {
              include: {
                articles: true
              }
            },
            taskLogs: {
              orderBy: { timestamp: 'desc' }
            }
          }
        })

        return res.status(201).json(createdTask)

      } catch (queueError: any) {
        console.error('❌ Failed to add job to queue:', queueError.message)
        
        // Update task status to failed
        await prisma.researchRequest.update({
          where: { id: taskId },
          data: { status: 'FAILED', error: queueError.message }
        })

        return res.status(503).json({
          success: false,
          error: 'Failed to queue research task',
          details: queueError.message
        })
      }

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      }

      console.error('❌ Error submitting research:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    }
  }

  // GET /research - List all research tasks
  static async listResearch(_req: Request, res: Response) {
    try {
      const tasks = await prisma.researchRequest.findMany({
        include: {
          results: {
            include: {
              articles: true
            }
          },
          taskLogs: {
            orderBy: { timestamp: 'desc' },
            take: 5
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      // Return format expected by frontend
      return res.json({
        data: tasks,
        pagination: {
          page: 1,
          limit: 50,
          total: tasks.length,
          pages: 1
        }
      })

    } catch (error: any) {
      console.error('❌ Error fetching research tasks:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    }
  }

  // GET /research/:id - Get specific research task with logs and results
  static async getResearch(req: Request, res: Response) {
    try {
      const { id } = req.params

      const task = await prisma.researchRequest.findUnique({
        where: { id },
        include: {
          results: {
            include: {
              articles: {
                orderBy: { extractedAt: 'desc' }
              }
            }
          },
          taskLogs: {
            orderBy: { timestamp: 'asc' }
          }
        }
      })

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Research task not found'
        })
      }

      return res.json(task)

    } catch (error: any) {
      console.error('❌ Error fetching research task:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    }
  }

  // GET /research/:id/status - Get specific research task status
  static async getResearchStatus(req: Request, res: Response) {
    try {
      const { id } = req.params

      const task = await prisma.researchRequest.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          progress: true,
          error: true,
          updatedAt: true
        }
      })

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Research task not found'
        })
      }

      return res.json(task)

    } catch (error: any) {
      console.error('❌ Error fetching research status:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    }
  }

  // GET /research/:id/logs - Get research task logs
  static async getResearchLogs(req: Request, res: Response) {
    try {
      const { id } = req.params

      const logs = await prisma.taskLog.findMany({
        where: { researchRequestId: id },
        orderBy: { timestamp: 'asc' }
      })

      return res.json(logs)

    } catch (error: any) {
      console.error('❌ Error fetching research logs:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    }
  }

  // DELETE /research/:id - Cancel/delete research task
  static async deleteResearch(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { force } = req.query

      const task = await prisma.researchRequest.findUnique({
        where: { id }
      })

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Research task not found'
        })
      }

      // If not force delete and task is processing, just cancel it
      if (!force && (task.status === 'IN_PROGRESS' || task.status === 'PENDING')) {
        await prisma.researchRequest.update({
          where: { id },
          data: { status: 'CANCELLED' }
        })

        return res.json({
          message: 'Research task cancelled successfully'
        })
      }

      // Force delete or delete completed/failed tasks
      await prisma.researchRequest.delete({
        where: { id }
      })

      return res.json({
        message: 'Research task deleted successfully'
      })

    } catch (error: any) {
      console.error('❌ Error deleting research task:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    }
  }

  // DELETE /research - Bulk delete research tasks
  static async bulkDeleteResearch(req: Request, res: Response) {
    try {
      const { ids, status, olderThan } = req.body

      let whereClause: any = {}

      if (ids && ids.length > 0) {
        whereClause.id = { in: ids }
      }

      if (status) {
        whereClause.status = status
      }

      if (olderThan) {
        whereClause.createdAt = {
          lt: new Date(olderThan)
        }
      }

      const result = await prisma.researchRequest.deleteMany({
        where: whereClause
      })

      return res.json({
        message: `Successfully deleted ${result.count} research tasks`,
        deletedCount: result.count
      })

    } catch (error: any) {
      console.error('❌ Error bulk deleting research tasks:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    }
  }

  // GET /queue/status - Get queue status
  static async getQueueStatus(_req: Request, res: Response) {
    try {
      const isAvailable = queueManager.isAvailable()
      const stats = await queueManager.getQueueStats()

      return res.json({
        success: true,
        queue: {
          available: isAvailable,
          stats: stats?.stats || null,
          healthy: stats?.isHealthy || false,
          error: stats?.error || null
        }
      })

    } catch (error: any) {
      console.error('❌ Error getting queue status:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to get queue status',
        details: error.message
      })
    }
  }
}
