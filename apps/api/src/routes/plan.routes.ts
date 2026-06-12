import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { createPlanSchema, updatePlanSchema } from '../schemas/index.js'

function mapPlan(plan: {
  id: string
  name: string
  durationDays: number
  price: { toString(): string }
  maxDevices: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: plan.id,
    name: plan.name,
    durationDays: plan.durationDays,
    price: plan.price.toString(),
    maxDevices: plan.maxDevices,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}

export async function planRoutes(app: FastifyInstance) {
  app.get('/plans', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { all } = request.query as { all?: string }

    const plans = await prisma.plan.findMany({
      where: all === 'true' ? {} : { isActive: true },
      orderBy: { durationDays: 'asc' },
    })

    return plans.map(mapPlan)
  })

  app.post('/plans', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const body = createPlanSchema.parse(request.body)

    const plan = await prisma.plan.create({
      data: {
        name: body.name,
        durationDays: body.durationDays,
        price: body.price,
        maxDevices: body.maxDevices ?? 1,
      },
    })

    return mapPlan(plan)
  })

  app.patch('/plans/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updatePlanSchema.parse(request.body)

    try {
      const plan = await prisma.plan.update({ where: { id }, data: body })
      return mapPlan(plan)
    } catch {
      return reply.status(404).send({ message: 'Plan not found' })
    }
  })
}
