# VPN Admin Dashboard — план реализации

> Полная версия плана проекта. Краткий статус — в [README](../README.md).

## Цель (портфолио Middle+)

End-to-end продукт: доменная модель, CRUD с фильтрами, автоматизация подписок, Telegram, VPN API, платежи, типобезопасность.

## Стек

| Слой | Технология |
|------|------------|
| Frontend | Vite + Vue 3 + TS + PrimeVue 4 (Aura) |
| State | Pinia (auth, theme, UI) + TanStack Query (server data) |
| Backend | Fastify + Zod + JWT |
| DB | Prisma + PostgreSQL |
| Bot | grammy |

## Monorepo

```
apps/web       — Vue admin
apps/api       — REST API
apps/bot       — Telegram bot
packages/shared — общие типы
docs/PLAN.md   — этот файл
```

## UI: PrimeVue + light/dark/system

- Preset **Aura**, dark mode через класс `.app-dark` на `<html>`
- `useThemeStore`: persist в `localStorage`, режим system слушает `prefers-color-scheme`
- `ThemeToggle` в topbar с Phase 0

## Доменная модель

Client → Subscription, Payment, VpnAccount, TelegramLink  
Plan → Subscription  
VpnServer → VpnAccount

## API (основное)

- `POST /auth/login`, `GET /auth/me`
- `GET /dashboard/stats`
- CRUD `/clients`, `POST /clients/:id/payments`, `POST /clients/:id/vpn-accounts`
- CRUD `/plans`

## Фазы

### Phase 0 — Scaffold ✅

### Phase 1 — MVP CRM ✅
- Подписки, оплаты, VPN-аккаунты (глобальные списки)
- Настройки: тарифы и VPN-серверы
- Фильтры клиентов, редактирование, suspend/revoke ключей
- Dashboard KPI → переходы на списки

### Phase 2 — Telegram ✅ (MVP)
- Привязка через deep link `link_<token>`
- Бот: `/status`, `/config`, `/pay`, `/help`, админ `/stats`
- Вкладка Telegram в карточке клиента
- Уведомление клиенту после ручной оплаты
- Cron: напоминания за 7 и 3 дня до истечения подписки

### Phase 3 — Amnezia API ⏳
- amnezia-api / awg-rest, автосоздание peer

### Phase 4 — Платежи ⏳
- YooKassa / Robokassa webhooks

### Phase 5 — Polish ⏳
- README, тесты, deploy demo

## Запуск

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

Login: `admin@example.com` / `admin123`
