import { prisma } from '../lib/prisma.js'
import {
  buildPaymentUrl,
  formatFreekassaAmount,
  isFreekassaConfigured,
  isFreekassaIp,
  resolveClientIp,
  verifyWebhookSignature,
} from '../lib/freekassa.js'
import { telegramService } from './telegram.service.js'
import { SubscriptionService } from './subscription.service.js'
import { vpnService } from './vpn.service.js'

const subscriptionService = new SubscriptionService()

function amountsMatch(expected: number | string, received: string): boolean {
  return Number(formatFreekassaAmount(expected)) === Number(formatFreekassaAmount(received))
}

export class PaymentService {
  async listActivePlans() {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { durationDays: 'asc' },
    })

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      durationDays: plan.durationDays,
      price: plan.price.toString(),
      maxDevices: plan.maxDevices,
    }))
  }

  async createTelegramPayment(chatId: string, planId: string) {
    if (!isFreekassaConfigured()) {
      throw new Error('FREEKASSA_NOT_CONFIGURED')
    }

    const link = await prisma.telegramLink.findUnique({
      where: { chatId },
      include: { client: true },
    })

    if (!link?.client) {
      throw new Error('NOT_LINKED')
    }

    if (!['PENDING', 'ACTIVE'].includes(link.client.status)) {
      throw new Error('CLIENT_NOT_PAYABLE')
    }

    const plan = await prisma.plan.findFirst({
      where: { id: planId, isActive: true },
    })

    if (!plan) {
      throw new Error('PLAN_NOT_FOUND')
    }

    const amount = Number(plan.price)
    const payment = await prisma.payment.create({
      data: {
        clientId: link.clientId,
        planId: plan.id,
        amount,
        paidAt: new Date(),
        method: 'FREEKASSA',
        status: 'PENDING',
        notes: 'Ожидает оплаты через FreeKassa',
      },
    })

    return {
      orderId: payment.id,
      paymentUrl: buildPaymentUrl(payment.id, amount),
      amount: formatFreekassaAmount(amount),
      planName: plan.name,
    }
  }

  async processFreekassaWebhook(input: {
    merchantId: string
    amount: string
    orderId: string
    sign: string
    externalPaymentId?: string
    clientIp: string
  }): Promise<'YES' | 'wrong sign' | 'order not found' | 'amount mismatch' | 'hacking attempt'> {
    if (!isFreekassaIp(input.clientIp)) {
      return 'hacking attempt'
    }

    if (!verifyWebhookSignature(input.merchantId, input.amount, input.orderId, input.sign)) {
      return 'wrong sign'
    }

    const payment = await prisma.payment.findUnique({
      where: { id: input.orderId },
      include: {
        client: { include: { telegramLink: true } },
        plan: true,
      },
    })

    if (!payment || payment.method !== 'FREEKASSA') {
      return 'order not found'
    }

    if (payment.status === 'PAID') {
      return 'YES'
    }

    if (!amountsMatch(Number(payment.amount), input.amount)) {
      return 'amount mismatch'
    }

    if (!payment.planId || !payment.plan) {
      return 'order not found'
    }

    const clientId = payment.clientId
    const wasPending = payment.client.status === 'PENDING'
    const planId = payment.planId

    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        externalPaymentId: input.externalPaymentId ?? null,
        notes: wasPending
          ? 'Оплата через FreeKassa, клиент активирован автоматически'
          : 'Оплата через FreeKassa',
      },
    })

    if (claimed.count === 0) {
      return 'YES'
    }

    if (wasPending) {
      await prisma.client.update({
        where: { id: clientId },
        data: { status: 'ACTIVE' },
      })
    }

    const subscription = await subscriptionService.extend(clientId, planId!, new Date())

    await prisma.payment.update({
      where: { id: payment.id },
      data: { subscriptionId: subscription.id },
    })

    await vpnService.reactivateSuspendedAccounts(clientId)

    const existingVpn = await vpnService.findActiveAccountWithConfig(clientId)

    await telegramService.notifyPaymentExtended(
      clientId,
      subscription.endDate,
      subscription.plan.name,
      existingVpn
        ? {
            vpnLabel: existingVpn.label,
            vpnConfig: existingVpn.configSnapshot!,
          }
        : undefined,
    )

    if (!existingVpn) {
      await telegramService.notifyPaymentReceivedAwaitingVpn(clientId)
      await telegramService.notifyAdminsFreekassaPayment(
        payment.client.name,
        payment.client.telegramLink?.username ?? null,
        subscription.plan.name,
        Number(payment.amount),
        wasPending,
      )
    }

    return 'YES'
  }
}

export const paymentService = new PaymentService()

export function parseFreekassaWebhookPayload(
  payload: Record<string, unknown>,
  request: { ip?: string; headers: Record<string, string | string[] | undefined> },
) {
  const merchantId = String(payload.MERCHANT_ID ?? '')
  const amount = String(payload.AMOUNT ?? '')
  const orderId = String(payload.MERCHANT_ORDER_ID ?? '')
  const sign = String(payload.SIGN ?? '')
  const externalPaymentId = payload.intid != null ? String(payload.intid) : undefined

  return {
    merchantId,
    amount,
    orderId,
    sign,
    externalPaymentId,
    clientIp: resolveClientIp(request.ip, request.headers),
  }
}
