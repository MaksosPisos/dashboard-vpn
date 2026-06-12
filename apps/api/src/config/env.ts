import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// apps/api/src/config/env.ts → apps/api → корень monorepo
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const monorepoRoot = resolve(apiRoot, '../..')

config({ path: resolve(monorepoRoot, '.env') })
config({ path: resolve(apiRoot, '.env') })

function parseAdminIds(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map((id) => id.trim()).filter(Boolean)
}

export const env = {
  port: Number(process.env.API_PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin123',
  databaseUrl: process.env.DATABASE_URL ?? '',
  botApiKey: process.env.BOT_API_KEY ?? 'dev-bot-api-key',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
  telegramAdminIds: parseAdminIds(process.env.TELEGRAM_ADMIN_IDS),
  cronExpiryRemindersEnabled: process.env.CRON_EXPIRY_REMINDERS_ENABLED !== 'false',
  cronExpiryRemindersSchedule: process.env.CRON_EXPIRY_REMINDERS_SCHEDULE ?? '0 10 * * *',
  cronTimezone: process.env.CRON_TIMEZONE ?? 'Europe/Moscow',
}
