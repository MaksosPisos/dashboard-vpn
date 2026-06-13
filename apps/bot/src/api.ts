import { botEnv } from './config/env.js'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${botEnv.apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Bot-Key': botEnv.botApiKey,
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message ?? `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  subscribe(input: {
    chatId: string
    username?: string | null
    firstName?: string | null
    lastName?: string | null
  }) {
    return request<{ clientId: string; clientName: string; status: string }>(
      '/internal/telegram/subscribe',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    )
  },

  linkAccount(token: string, chatId: string, username?: string | null) {
    return request<{ clientName: string }>('/internal/telegram/link', {
      method: 'POST',
      body: JSON.stringify({ token, chatId, username }),
    })
  },

  getStatus(chatId: string) {
    return request<{
      clientName: string
      planName: string | null
      endDate: string | null
      daysLeft: number | null
      displayStatus: string
    }>(`/internal/telegram/${chatId}/status`)
  },

  getConfig(chatId: string) {
    return request<{
      maxDevices: number
      configs: Array<{ label: string; config: string }>
    }>(`/internal/telegram/${chatId}/config`)
  },

  getStats() {
    return request<{ activeClients: number; pendingLeads: number; expiringSoon: number; expired: number }>(
      '/internal/dashboard/stats',
    )
  },

  getPlansForChat(chatId: string) {
    return request<Array<{ id: string; name: string; durationDays: number; price: string; maxDevices: number }>>(
      `/internal/telegram/${encodeURIComponent(chatId)}/plans`,
    )
  },

  createPayment(chatId: string, planId: string) {
    return request<{ orderId: string; paymentUrl: string; amount: string; planName: string }>(
      `/internal/telegram/${encodeURIComponent(chatId)}/payment`,
      {
        method: 'POST',
        body: JSON.stringify({ planId }),
      },
    )
  },
}
