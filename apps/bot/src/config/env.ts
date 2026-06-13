import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const botRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const monorepoRoot = resolve(botRoot, '../..')

config({ path: resolve(monorepoRoot, '.env') })
config({ path: resolve(botRoot, '.env') })

export const botEnv = {
  token: process.env.TELEGRAM_BOT_TOKEN ?? '',
  apiUrl: process.env.API_INTERNAL_URL ?? 'http://localhost:3001',
  botApiKey: process.env.BOT_API_KEY ?? 'dev-bot-api-key',
  supportUsername: (process.env.TELEGRAM_SUPPORT_USERNAME ?? '').replace(/^@/, '').trim(),
  adminIds: (process.env.TELEGRAM_ADMIN_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
}
