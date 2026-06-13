import type { FastifyInstance } from 'fastify'
import { env } from '../config/env.js'
import { getWebhookBaseUrl } from '../lib/freekassa.js'
import { parseFreekassaWebhookPayload, paymentService } from '../services/payment.service.js'

function buildRedirectPage(title: string, message: string, botUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 48px auto; padding: 0 16px; color: #111; }
    a { color: #2481cc; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${message}</p>
  <p><a href="${botUrl}">Вернуться в Telegram-бот</a></p>
</body>
</html>`
}

function getBotUrl(): string {
  const username = env.telegramBotUsername.replace(/^@/, '')
  return username ? `https://t.me/${username}` : 'https://t.me'
}

async function handleWebhook(
  payload: Record<string, unknown>,
  request: { ip?: string; headers: Record<string, string | string[] | undefined> },
) {
  const parsed = parseFreekassaWebhookPayload(payload, request)
  return paymentService.processFreekassaWebhook(parsed)
}

export async function freekassaRoutes(app: FastifyInstance) {
  app.get('/webhooks/freekassa', async (request, reply) => {
    const result = await handleWebhook(
      request.query as Record<string, unknown>,
      { ip: request.ip, headers: request.headers },
    )
    return reply.type('text/plain').send(result)
  })

  app.post('/webhooks/freekassa', async (request, reply) => {
    const result = await handleWebhook(
      (request.body ?? {}) as Record<string, unknown>,
      { ip: request.ip, headers: request.headers },
    )
    return reply.type('text/plain').send(result)
  })

  app.get('/webhooks/freekassa/success', async (_request, reply) => {
    const html = buildRedirectPage(
      'Оплата прошла',
      'Спасибо! Платёж принят. Вернитесь в Telegram — бот пришлёт подтверждение и ключ VPN.',
      getBotUrl(),
    )
    return reply.type('text/html; charset=utf-8').send(html)
  })

  app.get('/webhooks/freekassa/fail', async (_request, reply) => {
    const html = buildRedirectPage(
      'Оплата не завершена',
      'Платёж отменён или не прошёл. Попробуйте снова через /pay в Telegram-боте.',
      getBotUrl(),
    )
    return reply.type('text/html; charset=utf-8').send(html)
  })

  app.get('/webhooks/freekassa/settings', {
    preHandler: [app.authenticate],
  }, async () => {
    const base = getWebhookBaseUrl()
    return {
      notificationUrl: `${base}/webhooks/freekassa`,
      successUrl: `${base}/webhooks/freekassa/success`,
      failUrl: `${base}/webhooks/freekassa/fail`,
      notificationMethod: 'POST',
    }
  })
}
