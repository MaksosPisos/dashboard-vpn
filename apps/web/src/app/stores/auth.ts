import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthUser } from '@dashboard-vpn/shared'
import { api } from '@/shared/api/client'

const TOKEN_KEY = 'vpn-dashboard-token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<AuthUser | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value))

  async function login(email: string, password: string) {
    const response = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    })

    token.value = response.token
    user.value = response.user
    localStorage.setItem(TOKEN_KEY, response.token)
  }

  async function fetchMe() {
    if (!token.value) return

    try {
      user.value = await api.get<AuthUser>('/auth/me', token.value)
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return {
    token,
    user,
    isAuthenticated,
    login,
    fetchMe,
    logout,
  }
})
