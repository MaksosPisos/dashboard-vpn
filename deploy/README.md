# Деплой на VPS

Инструкция для сервера **144.31.98.57** / **vm86654.it-garage.network** (Debian 12, ~1 GB RAM).

Стек: **nginx** (статика Vue + прокси `/api`) → **api** → **postgres**, отдельно **telegram-bot**.

> **Amnezia VPN** (`amnezia-awg2`, UDP 48147) уже работает на этом сервере. Новый compose использует отдельную сеть Docker и порты **80/443** — Amnezia не затрагивается.

## 1. DNS

В панели DNS создай **A-запись**:

| Имя | Тип | Значение |
|-----|-----|----------|
| `vm86654.it-garage.network` | A | `144.31.98.57` |

Проверка (с локальной машины):

```bash
dig +short vm86654.it-garage.network
# должно вернуть 144.31.98.57
```

## 2. Подготовка сервера

Подключись по SSH:

```bash
ssh root@144.31.98.57
```

Установи Docker (если ещё нет):

```bash
apt update && apt install -y git ca-certificates curl
curl -fsSL https://get.docker.com | sh
```

Проверь, что порты 80 и 443 свободны (Amnezia их не использует):

```bash
ss -tlnp | grep -E ':80|:443'
```

Клонируй репозиторий:

```bash
mkdir -p /opt/dashboard-vpn && cd /opt/dashboard-vpn
git clone https://github.com/MaksosPisos/dashboard-vpn.git .
```

## 3. Переменные окружения

```bash
cp .env.production.example .env
nano .env
```

Обязательно задай:

- `POSTGRES_PASSWORD` — надёжный пароль БД
- `JWT_SECRET` — длинная случайная строка (`openssl rand -hex 32`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — вход в админку (создаётся при первом старте API)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_ADMIN_IDS`
- `BOT_API_KEY` — свой секрет для bot ↔ api

## 4. Сборка и запуск (HTTP)

На сервере с 1 GB RAM сборка может занять несколько минут. При OOM поможет уже включённый swap.

```bash
cd /opt/dashboard-vpn
docker compose -f docker-compose.prod.yml up -d --build
```

Проверка:

```bash
docker compose -f docker-compose.prod.yml ps
curl http://vm86654.it-garage.network/api/health
# {"status":"ok"}
```

Открой в браузере: http://vm86654.it-garage.network

## 5. HTTPS (Let's Encrypt)

### 5.1. Выпуск сертификата

Nginx уже отдаёт `/.well-known/acme-challenge/` для webroot-метода.

```bash
docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d vm86654.it-garage.network \
  --email YOUR_EMAIL@example.com \
  --agree-tos \
  --no-eff-email
```

### 5.2. Переключение nginx на HTTPS

Отредактируй `docker-compose.prod.yml`, секция **nginx → volumes**:

```yaml
volumes:
  - ./deploy/nginx/conf.d/default.https.conf:/etc/nginx/conf.d/default.conf:ro
  - certbot-www:/var/www/certbot:ro
  - certbot-conf:/etc/letsencrypt:ro
```

(закомментируй или удали строку с `default.http.conf`)

Перезапуск:

```bash
docker compose -f docker-compose.prod.yml up -d nginx
```

Проверка: https://vm86654.it-garage.network

### 5.3. Продление сертификата

Добавь в crontab на хосте (`crontab -e`):

```cron
0 3 * * * cd /opt/dashboard-vpn && docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot renew && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 6. Обновление приложения

```bash
cd /opt/dashboard-vpn
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Миграции БД применяются автоматически при старте контейнера `api` (`prisma migrate deploy`).

## 7. Полезные команды

```bash
# Логи
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f bot
docker compose -f docker-compose.prod.yml logs -f nginx

# Статус и ресурсы
docker stats --no-stream

# Остановка (Amnezia не затронется)
docker compose -f docker-compose.prod.yml down

# Остановка с удалением данных БД (осторожно!)
docker compose -f docker-compose.prod.yml down -v
```

## 8. Лимиты памяти

В `docker-compose.prod.yml` заданы лимиты под 1 GB RAM:

| Сервис   | Лимит |
|----------|-------|
| postgres | 256 MB |
| api      | 256 MB |
| bot      | 128 MB |
| nginx    | 64 MB |

Amnezia (~150 MB) + этот стек (~700 MB) + swap — укладываются в ресурсы VPS.

## 9. Безопасность

- PostgreSQL **не** проброшен наружу — только внутри Docker-сети `dashboard`.
- API доступен только через nginx (`/api`).
- Смени дефолтные пароли до первого входа.
- Ограничь SSH (ключи, fail2ban) — вне scope этого документа.

## 10. Troubleshooting

**502 на /api** — API ещё не поднялся или упал:

```bash
docker compose -f docker-compose.prod.yml logs api
```

**Бот не отвечает** — проверь `TELEGRAM_BOT_TOKEN` и логи `bot`.

**Сборка падает по памяти** — собери образы на более мощной машине и загрузи на сервер, либо временно увеличь swap.

**Конфликт порта 80** — останови другой веб-сервер на хосте (`systemctl stop apache2 nginx` если они не в Docker).
