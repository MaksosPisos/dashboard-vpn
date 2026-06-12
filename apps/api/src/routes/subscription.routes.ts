import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { addDays } from '../services/date.js'
import { resolveSubscriptionDisplayStatus } from '../services/subscription.service.js'

export async function subscriptionRoutes(app: FastifyInstance) {
  app.get('/subscriptions', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { status } = request.query as { status?: string }
    const now = new Date()
    const inSevenDays = addDays(now, 7)

    let where = {}

    if (status === 'expiring') {
      where = {
        status: 'ACTIVE',
        endDate: { gte: now, lte: inSevenDays },
      }
    } else if (status === 'expired') {
      where = {
        OR: [
          { status: 'EXPIRED' },
          { status: 'ACTIVE', endDate: { lt: now } },
        ],
      }
    } else if (status === 'active') {
      where = {
        status: 'ACTIVE',
        endDate: { gt: inSevenDays },
      }
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        client: true,
        plan: true,
      },
      orderBy: { endDate: 'asc' },
    })

    return subscriptions.map((sub) => ({
      id: sub.id,
      clientId: sub.clientId,
      clientName: sub.client.name,
      planId: sub.planId,
      planName: sub.plan.name,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate.toISOString(),
      status: sub.status,
      displayStatus: resolveSubscriptionDisplayStatus(sub.endDate, sub.status),
      createdAt: sub.createdAt.toISOString(),
    }))
  })
}
