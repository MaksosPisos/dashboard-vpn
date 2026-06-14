import { Bot, GrammyError, InlineKeyboard } from 'grammy'
import { botEnv } from './config/env.js'
import { api } from './api.js'

function isAdmin(chatId: number): boolean {
  return botEnv.adminIds.includes(String(chatId))
}

function supportContactLine(): string {
  if (botEnv.supportUsername) {
    return `По вопросам: @${botEnv.supportUsername}`
  }
  return 'По вопросам напишите администратору.'
}

function welcomeText(): string {
  return (
    '🔐 <b>Подключение Amnezia</b>\n\n' +
    'Бот помогает оформить доступ, следить за подпиской и получить конфиг.\n\n' +
    '<b>Новым пользователям:</b> нажмите «Подключиться» или отправьте /subscribe\n' +
    '<b>Уже есть аккаунт:</b> откройте ссылку из личного кабинета\n\n' +
    '/status — статус подписки\n' +
    '/config — конфиг подключения\n' +
    '/pay — оплата\n' +
    '/info — контакты, тарифы и условия\n' +
    '/help — справка\n\n' +
    supportContactLine()
  )
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

async function sendVpnConfigMessage(
  ctx: { reply: (text: string, extra?: object) => Promise<unknown> },
  label: string,
  config: string,
) {
  const trimmed = config.trim()

  if (trimmed.startsWith('vpn://')) {
    await ctx.reply(`🔑 <b>${label}</b>\n\n${trimmed}`, { parse_mode: 'HTML' })
    return
  }

  const header = `🔑 <b>${label}</b>\n\n`
  if (header.length + trimmed.length > 4000) {
    await ctx.reply(
      `${header}Конфиг слишком длинный. ${supportContactLine()}`,
      {
        parse_mode: 'HTML',
      },
    )
    return
  }

  await ctx.reply(`${header}<pre>${trimmed}</pre>`, { parse_mode: 'HTML' })
}

function formatRub(amount: string | number): string {
  return `${Number(amount).toLocaleString('ru-RU')} ₽`
}

async function handlePayCommand(ctx: { chat: { id: number }; reply: (text: string, extra?: object) => Promise<unknown> }) {
  const chatId = String(ctx.chat.id)

  try {
    const plans = await api.getPlansForChat(chatId)

    if (plans.length === 0) {
      await ctx.reply(`Тарифы временно недоступны. ${supportContactLine()}`)
      return
    }

    const keyboard = new InlineKeyboard()
    for (const plan of plans) {
      keyboard.text(`${plan.name} — ${formatRub(plan.price)}`, `pay:${plan.id}`).row()
    }

    await ctx.reply(
      '💳 <b>Оплата подписки</b>\n\n' +
        'Выберите тариф. После оплаты подписка активируется автоматически.\n\n' +
        'Условия и реквизиты: /info',
      { parse_mode: 'HTML', reply_markup: keyboard },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN'
    const replies: Record<string, string> = {
      'Account not linked': 'Сначала отправьте /subscribe или привяжите аккаунт через ссылку из админки.',
      'FreeKassa не настроена на сервере': `Онлайн-оплата временно недоступна. ${supportContactLine()}`,
    }
    await ctx.reply(replies[message] ?? 'Не удалось загрузить тарифы. Попробуйте позже.')
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
          `✅ Аккаунт привязан!\n\nПривет, ${result.clientName}.\n\n/status — статус подписки\n/config — конфиг подключения\n/help — помощь`,
        )
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка привязки'
        await ctx.reply(`❌ Не удалось привязать аккаунт: ${message}`)
        return
      }
    }

    const keyboard = new InlineKeyboard().text('Подключиться', 'subscribe')

    await ctx.reply(
      welcomeText(),
      { parse_mode: 'HTML', reply_markup: keyboard },
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
      '<b>Что умеет бот</b>',
      '• Оформить заявку на подключение',
      '• Показать статус и срок подписки',
      '• Выдать конфиг для Amnezia',
      '• Принять оплату онлайн',
      '',
      '<b>Команды:</b>',
      '/subscribe — заявка на подключение',
      '/status — статус подписки',
      '/config — получить конфиг',
      '/pay — оплата подписки',
      '/info — контакты, тарифы, условия',
      '/help — эта справка',
      '',
      supportContactLine(),
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
        'Аккаунт не привязан.\n\nОтправьте /subscribe — заявка на подключение.',
      )
    }
  })

  bot.command('config', async (ctx) => {
    try {
      const data = await api.getConfig(String(ctx.chat.id))

      if (data.configs.length === 1) {
        await sendVpnConfigMessage(ctx, data.configs[0].label, data.configs[0].config)
        return
      }

      await ctx.reply(
        `🔑 <b>Конфиги</b> (${data.configs.length} из ${data.maxDevices})\n\n` +
          'Каждый конфиг — для отдельного устройства.',
        { parse_mode: 'HTML' },
      )

      for (const item of data.configs) {
        await sendVpnConfigMessage(ctx, item.label, item.config)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN'
      const replies: Record<string, string> = {
        'Account not linked': 'Сначала отправьте /subscribe или привяжите аккаунт через ссылку из админки.',
        CLIENT_PENDING: 'Заявка ещё на рассмотрении. Дождитесь подтверждения администратора.',
        SUBSCRIPTION_INACTIVE: 'Подписка неактивна. Продлите доступ для получения конфига.',
        NO_CONFIG: `Конфиг ещё не выдан. ${supportContactLine()}`,
      }
      await ctx.reply(replies[message] ?? 'Не удалось получить конфиг.')
    }
  })

  bot.command('pay', async (ctx) => {
    if (!ctx.chat) return
    await handlePayCommand(ctx)
  })

  bot.command('info', async (ctx) => {
    try {
      const info = await api.getShopInfo()
      const keyboard = info.url
        ? new InlineKeyboard().url('Полные условия на сайте', info.url)
        : undefined

      await ctx.reply(info.text, {
        reply_markup: keyboard,
      })
    } catch {
      await ctx.reply(
        `Не удалось загрузить информацию. ${supportContactLine()}\n\n` +
          'Тарифы: /pay',
      )
    }
  })

  bot.callbackQuery(/^pay:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    if (!ctx.chat) return

    const planId = ctx.match[1]
    const chatId = String(ctx.chat.id)

    try {
      const payment = await api.createPayment(chatId, planId)
      const keyboard = new InlineKeyboard().url(
        `Оплатить ${formatRub(payment.amount)}`,
        payment.paymentUrl,
      )

      await ctx.reply(
        `💳 <b>${payment.planName}</b>\n\n` +
          `Сумма: ${formatRub(payment.amount)}\n\n` +
          `Нажмите кнопку ниже для оплаты.\n` +
          `После оплаты бот пришлёт подтверждение.\n\n` +
          `Оплачивая, вы соглашаетесь с условиями (/info).`,
        { parse_mode: 'HTML', reply_markup: keyboard },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать платёж'
      await ctx.reply(`❌ ${message}`)
    }
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
