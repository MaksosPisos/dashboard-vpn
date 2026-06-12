import { botEnv } from './config/env.js'
import { createBot } from './bot.js'

if (!botEnv.token) {
  console.log('TELEGRAM_BOT_TOKEN is not set. Bot is ready but not started.')
  process.exit(0)
}

const bot = createBot()

console.log('Telegram bot started')
bot.start()
