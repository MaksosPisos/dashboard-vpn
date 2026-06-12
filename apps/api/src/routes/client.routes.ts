import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import {
  createClientSchema,
  cancelSubscriptionSchema,
  createManualPaymentSchema,
  createVpnAccountSchema,
  resumeSubscriptionSchema,
  suspendSubscriptionSchema,
  updateClientSchema,
} from '../schemas/index.js'
import {
  resolveSubscriptionDisplayStatus,
  SubscriptionService,
} from '../services/subscription.service.js'
import { telegramService } from '../services/telegram.service.js'

const subscriptionService = new SubscriptionService()

function mapClientStatus(status: string) {
  return status.toLowerCase() as 'active' | 'inactive' | 'suspended'
}

function mapSubscriptionResponse(subscription: {
  id: string
  clientId: string
  planId: string
  startDate: Date
  endDate: Date
  status: string
  suspendedAt: Date | null
  createdAt: Date
  updatedAt: Date
  plan: {
    id: string
    name: string
    durationDays: number
    price: { toString(): string }
    maxDevices: number
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }
}) {
  return {
    id: subscription.id,
    clientId: subscription.clientId,
    planId: subscription.planId,
    startDate: subscription.startDate.toISOString(),
    endDate: subscription.endDate.toISOString(),
    status: subscription.status,
    suspendedAt: subscription.suspendedAt?.toISOString() ?? null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
    plan: {
      ...subscription.plan,
      price: subscription.plan.price.toString(),
      createdAt: subscription.plan.createdAt.toISOString(),
      updatedAt: subscription.plan.updatedAt.toISOString(),
    },
  }
}

export async function clientRoutes(app: FastifyInstance) {
  app.get('/clients', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const query = request.query as {
      search?: string
      status?: string
      subscriptionStatus?: string
    }

    const clients = await prisma.client.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { contact: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.status
          ? { status: query.status.toUpperCase() as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' }
          : {}),
      },
      include: {
        vpnAccounts: { where: { status: 'ACTIVE' } },
        telegramLink: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { endDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const mapped = clients.map((client) => {
      const subscription = client.subscriptions[0]
      return {
        id: client.id,
        name: client.name,
        contact: client.contact,
        notes: client.notes,
        status: mapClientStatus(client.status),
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
        activeAccountsCount: client.vpnAccounts.length,
        subscriptionEndDate: subscription?.endDate.toISOString() ?? null,
        subscriptionStatus: subscription
          ? resolveSubscriptionDisplayStatus(subscription.endDate, subscription.status)
          : null,
        telegramUsername: client.telegramLink?.username ?? null,
      }
    })

    if (query.subscriptionStatus) {
      return mapped.filter((c) => c.subscriptionStatus === query.subscriptionStatus)
    }

    return mapped
  })

  app.get('/clients/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          include: { plan: true },
          orderBy: { paidAt: 'desc' },
        },
        vpnAccounts: {
          include: { server: true },
          orderBy: { createdAt: 'desc' },
        },
        telegramLink: true,
      },
    })

    if (!client) {
      return reply.status(404).send({ message: 'Client not found' })
    }

    return {
      id: client.id,
      name: client.name,
      contact: client.contact,
      notes: client.notes,
      status: mapClientStatus(client.status),
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      subscriptions: client.subscriptions.map((sub) => ({
        id: sub.id,
        clientId: sub.clientId,
        planId: sub.planId,
        startDate: sub.startDate.toISOString(),
        endDate: sub.endDate.toISOString(),
        status: sub.status,
        suspendedAt: sub.suspendedAt?.toISOString() ?? null,
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString(),
        plan: {
          ...sub.plan,
          price: sub.plan.price.toString(),
          createdAt: sub.plan.createdAt.toISOString(),
          updatedAt: sub.plan.updatedAt.toISOString(),
        },
      })),
      payments: client.payments.map((payment) => ({
        id: payment.id,
        clientId: payment.clientId,
        subscriptionId: payment.subscriptionId,
        planId: payment.planId,
        amount: payment.amount.toString(),
        paidAt: payment.paidAt.toISOString(),
        method: payment.method,
        status: payment.status,
        externalPaymentId: payment.externalPaymentId,
        notes: payment.notes,
        createdAt: payment.createdAt.toISOString(),
      })),
      vpnAccounts: client.vpnAccounts.map((account) => ({
        id: account.id,
        clientId: account.clientId,
        serverId: account.serverId,
        label: account.label,
        externalPeerId: account.externalPeerId,
        status: account.status,
        configSnapshot: account.configSnapshot,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        server: account.server
          ? {
              ...account.server,
              createdAt: account.server.createdAt.toISOString(),
              updatedAt: account.server.updatedAt.toISOString(),
            }
          : null,
      })),
      telegramLink: client.telegramLink
        ? {
            id: client.telegramLink.id,
            clientId: client.telegramLink.clientId,
            chatId: client.telegramLink.chatId,
            username: client.telegramLink.username,
            linkedAt: client.telegramLink.linkedAt?.toISOString() ?? null,
            isLinked: Boolean(client.telegramLink.chatId),
          }
        : null,
    }
  })

  app.post('/clients', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const body = createClientSchema.parse(request.body)

    const client = await prisma.client.create({
      data: {
        name: body.name,
        contact: body.contact,
        notes: body.notes,
      },
    })

    return {
      id: client.id,
      name: client.name,
      contact: client.contact,
      notes: client.notes,
      status: mapClientStatus(client.status),
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    }
  })

  app.patch('/clients/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateClientSchema.parse(request.body)

    try {
      const client = await prisma.client.update({
        where: { id },
        data: body,
      })

      return {
        id: client.id,
        name: client.name,
        contact: client.contact,
        notes: client.notes,
        status: mapClientStatus(client.status),
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
      }
    } catch {
      return reply.status(404).send({ message: 'Client not found' })
    }
  })

  app.delete('/clients/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await prisma.client.delete({ where: { id } })
      return { success: true }
    } catch {
      return reply.status(404).send({ message: 'Client not found' })
    }
  })

  app.post('/clients/:id/payments', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createManualPaymentSchema.parse(request.body)

    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) {
      return reply.status(404).send({ message: 'Client not found' })
    }

    const subscription = await subscriptionService.extend(id, body.planId, body.paidAt)

    const payment = await prisma.payment.create({
      data: {
        clientId: id,
        subscriptionId: subscription.id,
        planId: body.planId,
        amount: body.amount,
        paidAt: body.paidAt ?? new Date(),
        method: body.method,
        status: 'PAID',
        notes: body.notes,
      },
      include: { plan: true },
    })

    if (body.notifyTelegram) {
      telegramService
        .notifyPaymentExtended(id, subscription.endDate, subscription.plan.name)
        .catch((err) => console.error('[telegram] payment notify failed', err))
    }

    return {
      payment: {
        id: payment.id,
        clientId: payment.clientId,
        subscriptionId: payment.subscriptionId,
        planId: payment.planId,
        amount: payment.amount.toString(),
        paidAt: payment.paidAt.toISOString(),
        method: payment.method,
        status: payment.status,
        externalPaymentId: payment.externalPaymentId,
        notes: payment.notes,
        createdAt: payment.createdAt.toISOString(),
      },
      subscription: {
        id: subscription.id,
        clientId: subscription.clientId,
        planId: subscription.planId,
        startDate: subscription.startDate.toISOString(),
        endDate: subscription.endDate.toISOString(),
        status: subscription.status,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
        plan: {
          ...subscription.plan,
          price: subscription.plan.price.toString(),
          createdAt: subscription.plan.createdAt.toISOString(),
          updatedAt: subscription.plan.updatedAt.toISOString(),
        },
      },
    }
  })

  app.post('/clients/:id/subscriptions/suspend', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = suspendSubscriptionSchema.parse(request.body ?? {})

    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) {
      return reply.status(404).send({ message: 'Client not found' })
    }

    try {
      const { subscription, notifyTelegram } = await subscriptionService.suspend(id, {
        suspendVpn: body.suspendVpn,
        notifyTelegram: body.notifyTelegram,
      })

      if (notifyTelegram) {
        telegramService
          .notifySubscriptionSuspended(id, subscription.plan.name)
          .catch((err) => console.error('[telegram] suspend notify failed', err))
      }

      return { subscription: mapSubscriptionResponse(subscription) }
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_ACTIVE_SUBSCRIPTION') {
        return reply.status(400).send({ message: 'Нет активной подписки для приостановки' })
      }
      throw error
    }
  })

  app.post('/clients/:id/subscriptions/resume', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = resumeSubscriptionSchema.parse(request.body ?? {})

    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) {
      return reply.status(404).send({ message: 'Client not found' })
    }

    try {
      const { subscription, notifyTelegram, expiredDuringPause } =
        await subscriptionService.resume(id, {
          activateVpn: body.activateVpn,
          notifyTelegram: body.notifyTelegram,
        })

      if (notifyTelegram) {
        if (expiredDuringPause) {
          telegramService
            .notifyPaymentRequest(id)
            .catch((err) => console.error('[telegram] resume expired notify failed', err))
        } else {
          telegramService
            .notifySubscriptionResumed(id, subscription.plan.name, subscription.endDate)
            .catch((err) => console.error('[telegram] resume notify failed', err))
        }
      }

      return {
        subscription: mapSubscriptionResponse(subscription),
        expiredDuringPause,
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_SUSPENDED_SUBSCRIPTION') {
        return reply.status(400).send({ message: 'Нет приостановленной подписки' })
      }
      throw error
    }
  })

  app.post('/clients/:id/subscriptions/cancel', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = cancelSubscriptionSchema.parse(request.body ?? {})

    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) {
      return reply.status(404).send({ message: 'Client not found' })
    }

    try {
      const { subscription, notifyTelegram } = await subscriptionService.suspend(id, {
        suspendVpn: body.suspendVpn,
        notifyTelegram: body.notifyTelegram,
      })

      if (notifyTelegram) {
        telegramService
          .notifySubscriptionSuspended(id, subscription.plan.name)
          .catch((err) => console.error('[telegram] cancel notify failed', err))
      }

      return { subscription: mapSubscriptionResponse(subscription) }
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_ACTIVE_SUBSCRIPTION') {
        return reply.status(400).send({ message: 'Нет активной подписки для приостановки' })
      }
      throw error
    }
  })

  app.post('/clients/:id/vpn-accounts', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createVpnAccountSchema.parse(request.body)

    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) {
      return reply.status(404).send({ message: 'Client not found' })
    }

    const account = await prisma.vpnAccount.create({
      data: {
        clientId: id,
        label: body.label,
        serverId: body.serverId,
        configSnapshot: body.configSnapshot,
      },
      include: { server: true },
    })

    return {
      id: account.id,
      clientId: account.clientId,
      serverId: account.serverId,
      label: account.label,
      externalPeerId: account.externalPeerId,
      status: account.status,
      configSnapshot: account.configSnapshot,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      server: account.server
        ? {
            ...account.server,
            createdAt: account.server.createdAt.toISOString(),
            updatedAt: account.server.updatedAt.toISOString(),
          }
        : null,
    }
  })
}
