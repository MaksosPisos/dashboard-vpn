import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export async function paymentRoutes(app: FastifyInstance) {
  app.get('/payments', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { from, to } = request.query as { from?: string; to?: string }

    const payments = await prisma.payment.findMany({
      where: {
        ...(from || to
          ? {
              paidAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        client: true,
        plan: true,
      },
      orderBy: { paidAt: 'desc' },
      take: 200,
    })

    return payments.map((payment) => ({
      id: payment.id,
      clientId: payment.clientId,
      clientName: payment.client.name,
      subscriptionId: payment.subscriptionId,
      planId: payment.planId,
      planName: payment.plan?.name ?? null,
      amount: payment.amount.toString(),
      paidAt: payment.paidAt.toISOString(),
      method: payment.method,
      status: payment.status,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
    }))
  })
}
