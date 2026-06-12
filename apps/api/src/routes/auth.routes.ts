import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'
import { loginSchema } from '../schemas/index.js'

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    const user = await prisma.adminUser.findUnique({
      where: { email: body.email },
    })

    if (!user) {
      return reply.status(401).send({ message: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ message: 'Invalid credentials' })
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email })

    return {
      token,
      user: { id: user.id, email: user.email },
    }
  })

  app.get('/auth/me', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const payload = request.user as { sub: string; email: string }
    return { id: payload.sub, email: payload.email }
  })
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export function registerAuthHook(app: FastifyInstance) {
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ message: 'Unauthorized' })
    }
  })
}

export async function ensureAdminUser() {
  const existing = await prisma.adminUser.findUnique({
    where: { email: env.adminEmail },
  })

  if (!existing) {
    const passwordHash = await bcrypt.hash(env.adminPassword, 10)
    await prisma.adminUser.create({
      data: {
        email: env.adminEmail,
        passwordHash,
      },
    })
  }
}
