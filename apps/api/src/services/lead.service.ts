import { prisma } from '../lib/prisma.js'

function buildTelegramDisplayName(
  username: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (username) return `@${username}`
  return 'Telegram-пользователь'
}

export class LeadService {
  async createFromTelegram(input: {
    chatId: string
    username?: string | null
    firstName?: string | null
    lastName?: string | null
  }) {
    const { chatId, username, firstName, lastName } = input

    const existingLink = await prisma.telegramLink.findUnique({
      where: { chatId },
      include: { client: true },
    })

    if (existingLink?.client) {
      if (existingLink.client.status === 'PENDING') {
        throw new Error('ALREADY_PENDING')
      }
      throw new Error('ALREADY_LINKED')
    }

    const name = buildTelegramDisplayName(username, firstName, lastName)

    return prisma.client.create({
      data: {
        name,
        contact: username ? `@${username}` : `Telegram ${chatId}`,
        notes: 'Заявка из Telegram-бота (/subscribe)',
        status: 'PENDING',
        telegramLink: {
          create: {
            chatId,
            username: username ?? null,
            linkedAt: new Date(),
          },
        },
      },
      include: { telegramLink: true },
    })
  }

  async approve(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) throw new Error('CLIENT_NOT_FOUND')
    if (client.status !== 'PENDING') throw new Error('NOT_PENDING')

    return prisma.client.update({
      where: { id: clientId },
      data: { status: 'ACTIVE' },
      include: { telegramLink: true },
    })
  }

  async reject(clientId: string, reason?: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) throw new Error('CLIENT_NOT_FOUND')
    if (client.status !== 'PENDING') throw new Error('NOT_PENDING')

    const rejectionNote = reason?.trim()
      ? `Отклонено: ${reason.trim()}`
      : 'Заявка отклонена'

    const notes = client.notes
      ? `${client.notes}\n${rejectionNote}`
      : rejectionNote

    return prisma.client.update({
      where: { id: clientId },
      data: { status: 'INACTIVE', notes },
      include: { telegramLink: true },
    })
  }
}

export const leadService = new LeadService()
