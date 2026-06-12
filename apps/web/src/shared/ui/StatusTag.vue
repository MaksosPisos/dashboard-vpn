<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'
import type { SubscriptionDisplayStatus } from '@dashboard-vpn/shared'

const props = defineProps<{
  status: SubscriptionDisplayStatus | string | null | undefined
}>()

const config = computed(() => {
  switch (props.status) {
    case 'active':
      return { label: 'Активна', severity: 'success' as const }
    case 'expiring_soon':
      return { label: 'Истекает', severity: 'warn' as const }
    case 'expired':
      return { label: 'Просрочена', severity: 'danger' as const }
    case 'suspended':
      return { label: 'Приостановлена', severity: 'secondary' as const }
    case 'pending':
      return { label: 'Ожидает', severity: 'info' as const }
    default:
      return { label: 'Нет подписки', severity: 'secondary' as const }
  }
})
</script>

<template>
  <Tag :value="config.label" :severity="config.severity" />
</template>
