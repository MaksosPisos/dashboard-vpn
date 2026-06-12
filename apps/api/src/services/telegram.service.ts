import { randomBytes } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'
import { addDays, differenceInCalendarDays } from './date.js'
import { resolveSubscriptionDisplayStatus } from './subscription.service.js'

function formatRub(amount: number | string) {
  return `${Number(amount).toLocaleString('ru-RU')} ₽`
}

function generateLinkToken(): string {
  return randomBytes(16).toString('hex')
}

function buildDeepLink(token: string): string {
  const payload = `link_${token}`
  const username = env.telegramBotUsername.replace(/^@/, '')

  if (!username) {
    throw new Error('TELEGRAM_BOT_USERNAME is not set in .env')
  }

  return `https://t.me/${username}?start=${payload}`
}

export class TelegramService {
  async createLinkToken(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { telegramLink: true },
    })

    if (!client) {
      throw new Error('CLIENT_NOT_FOUND')
    }

    if (client.telegramLink?.chatId) {
      return {
        linked: true,
        deepLink: null,
        token: null,
        username: client.telegramLink.username,
        linkedAt: client.telegramLink.linkedAt?.toISOString() ?? null,
      }
    }

    const token = generateLinkToken()

    await prisma.telegramLink.upsert({
      where: { clientId },
      create: { clientId, linkToken: token },
      update: { linkToken: token, chatId: null, username: null, linkedAt: null },
    })

    return {
      linked: false,
      deepLink: buildDeepLink(token),
      startPayload: `link_${token}`,
      botUsername: env.telegramBotUsername.replace(/^@/, ''),
      token,
      username: null,
      linkedAt: null,
    }
  }

  async unlink(clientId: string) {
    await prisma.telegramLink.deleteMany({ where: { clientId } })
    return { success: true }
  }

  async linkByToken(token: string, chatId: string, username?: string | null) {
    const link = await prisma.telegramLink.findUnique({
      where: { linkToken: token },
      include: { client: true },
    })

    if (!link) {
      throw new Error('INVALID_TOKEN')
    }

    if (link.chatId && link.chatId !== chatId) {
      throw new Error('TOKEN_ALREADY_USED')
    }

    const existingChat = await prisma.telegramLink.findUnique({
      where: { chatId },
    })

    if (existingChat && existingChat.clientId !== link.clientId) {
      throw new Error('CHAT_ALREADY_LINKED')
    }

    const updated = await prisma.telegramLink.update({
      where: { id: link.id },
      data: {
        chatId,
        username: username ?? null,
        linkedAt: new Date(),
        linkToken: null,
      },
      include: { client: true },
    })

    return {
      clientId: updated.clientId,
      clientName: updated.client.name,
    }
  }

  async getClientStatusByChatId(chatId: string) {
    const link = await prisma.telegramLink.findUnique({
      where: { chatId },
      include: {
        client: {
          include: {
            subscriptions: {
              orderBy: { endDate: 'desc' },
              take: 1,
              include: { plan: true },
            },
          },
        },
      },
    })

    if (!link?.client) {
      throw new Error('NOT_LINKED')
    }

    const subscription = link.client.subscriptions[0]
    if (!subscription) {
      return {
        clientName: link.client.name,
        planName: null,
        endDate: null,
        daysLeft: null,
        displayStatus: 'no_subscription' as const,
      }
    }

    const daysLeft = differenceInCalendarDays(subscription.endDate, new Date())

    return {
      clientName: link.client.name,
      planName: subscription.plan.name,
      endDate: subscription.endDate.toISOString(),
      daysLeft,
      displayStatus: resolveSubscriptionDisplayStatus(subscription.endDate, subscription.status),
    }
  }

  async getActiveConfigByChatId(chatId: string) {
    const link = await prisma.telegramLink.findUnique({
      where: { chatId },
      include: {
        client: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE', endDate: { gte: new Date() } },
              take: 1,
            },
            vpnAccounts: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!link?.client) {
      throw new Error('NOT_LINKED')
    }

    if (!link.client.subscriptions.length) {
      throw new Error('SUBSCRIPTION_INACTIVE')
    }

    const account = link.client.vpnAccounts[0]
    if (!account?.configSnapshot) {
      throw new Error('NO_CONFIG')
    }

    return {
      label: account.label,
      config: account.configSnapshot,
    }
  }

  async sendMessage(chatId: string, text: string) {
    if (!env.telegramBotToken) {
      console.log(`[telegram] skip notify (no token): ${chatId}`)
      return { skipped: true }
    }

    const response = await fetch(
      `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      },
    )

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Telegram API error: ${body}`)
    }

    return { sent: true }
  }

  async notifyPaymentExtended(clientId: string, endDate: Date, planName: string) {
    const link = await prisma.telegramLink.findUnique({ where: { clientId } })
    if (!link?.chatId) return { skipped: true, reason: 'not_linked' }

    const formatted = endDate.toLocaleDateString('ru-RU')
    const text =
      `✅ <b>Подписка продлена</b>\n\n` +
      `Тариф: ${planName}\n` +
      `Действует до: ${formatted}\n\n` +
      `/status — проверить статус`

    return this.sendMessage(link.chatId, text)
  }

  async notifySubscriptionSuspended(clientId: string, planName: string) {
    const link = await prisma.telegramLink.findUnique({ where: { clientId } })
    if (!link?.chatId) return { skipped: true, reason: 'not_linked' }

    const text =
      `⏸ <b>Подписка приостановлена</b>\n\n` +
      `Тариф: ${planName}\n` +
      `Доступ к VPN временно отключён.\n` +
      `Оставшееся время сохранится при возобновлении.\n\n` +
      `/status — проверить статус`

    return this.sendMessage(link.chatId, text)
  }

  async notifySubscriptionResumed(clientId: string, planName: string, endDate: Date) {
    const link = await prisma.telegramLink.findUnique({ where: { clientId } })
    if (!link?.chatId) return { skipped: true, reason: 'not_linked' }

    const formatted = endDate.toLocaleDateString('ru-RU')
    const text =
      `▶️ <b>Подписка возобновлена</b>\n\n` +
      `Тариф: ${planName}\n` +
      `Действует до: ${formatted}\n\n` +
      `/config — получить VPN-ключ\n` +
      `/status — проверить статус`

    return this.sendMessage(link.chatId, text)
  }

  /** @deprecated use notifySubscriptionSuspended */
  async notifySubscriptionCancelled(clientId: string, planName: string) {
    return this.notifySubscriptionSuspended(clientId, planName)
  }

  async notifyPaymentRequest(clientId: string) {
    const link = await prisma.telegramLink.findUnique({
      where: { clientId },
      include: {
        client: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              orderBy: { endDate: 'desc' },
              take: 1,
              include: { plan: true },
            },
          },
        },
      },
    })

    if (!link?.chatId) return { skipped: true, reason: 'not_linked' }

    const subscription = link.client.subscriptions[0]
    let text = `💳 <b>Необходима оплата</b>\n\n`

    if (subscription) {
      const formatted = subscription.endDate.toLocaleDateString('ru-RU')
      const daysLeft = differenceInCalendarDays(subscription.endDate, new Date())

      if (daysLeft < 0) {
        text += `Подписка «${subscription.plan.name}» истекла ${formatted}.\n`
      } else if (daysLeft === 0) {
        text += `Подписка «${subscription.plan.name}» истекает сегодня.\n`
      } else if (daysLeft <= 7) {
        const dayWord = daysLeft === 1 ? 'день' : daysLeft <= 4 ? 'дня' : 'дней'
        text += `Подписка «${subscription.plan.name}» истекает ${formatted} (осталось ${daysLeft} ${dayWord}).\n`
      } else {
        text += `Продлите подписку «${subscription.plan.name}» (действует до ${formatted}).\n`
      }

      text += `Стоимость продления: ${formatRub(Number(subscription.plan.price))}\n\n`
    } else {
      text += `Для доступа к VPN необходимо оплатить подписку.\n\n`
    }

    text += `Свяжитесь с администратором для оплаты.\n/pay — инструкция\n/status — проверить статус`

    return this.sendMessage(link.chatId, text)
  }

  async notifyExpiryReminder(
    chatId: string,
    clientName: string,
    planName: string,
    endDate: Date,
    daysLeft: number,
  ) {
    const formatted = endDate.toLocaleDateString('ru-RU')
    const dayWord = daysLeft === 1 ? 'день' : daysLeft <= 4 ? 'дня' : 'дней'
    const text =
      `⚠️ <b>Подписка скоро истекает</b>\n\n` +
      `Клиент: ${clientName}\n` +
      `Тариф: ${planName}\n` +
      `Осталось: ${daysLeft} ${dayWord}\n` +
      `Действует до: ${formatted}\n\n` +
      `/pay — как продлить\n` +
      `/status — проверить статус`

    return this.sendMessage(chatId, text)
  }

  async notifyAdminsExpiryDigest(result: {
    notified: number
    byDays: Record<number, number>
  }) {
    if (!env.telegramAdminIds.length) return { skipped: true, reason: 'no_admins' }

    const lines = Object.entries(result.byDays)
      .filter(([, count]) => count > 0)
      .map(([days, count]) => {
        const d = Number(days)
        const dayWord = d === 1 ? 'день' : d <= 4 ? 'дня' : 'дней'
        return `· за ${d} ${dayWord}: ${count}`
      })

    const text =
      `📋 <b>Напоминания об истечении</b>\n\n` +
      `Отправлено клиентам: ${result.notified}\n` +
      (lines.length ? `${lines.join('\n')}\n\n` : '\n') +
      `Cron: ежедневная проверка подписок`

    for (const adminId of env.telegramAdminIds) {
      await this.sendMessage(adminId, text)
    }

    return { sent: true }
  }

  async getDashboardStatsForBot() {
    const now = new Date()
    const inSevenDays = addDays(now, 7)

    const [activeClients, expiringSoon, expired] = await Promise.all([
      prisma.client.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: inSevenDays } },
      }),
      prisma.subscription.count({
        where: {
          OR: [
            { status: 'EXPIRED' },
            { status: 'ACTIVE', endDate: { lt: now } },
          ],
        },
      }),
    ])

    return { activeClients, expiringSoon, expired }
  }
}

export const telegramService = new TelegramService()
