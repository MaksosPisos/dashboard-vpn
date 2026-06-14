import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { ZodError } from 'zod'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { authRoutes, ensureAdminUser, registerAuthHook } from './routes/auth.routes.js'
import { dashboardRoutes } from './routes/dashboard.routes.js'
import { clientRoutes } from './routes/client.routes.js'
import { planRoutes } from './routes/plan.routes.js'
import { subscriptionRoutes } from './routes/subscription.routes.js'
import { paymentRoutes } from './routes/payment.routes.js'
import { freekassaRoutes } from './routes/freekassa.routes.js'
import { publicRoutes } from './routes/public.routes.js'
import { vpnRoutes } from './routes/vpn.routes.js'
import { telegramRoutes, registerBotAuth } from './routes/telegram.routes.js'
import { startScheduler, stopScheduler } from './scheduler.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })
await app.register(jwt, { secret: env.jwtSecret })

registerAuthHook(app)
registerBotAuth(app)

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error',
      errors: error.flatten(),
    })
  }

  app.log.error(error)
  return reply.status(500).send({ message: 'Internal server error' })
})

app.get('/health', async () => ({ status: 'ok' }))

await app.register(authRoutes)
await app.register(dashboardRoutes)
await app.register(clientRoutes)
await app.register(planRoutes)
await app.register(subscriptionRoutes)
await app.register(paymentRoutes)
await app.register(freekassaRoutes)
await app.register(publicRoutes)
await app.register(vpnRoutes)
await app.register(telegramRoutes)

async function start() {
  await ensureAdminUser()

  startScheduler()

  await app.listen({ port: env.port, host: '0.0.0.0' })
  console.log(`API running on http://localhost:${env.port}`)
}

start().catch(async (error) => {
  app.log.error(error)
  await prisma.$disconnect()
  process.exit(1)
})

process.on('SIGINT', async () => {
  stopScheduler()
  await prisma.$disconnect()
  process.exit(0)
})
