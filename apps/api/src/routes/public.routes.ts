import type { FastifyInstance } from 'fastify'
import { buildShopInfoText, getShopInfoUrl, renderShopPage } from '../lib/shop-page.js'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'

async function loadActivePlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { durationDays: 'asc' },
  })

  return plans.map((plan) => ({
    name: plan.name,
    durationDays: plan.durationDays,
    price: plan.price.toString(),
    maxDevices: plan.maxDevices,
  }))
}

export async function publicRoutes(app: FastifyInstance) {
  app.get('/public/shop', async (_request, reply) => {
    const plans = await loadActivePlans()
    const html = renderShopPage(plans)
    return reply.type('text/html; charset=utf-8').send(html)
  })

  app.get('/public/shop/info', async () => {
    const plans = await loadActivePlans()
    return {
      shopName: env.shopName,
      url: getShopInfoUrl(),
      text: buildShopInfoText(plans),
    }
  })
}
