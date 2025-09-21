import { Router } from 'express'
import { ResearchController } from '../controllers/research.controller'

const router = Router()

router.post('/research', ResearchController.submitResearch)
router.get('/research', ResearchController.listResearch)
router.get('/research/:id', ResearchController.getResearch)
router.get('/research/:id/status', ResearchController.getResearchStatus)
router.get('/research/:id/logs', ResearchController.getResearchLogs)
router.delete('/research/:id', ResearchController.deleteResearch)
router.delete('/research', ResearchController.bulkDeleteResearch)
router.get('/queue/status', ResearchController.getQueueStatus)

export default router
