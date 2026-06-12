import { Bot, GrammyError, InlineKeyboard } from 'grammy'
import { botEnv } from './config/env.js'
import { api } from './api.js'

function isAdmin(chatId: number): boolean {
  return botEnv.adminIds.includes(String(chatId))
}

function formatStatus(data: Awaited<ReturnType<typeof api.getStatus>>): string {
  if (data.displayStatus === 'pending') {
    return (
      `👤 <b>${data.clientName}</b>\n\n` +
      `⏳ Заявка на рассмотрении.\n` +
      `Администратор скоро свяжется с вами.`
    )
  }

  if (data.displayStatus === 'no_subscription') {
    return `👤 ${data.clientName}\n\nПодписка не найдена.`
  }

  const statusLabels: Record<string, string> = {
    active: '🟢 Активна',
    expiring_soon: '🟡 Истекает скоро',
    expired: '🔴 Просрочена',
    suspended: '⏸ Приостановлена',
  }

  const endDate = data.endDate
    ? new Date(data.endDate).toLocaleDateString('ru-RU')
    : '—'

  return (
    `👤 <b>${data.clientName}</b>\n\n` +
    `Тариф: ${data.planName ?? '—'}\n` +
    `До: ${endDate}\n` +
    `Осталось дней: ${data.daysLeft ?? '—'}\n` +
    `Статус: ${statusLabels[data.displayStatus] ?? data.displayStatus}`
  )
}

async function handleSubscribe(ctx: { chat?: { id: number }; from?: { username?: string; first_name?: string; last_name?: string }; reply: (text: string, extra?: object) => Promise<unknown> }) {
  if (!ctx.chat) return

  const chatId = String(ctx.chat.id)
  const username = ctx.from?.username ?? null
  const firstName = ctx.from?.first_name ?? null
  const lastName = ctx.from?.last_name ?? null

  try {
    const result = await api.subscribe({ chatId, username, firstName, lastName })
    await ctx.reply(
      `✅ <b>Заявка принята!</b>\n\n` +
        `Привет, ${result.clientName}.\n\n` +
        `Администратор проверит заявку и свяжется с вами.\n` +
        `/status — проверить статус заявки`,
      { parse_mode: 'HTML' },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось отправить заявку'
    await ctx.reply(`❌ ${message}`)
  }
}

export function createBot(): Bot {
  const bot = new Bot(botEnv.token)

  bot.command('start', async (ctx) => {
    const payload = ctx.match?.trim()
    const chatId = String(ctx.chat.id)
    const username = ctx.from?.username ?? null

    if (payload?.startsWith('link_')) {
      const token = payload.slice('link_'.length)
      try {
        const result = await api.linkAccount(token, chatId, username)
        await ctx.reply(
          `✅ Аккаунт привязан!\n\nПривет, ${result.clientName}.\n\n/status — статус подписки\n/config — VPN-ключ\n/help — помощь`,
        )
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка привязки'
        await ctx.reply(`❌ Не удалось привязать аккаунт: ${message}`)
        return
      }
    }

    const keyboard = new InlineKeyboard().text('Хочу VPN', 'subscribe')

    await ctx.reply(
      'VPN Dashboard Bot\n\n' +
        'Новому пользователю: нажмите «Хочу VPN» или отправьте /subscribe\n\n' +
        'Если у вас уже есть аккаунт — откройте ссылку из админки.\n\n' +
        '/status — статус\n/help — помощь',
      { reply_markup: keyboard },
    )
  })

  bot.callbackQuery('subscribe', async (ctx) => {
    await ctx.answerCallbackQuery()
    await handleSubscribe(ctx)
  })

  bot.command('subscribe', async (ctx) => {
    await handleSubscribe(ctx)
  })

  bot.command('help', async (ctx) => {
    const lines = [
      '<b>Команды:</b>',
      '/subscribe — заявка на VPN',
      '/status — статус подписки',
      '/config — получить VPN-конфиг',
      '/pay — как оплатить',
      '/help — эта справка',
    ]

    if (isAdmin(ctx.chat.id)) {
      lines.push('', '<b>Админ:</b>', '/stats — сводка')
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
  })

  bot.command('status', async (ctx) => {
    try {
      const data = await api.getStatus(String(ctx.chat.id))
      await ctx.reply(formatStatus(data), { parse_mode: 'HTML' })
    } catch {
      await ctx.reply(
        'Аккаунт не привязан.\n\nОтправьте /subscribe — заявка на подключение к VPN.',
      )
    }
  })

  bot.command('config', async (ctx) => {
    try {
      const data = await api.getConfig(String(ctx.chat.id))
      const header = `🔑 <b>${data.label}</b>\n\n`
      const configText = data.config

      if (header.length + configText.length > 4000) {
        await ctx.reply(header + 'Конфиг слишком длинный, обратитесь к администратору.', {
          parse_mode: 'HTML',
        })
        return
      }

      await ctx.reply(`${header}<pre>${configText}</pre>`, { parse_mode: 'HTML' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN'
      const replies: Record<string, string> = {
        'Account not linked': 'Сначала отправьте /subscribe или привяжите аккаунт через ссылку из админки.',
        CLIENT_PENDING: 'Заявка ещё на рассмотрении. Дождитесь подтверждения администратора.',
        SUBSCRIPTION_INACTIVE: 'Подписка неактивна. Продлите доступ для получения конфига.',
        NO_CONFIG: 'VPN-ключ ещё не выдан. Обратитесь к администратору.',
      }
      await ctx.reply(replies[message] ?? 'Не удалось получить конфиг.')
    }
  })

  bot.command('pay', async (ctx) => {
    await ctx.reply(
      '💳 <b>Оплата</b>\n\n' +
        'Для подключения или продления напишите администратору VPN.\n' +
        'Если вы ещё не подключены — отправьте /subscribe',
      { parse_mode: 'HTML' },
    )
  })

  bot.command('stats', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) {
      await ctx.reply('Команда доступна только администратору.')
      return
    }

    try {
      const stats = await api.getStats()
      await ctx.reply(
        `📊 <b>Сводка</b>\n\n` +
          `Активных клиентов: ${stats.activeClients}\n` +
          `Заявок ожидает: ${stats.pendingLeads}\n` +
          `Истекают в 7 дней: ${stats.expiringSoon}\n` +
          `Просрочено: ${stats.expired}`,
        { parse_mode: 'HTML' },
      )
    } catch {
      await ctx.reply('Не удалось получить статистику.')
    }
  })

  bot.catch((err) => {
    const ctx = err.ctx
    console.error(`Bot error for update ${ctx.update.update_id}:`)
    if (err.error instanceof GrammyError) {
      console.error(err.error.description)
    } else {
      console.error(err.error)
    }
  })

  return bot
}
