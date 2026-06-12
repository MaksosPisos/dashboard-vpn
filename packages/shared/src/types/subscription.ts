export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'

export interface Plan {
  id: string
  name: string
  durationDays: number
  price: string
  maxDevices: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Subscription {
  id: string
  clientId: string
  planId: string
  startDate: string
  endDate: string
  status: SubscriptionStatus
  createdAt: string
  updatedAt: string
  plan?: Plan
}

export interface CreatePlanDto {
  name: string
  durationDays: number
  price: number
  maxDevices?: number
}

export interface ExtendSubscriptionDto {
  planId: string
  notifyTelegram?: boolean
  issueVpnAccount?: boolean
}
