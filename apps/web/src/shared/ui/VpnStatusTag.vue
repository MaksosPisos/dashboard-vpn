<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'

const props = defineProps<{
  status: string | null | undefined
}>()

const config = computed(() => {
  switch (props.status) {
    case 'ACTIVE':
      return { label: 'Активен', severity: 'success' as const }
    case 'SUSPENDED':
      return { label: 'Приостановлен', severity: 'warn' as const }
    case 'REVOKED':
      return { label: 'Отозван', severity: 'danger' as const }
    default:
      return { label: props.status ?? '—', severity: 'secondary' as const }
  }
})
</script>

<template>
  <Tag :value="config.label" :severity="config.severity" />
</template>
