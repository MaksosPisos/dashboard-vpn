import { addDays, differenceInCalendarDays, startOfDay, startOfMonth } from './date.js'
import type { SubscriptionStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export function resolveSubscriptionDisplayStatus(
  endDate: Date,
  status: SubscriptionStatus,
): 'active' | 'expiring_soon' | 'expired' | 'suspended' {
  if (status === 'SUSPENDED') return 'suspended'
  const daysLeft = differenceInCalendarDays(endDate, new Date())
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 7) return 'expiring_soon'
  return 'active'
}

function compensatePausedPeriod(
  endDate: Date,
  suspendedAt: Date | null,
  now: Date,
): Date {
  if (!suspendedAt) return endDate
  const pauseMs = now.getTime() - suspendedAt.getTime()
  return new Date(endDate.getTime() + pauseMs)
}

export class SubscriptionService {
  private findCurrentSubscription(clientId: string) {
    return prisma.subscription.findFirst({
      where: { clientId, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      orderBy: { endDate: 'desc' },
      include: { plan: true },
    })
  }

  async extend(clientId: string, planId: string, paidAt?: Date) {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } })
    const now = new Date()
    const referenceDate = paidAt ?? now
    const isBackdated =
      differenceInCalendarDays(startOfDay(now), startOfDay(referenceDate)) > 0

    const currentSubscription = await this.findCurrentSubscription(clientId)

    if (currentSubscription && !isBackdated) {
      let effectiveEndDate = currentSubscription.endDate
      if (currentSubscription.status === 'SUSPENDED') {
        effectiveEndDate = compensatePausedPeriod(
          currentSubscription.endDate,
          currentSubscription.suspendedAt,
          now,
        )
      }

      if (effectiveEndDate >= now) {
        return prisma.subscription.update({
          where: { id: currentSubscription.id },
          data: {
            endDate: addDays(effectiveEndDate, plan.durationDays),
            planId,
            status: 'ACTIVE',
            suspendedAt: null,
          },
          include: { plan: true },
        })
      }
    }

    const startDate = referenceDate
    const endDate = addDays(startDate, plan.durationDays)
    const status = endDate < now ? 'EXPIRED' : 'ACTIVE'

    if (currentSubscription) {
      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: { status: 'EXPIRED', suspendedAt: null },
      })
    }

    return prisma.subscription.create({
      data: {
        clientId,
        planId,
        startDate,
        endDate,
        status,
      },
      include: { plan: true },
    })
  }

  async suspend(
    clientId: string,
    options: { suspendVpn?: boolean; notifyTelegram?: boolean } = {},
  ) {
    const { suspendVpn = true, notifyTelegram = false } = options
    const now = new Date()

    const activeSubscription = await prisma.subscription.findFirst({
      where: { clientId, status: 'ACTIVE' },
      orderBy: { endDate: 'desc' },
      include: { plan: true },
    })

    if (!activeSubscription) {
      throw new Error('NO_ACTIVE_SUBSCRIPTION')
    }

    const subscription = await prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: activeSubscription.id },
        data: { status: 'SUSPENDED', suspendedAt: now },
        include: { plan: true },
      })

      if (suspendVpn) {
        await tx.vpnAccount.updateMany({
          where: { clientId, status: 'ACTIVE' },
          data: { status: 'SUSPENDED' },
        })
      }

      return updated
    })

    return { subscription, notifyTelegram }
  }

  async cancel(
    clientId: string,
    options: { suspendVpn?: boolean; notifyTelegram?: boolean } = {},
  ) {
    return this.suspend(clientId, options)
  }

  async resume(
    clientId: string,
    options: { activateVpn?: boolean; notifyTelegram?: boolean } = {},
  ) {
    const { activateVpn = true, notifyTelegram = false } = options
    const now = new Date()

    const suspendedSubscription = await prisma.subscription.findFirst({
      where: { clientId, status: 'SUSPENDED' },
      orderBy: { endDate: 'desc' },
      include: { plan: true },
    })

    if (!suspendedSubscription) {
      throw new Error('NO_SUSPENDED_SUBSCRIPTION')
    }

    const endDate = compensatePausedPeriod(
      suspendedSubscription.endDate,
      suspendedSubscription.suspendedAt,
      now,
    )
    const status = endDate >= now ? 'ACTIVE' : 'EXPIRED'

    const subscription = await prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: suspendedSubscription.id },
        data: {
          status,
          endDate,
          suspendedAt: null,
        },
        include: { plan: true },
      })

      if (activateVpn && status === 'ACTIVE') {
        await tx.vpnAccount.updateMany({
          where: { clientId, status: 'SUSPENDED' },
          data: { status: 'ACTIVE' },
        })
      }

      return updated
    })

    return { subscription, notifyTelegram, expiredDuringPause: status === 'EXPIRED' }
  }
}

export class DashboardService {
  async getStats() {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const inSevenDays = addDays(now, 7)

    const [activeClients, activeSubscriptions, expiringSoon, expired, monthlyPayments] =
      await Promise.all([
        prisma.client.count({ where: { status: 'ACTIVE' } }),
        prisma.subscription.count({
          where: { status: 'ACTIVE', endDate: { gte: now } },
        }),
        prisma.subscription.count({
          where: {
            status: 'ACTIVE',
            endDate: { gte: now, lte: inSevenDays },
          },
        }),
        prisma.subscription.count({
          where: {
            OR: [
              { status: 'EXPIRED' },
              { status: 'ACTIVE', endDate: { lt: now } },
            ],
          },
        }),
        prisma.payment.findMany({
          where: {
            status: 'PAID',
            paidAt: { gte: monthStart },
          },
          include: { client: true },
          orderBy: { paidAt: 'desc' },
          take: 10,
        }),
      ])

    const monthlyRevenue = monthlyPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    )

    return {
      activeClients,
      activeSubscriptions,
      expiringSoon,
      expired,
      monthlyRevenue: monthlyRevenue.toFixed(2),
      recentPayments: monthlyPayments.map((payment) => ({
        id: payment.id,
        clientName: payment.client.name,
        amount: Number(payment.amount).toFixed(2),
        paidAt: payment.paidAt.toISOString(),
      })),
    }
  }
}
