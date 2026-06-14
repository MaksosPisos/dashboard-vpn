import { env } from '../config/env.js'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatRub(amount: string | number): string {
  return `${Number(amount).toLocaleString('ru-RU')} ₽`
}

export type ShopPlanRow = {
  name: string
  durationDays: number
  price: string
  maxDevices: number
}

export function getShopInfoUrl(): string {
  const base = env.publicApiUrl.replace(/\/$/, '')
  return base ? `${base}/public/shop` : ''
}

export function buildShopInfoText(plans: ShopPlanRow[]): string {
  const lines: string[] = [
    `🛒 ${env.shopName}`,
    '',
    'Контакты:',
  ]

  if (env.telegramSupportUsername) {
    lines.push(`Telegram: @${env.telegramSupportUsername}`)
  }
  if (env.sellerEmail) {
    lines.push(`Email: ${env.sellerEmail}`)
  }
  if (env.sellerPhone) {
    lines.push(`Телефон: ${env.sellerPhone}`)
  }

  lines.push('', 'Услуги и цены:')
  if (plans.length === 0) {
    lines.push('— тарифы уточняйте у администратора')
  } else {
    for (const plan of plans) {
      lines.push(
        `• ${plan.name}: ${formatRub(plan.price)} / ${plan.durationDays} дн., до ${plan.maxDevices} устр.`,
      )
    }
  }

  if (env.sellerName || env.sellerInn) {
    lines.push('', 'Исполнитель:')
    if (env.sellerName) lines.push(env.sellerName)
    if (env.sellerInn) lines.push(`ИНН ${env.sellerInn}`)
    lines.push('Статус: плательщик НПД (самозанятый)')
  }

  const url = getShopInfoUrl()
  if (url) {
    lines.push('', `Полные условия: ${url}`)
  }

  return lines.join('\n')
}

export function renderShopPage(plans: ShopPlanRow[]): string {
  const shopName = escapeHtml(env.shopName)
  const support = env.telegramSupportUsername
    ? `@${escapeHtml(env.telegramSupportUsername)}`
    : ''
  const email = env.sellerEmail ? escapeHtml(env.sellerEmail) : ''
  const phone = env.sellerPhone ? escapeHtml(env.sellerPhone) : ''
  const sellerName = env.sellerName ? escapeHtml(env.sellerName) : ''
  const sellerInn = env.sellerInn ? escapeHtml(env.sellerInn) : ''
  const botLink = env.telegramBotUsername
    ? `https://t.me/${env.telegramBotUsername.replace(/^@/, '')}`
    : ''

  const planRows = plans.length
    ? plans
        .map(
          (plan) =>
            `<tr><td>${escapeHtml(plan.name)}</td><td>${plan.durationDays} дн.</td><td>до ${plan.maxDevices}</td><td>${formatRub(plan.price)}</td></tr>`,
        )
        .join('\n')
    : '<tr><td colspan="4">Тарифы временно недоступны — напишите в Telegram.</td></tr>'

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${shopName} — условия и тарифы</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 720px; margin: 32px auto; padding: 0 16px; color: #111; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; }
    p, li { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
    th { background: #f5f5f5; }
    .muted { color: #666; font-size: 0.95rem; }
    a { color: #2481cc; }
  </style>
</head>
<body>
  <h1>${shopName}</h1>
  <p class="muted">Информация для клиентов и платёжных систем</p>

  <h2>1. Контактные данные</h2>
  <ul>
    ${support ? `<li>Telegram: <a href="https://t.me/${escapeHtml(env.telegramSupportUsername.replace(/^@/, ''))}">${support}</a></li>` : ''}
    ${email ? `<li>Email: <a href="mailto:${email}">${email}</a></li>` : ''}
    ${phone ? `<li>Телефон: ${phone}</li>` : ''}
    ${botLink ? `<li>Telegram-бот: <a href="${botLink}">${botLink}</a></li>` : ''}
  </ul>

  <h2>2. Описание и стоимость услуг</h2>
  <p>Оказывается IT-услуга: сопровождение защищённого подключения через приложение Amnezia. После оплаты подписки клиент получает конфигурацию подключения в Telegram-боте.</p>
  <table>
    <thead>
      <tr><th>Тариф</th><th>Срок</th><th>Устройств</th><th>Цена</th></tr>
    </thead>
    <tbody>
      ${planRows}
    </tbody>
  </table>

  <h2>3. Реквизиты исполнителя</h2>
  <ul>
    ${sellerName ? `<li>ФИО: ${sellerName}</li>` : '<li>ФИО: укажите SELLER_NAME в настройках сервера</li>'}
    ${sellerInn ? `<li>ИНН: ${sellerInn}</li>` : '<li>ИНН: укажите SELLER_INN в настройках сервера</li>'}
    <li>Форма: плательщик налога на профессиональный доход (самозанятый)</li>
    <li>Чек формируется в приложении «Мой налог» после каждой оплаты</li>
  </ul>

  <h2>4. Условия оказания услуг</h2>
  <ul>
    <li>Оплата через Telegram-бот или по ссылке платёжной системы.</li>
    <li>Доступ активируется автоматически после подтверждения оплаты или вручную администратором — не позднее 24 часов.</li>
    <li>Конфигурация выдаётся в Telegram командой /config или сообщением от бота.</li>
    <li>Клиент обязан использовать конфиг только на своих устройствах в пределах лимита тарифа.</li>
    <li>Администратор вправе приостановить доступ при нарушении условий или неоплате.</li>
  </ul>

  <h2>5. Возврат и отказ от услуги</h2>
  <ul>
    <li>До начала оказания услуги (если конфиг ещё не выдан) — полный возврат по обращению в Telegram${support ? ` (${support})` : ''} в течение 3 рабочих дней.</li>
    <li>После выдачи конфигурации услуга считается оказанной; возврат возможен только при технической невозможности предоставить доступ.</li>
    <li>Неиспользованный период подписки при добровольном отказе не компенсируется, если доступ фактически работал.</li>
    <li>Возврат производится тем же способом, которым поступила оплата, в срок до 10 рабочих дней после согласования.</li>
  </ul>

  <p class="muted">Обновлено автоматически из актуальных тарифов сервиса.</p>
</body>
</html>`
}
