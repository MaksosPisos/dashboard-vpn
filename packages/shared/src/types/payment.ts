export type PaymentMethod = 'CASH' | 'TRANSFER' | 'OTHER' | 'YOOKASSA' | 'ROBOKASSA' | 'FREEKASSA'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'

export interface Payment {
  id: string
  clientId: string
  subscriptionId: string | null
  planId: string | null
  amount: string
  paidAt: string
  method: PaymentMethod
  status: PaymentStatus
  externalPaymentId: string | null
  notes: string | null
  createdAt: string
}

export interface CreateManualPaymentDto {
  amount: number
  paidAt?: string
  method: 'CASH' | 'TRANSFER' | 'OTHER'
  planId: string
  notes?: string
  notifyTelegram?: boolean
  issueVpnAccount?: boolean
  vpnLabel?: string
  vpnConfigSnapshot?: string
  vpnServerId?: string
}
