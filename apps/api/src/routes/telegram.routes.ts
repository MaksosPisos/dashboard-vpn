import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { triggerExpiryRemindersManually } from '../scheduler.js'
import { leadService } from '../services/lead.service.js'
import { telegramService } from '../services/telegram.service.js'
import { subscribeTelegramSchema } from '../schemas/index.js'
const linkSchema = z.object({
  token: z.string().min(1),
  chatId: z.string().min(1),
  username: z.string().nullable().optional(),
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticateBot: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export function registerBotAuth(app: FastifyInstance) {
  app.decorate('authenticateBot', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.headers['x-bot-key']
    if (key !== env.botApiKey) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }
  })
}

export async function telegramRoutes(app: FastifyInstance) {
  app.post('/clients/:id/telegram/link', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      return await telegramService.createLinkToken(id)
    } catch (error) {
      if (error instanceof Error && error.message === 'CLIENT_NOT_FOUND') {
        return reply.status(404).send({ message: 'Client not found' })
      }
      if (error instanceof Error && error.message.includes('TELEGRAM_BOT_USERNAME')) {
        return reply.status(503).send({
          message: 'TELEGRAM_BOT_USERNAME не задан в .env. Перезапустите API после настройки.',
        })
      }
      throw error
    }
  })

  app.delete('/clients/:id/telegram/link', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { id } = request.params as { id: string }
    return telegramService.unlink(id)
  })

  app.post('/clients/:id/telegram/payment-reminder', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const client = await prisma.client.findUnique({ where: { id }, select: { id: true } })
    if (!client) {
      return reply.status(404).send({ message: 'Client not found' })
    }

    try {
      const result = await telegramService.notifyPaymentRequest(id)
      if (result.skipped && 'reason' in result && result.reason === 'not_linked') {
        return reply.status(400).send({ message: 'Telegram не привязан к клиенту' })
      }
      return result
    } catch (error) {
      if (error instanceof Error && error.message.includes('Telegram API error')) {
        return reply.status(502).send({ message: 'Не удалось отправить сообщение в Telegram' })
      }
      throw error
    }
  })

  app.post('/internal/telegram/subscribe', {
    preHandler: [app.authenticateBot],
  }, async (request, reply) => {
    const body = subscribeTelegramSchema.parse(request.body)

    try {
      const client = await leadService.createFromTelegram(body)

      telegramService
        .notifyAdminsNewLead(client.name, client.telegramLink?.username ?? null)
        .catch((err) => console.error('[telegram] new lead notify failed', err))

      return {
        clientId: client.id,
        clientName: client.name,
        status: 'pending',
      }
    } catch (error) {
      if (error instanceof Error) {
        const messages: Record<string, string> = {
          ALREADY_PENDING: 'Заявка уже отправлена и ожидает подтверждения',
          ALREADY_LINKED: 'Аккаунт уже привязан',
        }
        const message = messages[error.message]
        if (message) return reply.status(400).send({ message })
      }
      throw error
    }
  })

  app.post('/internal/telegram/link', {
    preHandler: [app.authenticateBot],
  }, async (request, reply) => {
    const body = linkSchema.parse(request.body)

    try {
      return await telegramService.linkByToken(body.token, body.chatId, body.username)
    } catch (error) {
      if (error instanceof Error) {
        const messages: Record<string, string> = {
          INVALID_TOKEN: 'Invalid or expired link token',
          TOKEN_ALREADY_USED: 'Link token already used',
          CHAT_ALREADY_LINKED: 'This Telegram account is linked to another client',
        }
        const message = messages[error.message]
        if (message) return reply.status(400).send({ message })
      }
      throw error
    }
  })

  app.get('/internal/telegram/:chatId/status', {
    preHandler: [app.authenticateBot],
  }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string }

    try {
      return await telegramService.getClientStatusByChatId(chatId)
    } catch {
      return reply.status(404).send({ message: 'Account not linked' })
    }
  })

  app.get('/internal/telegram/:chatId/config', {
    preHandler: [app.authenticateBot],
  }, async (request, reply) => {
    const { chatId } = request.params as { chatId: string }

    try {
      return await telegramService.getActiveConfigByChatId(chatId)
    } catch (error) {
      if (error instanceof Error) {
        const statusMap: Record<string, number> = {
          NOT_LINKED: 404,
          SUBSCRIPTION_INACTIVE: 403,
          NO_CONFIG: 404,
          CLIENT_PENDING: 403,
        }
        const status = statusMap[error.message]
        if (status) {
          return reply.status(status).send({ message: error.message })
        }
      }
      throw error
    }
  })

  app.get('/internal/dashboard/stats', {
    preHandler: [app.authenticateBot],
  }, async () => {
    return telegramService.getDashboardStatsForBot()
  })

  app.post('/internal/jobs/expiry-reminders', {
    preHandler: [app.authenticateBot],
  }, async () => {
    return triggerExpiryRemindersManually()
  })
}
