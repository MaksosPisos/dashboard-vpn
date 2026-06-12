<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'
import { useAuthStore } from '@/app/stores/auth'
import { useUiStore } from '@/app/stores/ui'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const navItems = [
  { label: 'Dashboard', icon: 'pi pi-home', to: '/' },
  { label: 'Клиенты', icon: 'pi pi-users', to: '/clients' },
  { label: 'Подписки', icon: 'pi pi-calendar', to: '/subscriptions' },
  { label: 'Оплаты', icon: 'pi pi-wallet', to: '/payments' },
  { label: 'VPN-ключи', icon: 'pi pi-key', to: '/accounts' },
  { label: 'Настройки', icon: 'pi pi-cog', to: '/settings' },
]

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    clients: 'Клиенты',
    'client-detail': 'Карточка клиента',
    subscriptions: 'Подписки',
    payments: 'Оплаты',
    'vpn-accounts': 'VPN-аккаунты',
    settings: 'Настройки',
  }
  return titles[String(route.name)] ?? 'VPN Dashboard'
})

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <div class="layout-shell">
    <aside
      class="layout-sidebar"
      :class="{ open: ui.sidebarOpen, collapsed: ui.sidebarCollapsed }"
    >
      <div class="sidebar-brand">
        <span v-if="!ui.sidebarCollapsed">VPN Dashboard</span>
        <span v-else>VPN</span>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: isActive(item.to) }"
          @click="ui.closeSidebar()"
        >
          <i :class="item.icon" />
          <span v-if="!ui.sidebarCollapsed">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="layout-main">
      <header class="layout-topbar">
        <div class="topbar-actions">
          <Button
            icon="pi pi-bars"
            text
            rounded
            class="md:hidden"
            @click="ui.toggleSidebar()"
          />
          <strong>{{ pageTitle }}</strong>
        </div>

        <div class="topbar-actions">
          <ThemeToggle />
          <span class="hidden sm:inline">{{ auth.user?.email }}</span>
          <Button icon="pi pi-sign-out" text rounded severity="secondary" @click="logout" />
        </div>
      </header>

      <main class="page-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}

@media (min-width: 640px) {
  .hidden.sm\:inline {
    display: inline;
  }
}

@media (min-width: 768px) {
  .md\:hidden {
    display: none;
  }
}
</style>
