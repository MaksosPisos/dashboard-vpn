<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'
import type { ClientStatus } from '@dashboard-vpn/shared'

const props = defineProps<{
  status: ClientStatus | string | null | undefined
}>()

const config = computed(() => {
  switch (props.status) {
    case 'pending':
      return { label: 'Ожидает', severity: 'info' as const }
    case 'active':
      return { label: 'Активен', severity: 'success' as const }
    case 'inactive':
      return { label: 'Неактивен', severity: 'secondary' as const }
    case 'suspended':
      return { label: 'Приостановлен', severity: 'warn' as const }
    default:
      return { label: '—', severity: 'secondary' as const }
  }
})
</script>

<template>
  <Tag :value="config.label" :severity="config.severity" />
</template>
