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
    return request<{ label: string; config: string }>(`/internal/telegram/${chatId}/config`)
  },

  getStats() {
    return request<{ activeClients: number; expiringSoon: number; expired: number }>(
      '/internal/dashboard/stats',
    )
  },
}
