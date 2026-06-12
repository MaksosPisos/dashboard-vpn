import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'vpn-dashboard-theme'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('system')
  const resolvedTheme = ref<'light' | 'dark'>('light')

  let mediaQuery: MediaQueryList | null = null

  function getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function applyTheme() {
    resolvedTheme.value = mode.value === 'system' ? getSystemTheme() : mode.value
    document.documentElement.classList.toggle('app-dark', resolvedTheme.value === 'dark')
  }

  function setMode(nextMode: ThemeMode) {
    mode.value = nextMode
    localStorage.setItem(STORAGE_KEY, nextMode)
    applyTheme()
  }

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      mode.value = saved
    }

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      if (mode.value === 'system') {
        applyTheme()
      }
    })

    applyTheme()
  }

  return {
    mode,
    resolvedTheme,
    setMode,
    init,
  }
})
