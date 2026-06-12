<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import PageHeader from '@/shared/ui/PageHeader.vue'
import StatusTag from '@/shared/ui/StatusTag.vue'
import { useAuthStore } from '@/app/stores/auth'
import { api } from '@/shared/api/client'
import { formatDate } from '@/shared/lib/format'

interface SubscriptionRow {
  id: string
  clientId: string
  clientName: string
  planName: string
  startDate: string
  endDate: string
  status: string
  displayStatus: string
}

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const statusFilter = ref<string | null>(
  typeof route.query.status === 'string' ? route.query.status : null,
)

watch(
  () => route.query.status,
  (value) => {
    statusFilter.value = typeof value === 'string' ? value : null
  },
)

const filterOptions = [
  { label: 'Все', value: null },
  { label: 'Активные', value: 'active' },
  { label: 'Истекают (7 дней)', value: 'expiring' },
  { label: 'Просроченные', value: 'expired' },
]

const { data, isLoading } = useQuery({
  queryKey: ['subscriptions', statusFilter],
  queryFn: () => {
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)
    const q = params.toString()
    return api.get<SubscriptionRow[]>(`/subscriptions${q ? `?${q}` : ''}`, auth.token)
  },
})

function openClient(clientId: string) {
  router.push({ name: 'client-detail', params: { id: clientId } })
}
</script>

<template>
  <div>
    <PageHeader title="Подписки" subtitle="Операционный список периодов подписки" />

    <Card>
      <template #content>
        <div class="filters">
          <Select
            v-model="statusFilter"
            :options="filterOptions"
            option-label="label"
            option-value="value"
            placeholder="Фильтр по статусу"
            class="filter-select"
          />
        </div>

        <DataTable
          :value="data ?? []"
          :loading="isLoading"
          striped-rows
          row-hover
          @row-click="(e) => openClient(e.data.clientId)"
        >
          <Column field="clientName" header="Клиент" />
          <Column field="planName" header="Тариф" />
          <Column header="Период">
            <template #body="{ data: row }">
              {{ formatDate(row.startDate) }} — {{ formatDate(row.endDate) }}
            </template>
          </Column>
          <Column header="Статус">
            <template #body="{ data: row }">
              <StatusTag :status="row.displayStatus" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.filters {
  margin-bottom: 1rem;
}

.filter-select {
  min-width: 220px;
}

:deep(.p-datatable tbody tr) {
  cursor: pointer;
}
</style>
