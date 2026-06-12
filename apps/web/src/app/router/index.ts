import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/app/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/app/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/pages/DashboardPage.vue'),
        },
        {
          path: 'clients',
          name: 'clients',
          component: () => import('@/pages/ClientsPage.vue'),
        },
        {
          path: 'clients/:id',
          name: 'client-detail',
          component: () => import('@/pages/ClientDetailPage.vue'),
        },
        {
          path: 'subscriptions',
          name: 'subscriptions',
          component: () => import('@/pages/SubscriptionsPage.vue'),
        },
        {
          path: 'payments',
          name: 'payments',
          component: () => import('@/pages/PaymentsPage.vue'),
        },
        {
          path: 'accounts',
          name: 'vpn-accounts',
          component: () => import('@/pages/VpnAccountsPage.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/pages/SettingsPage.vue'),
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    if (auth.isAuthenticated && to.name === 'login') {
      return { name: 'dashboard' }
    }
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (!auth.user) {
    await auth.fetchMe()
  }

  return true
})

export default router
