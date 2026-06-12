# VPN Dashboard

Админка для учёта VPN-клиентов Amnezia: подписки, оплаты, ключи и Telegram-бот.

## Стек

- **Frontend:** Vue 3, TypeScript, PrimeVue 4 (Aura), Pinia, TanStack Query
- **Backend:** Fastify, Prisma, PostgreSQL, Zod
- **Bot:** grammy

## Быстрый старт

### 1. Зависимости

```bash
npm install
```

### 2. Переменные окружения

```bash
cp .env.example .env
```

### 3. База данных

Установи [Docker Desktop](https://www.docker.com/products/docker-desktop/), затем:

```bash
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Запуск

**Всё одной командой** (API + Web + Telegram-бот):

```bash
npm run dev
```

В консоли будут три процесса: `[api]`, `[web]`, `[bot]`.

**Или по отдельности:**

```bash
npm run dev:api   # backend
npm run dev:web   # frontend
npm run dev:bot   # telegram bot
```

- Web: http://localhost:5173
- API: http://localhost:3001
- Login: `admin@example.com` / `admin123`

> Для бота в `.env` нужны `TELEGRAM_BOT_TOKEN` и `TELEGRAM_BOT_USERNAME`. Без токена `[bot]` завершится с сообщением — API и web продолжат работать.

> Фронт проксирует запросы `/api/*` на backend (см. `apps/web/vite.config.ts`), поэтому в `.env` для web можно не менять `VITE_API_URL` — по умолчанию используется `/api`.

### 5. Telegram-бот

1. Создай бота через [@BotFather](https://t.me/BotFather), получи `TELEGRAM_BOT_TOKEN`
2. Узнай username бота (без `@`) → `TELEGRAM_BOT_USERNAME`
3. Узнай свой Telegram ID ([@userinfobot](https://t.me/userinfobot)) → `TELEGRAM_ADMIN_IDS`
4. Добавь в `.env`:

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_BOT_USERNAME=your_vpn_bot
TELEGRAM_ADMIN_IDS=123456789
BOT_API_KEY=dev-bot-api-key
```

5. Перезапусти `npm run dev` — бот поднимется вместе с API и web.

**Привязка клиента:** карточка клиента → вкладка **Telegram** → «Сгенерировать ссылку» → отправить клиенту.

**Команды бота:** `/status`, `/config`, `/pay`, `/help` · админ: `/stats`

### 6. Напоминания об истечении подписки (cron)

API раз в день проверяет активные подписки и шлёт клиентам в Telegram напоминания за **7** и **3** дня до окончания (если клиент привязан к боту).

По умолчанию: каждый день в **10:00** (Europe/Moscow). Настройка в `.env`:

```env
CRON_EXPIRY_REMINDERS_ENABLED=true
CRON_EXPIRY_REMINDERS_SCHEDULE=0 10 * * *
CRON_TIMEZONE=Europe/Moscow
```

Ручной запуск (для теста):

```bash
curl -X POST http://localhost:3001/internal/jobs/expiry-reminders -H "X-Bot-Key: dev-bot-api-key"
```

## Структура

```
apps/web     — Vue admin SPA
apps/api     — Fastify REST API
apps/bot     — Telegram bot
packages/shared — общие TypeScript типы
docs/PLAN.md — план реализации
```

## Фазы

| Фаза | Статус |
|------|--------|
| 0 — Scaffold | ✅ |
| 1 — MVP CRM | ✅ |
| 2 — Telegram | ✅ (MVP: link, status, config, notify) |
| 3 — Amnezia API | ⏳ |
| 4 — Платежи | ⏳ |

Подробный план: [docs/PLAN.md](docs/PLAN.md)

## Деплой на VPS

Production-стек (Docker: nginx + api + bot + postgres) для **vm86654.it-garage.network**:

```bash
cp .env.production.example .env   # заполнить секреты
npm run docker:prod:up
```

Пошаговая инструкция (DNS, HTTPS, обновления): [deploy/README.md](deploy/README.md)
