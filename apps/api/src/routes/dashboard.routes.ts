import type { FastifyInstance } from 'fastify'
import { DashboardService } from '../services/subscription.service.js'

const dashboardService = new DashboardService()

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/stats', {
    preHandler: [app.authenticate],
  }, async () => {
    return dashboardService.getStats()
  })
}
