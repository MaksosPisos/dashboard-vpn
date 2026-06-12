import cron from 'node-cron'
import { env } from './config/env.js'
import { expiryReminderService } from './services/expiry-reminder.service.js'

let expiryReminderTask: cron.ScheduledTask | null = null
let expiryReminderRunning = false

async function runExpiryReminders(trigger: 'cron' | 'manual') {
  if (expiryReminderRunning) {
    console.log(`[scheduler] expiry reminders already running (trigger=${trigger})`)
    return null
  }

  expiryReminderRunning = true
  try {
    console.log(`[scheduler] expiry reminders started (trigger=${trigger})`)
    return await expiryReminderService.run()
  } finally {
    expiryReminderRunning = false
  }
}

export function startScheduler() {
  if (!env.cronExpiryRemindersEnabled) {
    console.log('[scheduler] expiry reminders disabled (CRON_EXPIRY_REMINDERS_ENABLED=false)')
    return
  }

  if (!cron.validate(env.cronExpiryRemindersSchedule)) {
    console.error(
      `[scheduler] invalid CRON_EXPIRY_REMINDERS_SCHEDULE: ${env.cronExpiryRemindersSchedule}`,
    )
    return
  }

  expiryReminderTask = cron.schedule(
    env.cronExpiryRemindersSchedule,
    () => {
      runExpiryReminders('cron').catch((error) => {
        console.error('[scheduler] expiry reminders cron failed', error)
      })
    },
    { timezone: env.cronTimezone },
  )

  console.log(
    `[scheduler] expiry reminders scheduled: "${env.cronExpiryRemindersSchedule}" (${env.cronTimezone})`,
  )
}

export function stopScheduler() {
  expiryReminderTask?.stop()
  expiryReminderTask = null
}

export async function triggerExpiryRemindersManually() {
  return runExpiryReminders('manual')
}
