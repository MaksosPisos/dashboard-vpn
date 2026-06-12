import { prisma } from '../lib/prisma.js'
import { calendarDayRangeFromToday } from './date.js'
import { telegramService } from './telegram.service.js'

export const EXPIRY_REMINDER_DAYS = [7, 3] as const

export type ExpiryReminderDays = (typeof EXPIRY_REMINDER_DAYS)[number]

export interface ExpiryReminderRunResult {
  notified: number
  skipped: number
  failed: number
  byDays: Record<number, number>
}

export class ExpiryReminderService {
  async run(): Promise<ExpiryReminderRunResult> {
    const result: ExpiryReminderRunResult = {
      notified: 0,
      skipped: 0,
      failed: 0,
      byDays: Object.fromEntries(EXPIRY_REMINDER_DAYS.map((d) => [d, 0])),
    }

    for (const daysBefore of EXPIRY_REMINDER_DAYS) {
      const subscriptions = await this.findDueSubscriptions(daysBefore)

      for (const subscription of subscriptions) {
        const chatId = subscription.client.telegramLink?.chatId
        if (!chatId) {
          result.skipped++
          continue
        }

        try {
          await telegramService.notifyExpiryReminder(
            chatId,
            subscription.client.name,
            subscription.plan.name,
            subscription.endDate,
            daysBefore,
          )

          await prisma.subscriptionExpiryNotification.create({
            data: {
              subscriptionId: subscription.id,
              daysBefore,
            },
          })

          result.notified++
          result.byDays[daysBefore]++
        } catch (error) {
          result.failed++
          console.error(
            `[expiry-reminder] failed for subscription ${subscription.id} (${daysBefore}d)`,
            error,
          )
        }
      }
    }

    if (result.notified > 0) {
      await telegramService.notifyAdminsExpiryDigest(result).catch((error) => {
        console.error('[expiry-reminder] admin digest failed', error)
      })
    }

    console.log(
      `[expiry-reminder] done: notified=${result.notified} skipped=${result.skipped} failed=${result.failed}`,
    )

    return result
  }

  private findDueSubscriptions(daysBefore: ExpiryReminderDays) {
    const endDateRange = calendarDayRangeFromToday(daysBefore)

    return prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: endDateRange,
        client: {
          status: 'ACTIVE',
          telegramLink: { chatId: { not: null } },
        },
        expiryNotifications: {
          none: { daysBefore },
        },
      },
      include: {
        plan: true,
        client: { include: { telegramLink: true } },
      },
    })
  }
}

export const expiryReminderService = new ExpiryReminderService()
