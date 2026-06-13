import { createHash } from 'node:crypto'
import { env } from '../config/env.js'

export const FREEKASSA_PAY_URL = 'https://pay.fk.money/'

export const FREEKASSA_IPS = [
  '168.119.157.136',
  '168.119.60.227',
  '178.154.197.79',
  '51.250.54.238',
] as const

export function isFreekassaConfigured(): boolean {
  return Boolean(
    env.freekassaMerchantId &&
      env.freekassaSecretWord1 &&
      env.freekassaSecretWord2 &&
      env.publicApiUrl,
  )
}

export function formatFreekassaAmount(amount: number | string): string {
  return Number(amount).toFixed(2)
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex')
}

export function buildPaymentFormSignature(
  orderId: string,
  amount: number | string,
  currency = 'RUB',
): string {
  const merchantId = env.freekassaMerchantId
  const amountFormatted = formatFreekassaAmount(amount)
  return md5(`${merchantId}:${amountFormatted}:${env.freekassaSecretWord1}:${currency}:${orderId}`)
}

export function verifyWebhookSignature(
  merchantId: string,
  amount: string,
  orderId: string,
  sign: string,
): boolean {
  const expected = md5(`${merchantId}:${amount}:${env.freekassaSecretWord2}:${orderId}`)
  return expected.toLowerCase() === sign.toLowerCase()
}

export function buildPaymentUrl(
  orderId: string,
  amount: number | string,
  currency = 'RUB',
): string {
  const params = new URLSearchParams({
    m: env.freekassaMerchantId,
    oa: formatFreekassaAmount(amount),
    currency,
    o: orderId,
    s: buildPaymentFormSignature(orderId, amount, currency),
    lang: 'ru',
  })

  return `${FREEKASSA_PAY_URL}?${params.toString()}`
}

export function getWebhookBaseUrl(): string {
  return env.publicApiUrl.replace(/\/$/, '')
}

export function isFreekassaIp(ip: string): boolean {
  return FREEKASSA_IPS.includes(ip as (typeof FREEKASSA_IPS)[number])
}

export function resolveClientIp(
  remoteAddress: string | undefined,
  headers: Record<string, string | string[] | undefined>,
): string {
  const realIp = headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim()
  }

  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() ?? forwarded.trim()
  }

  return remoteAddress ?? ''
}
