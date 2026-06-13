import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const createClientSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  notes: z.string().optional(),
})

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  contact: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
})

export const approveLeadSchema = z.object({
  notifyTelegram: z.boolean().optional(),
})

export const rejectLeadSchema = z.object({
  reason: z.string().optional(),
  notifyTelegram: z.boolean().optional(),
})

export const subscribeTelegramSchema = z.object({
  chatId: z.string().min(1),
  username: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
})

export const createManualPaymentSchema = z.object({
  amount: z.number().positive(),
  paidAt: z.coerce.date().optional(),
  method: z.enum(['CASH', 'TRANSFER', 'OTHER']),
  planId: z.string().uuid(),
  notes: z.string().optional(),
  notifyTelegram: z.boolean().optional(),
  issueVpnAccount: z.boolean().optional(),
  vpnLabel: z.string().min(1).optional(),
  vpnConfigSnapshot: z.string().min(1).optional(),
  vpnServerId: z.string().uuid().optional(),
})

export const cancelSubscriptionSchema = z.object({
  suspendVpn: z.boolean().optional(),
  notifyTelegram: z.boolean().optional(),
})

export const suspendSubscriptionSchema = cancelSubscriptionSchema

export const resumeSubscriptionSchema = z.object({
  activateVpn: z.boolean().optional(),
  notifyTelegram: z.boolean().optional(),
})

export const createPlanSchema = z.object({
  name: z.string().min(1),
  durationDays: z.number().int().positive(),
  price: z.number().positive(),
  maxDevices: z.number().int().positive().optional(),
})

export const createVpnAccountSchema = z.object({
  label: z.string().min(1),
  serverId: z.string().uuid().optional(),
  configSnapshot: z.string().optional(),
})

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  durationDays: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
  maxDevices: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
})

export const createVpnServerSchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().url().optional().nullable(),
  provider: z.enum(['MANUAL', 'AMNEZIA_API', 'AWG_REST']).optional(),
})

export const updateVpnServerSchema = createVpnServerSchema.partial().extend({
  isActive: z.boolean().optional(),
})
