<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Skeleton from 'primevue/skeleton'
import PageHeader from '@/shared/ui/PageHeader.vue'
import { useAuthStore } from '@/app/stores/auth'
import { api } from '@/shared/api/client'
import { formatDateTime, formatMoney } from '@/shared/lib/format'
import type { DashboardStats } from '@dashboard-vpn/shared'

const auth = useAuthStore()
const router = useRouter()

const { data, isLoading } = useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: () => api.get<DashboardStats>('/dashboard/stats', auth.token),
})

const kpis = computed(() => [
  { label: 'Активных клиентов', value: data.value?.activeClients ?? 0, to: '/clients' },
  { label: 'Активных подписок', value: data.value?.activeSubscriptions ?? 0, to: '/subscriptions?status=active' },
  { label: 'Истекают в 7 дней', value: data.value?.expiringSoon ?? 0, to: '/subscriptions?status=expiring', highlight: true },
  { label: 'Просрочено', value: data.value?.expired ?? 0, to: '/subscriptions?status=expired', danger: true },
  { label: 'Выручка за месяц', value: formatMoney(data.value?.monthlyRevenue ?? 0), to: '/payments' },
])

function openKpi(to: string) {
  router.push(to)
}
</script>

<template>
  <div>
    <PageHeader
      title="Dashboard"
      subtitle="Сводка по клиентам, подпискам и оплатам"
    />

    <div class="kpi-grid">
      <Card
        v-for="item in kpis"
        :key="item.label"
        class="kpi-card-wrap"
        :class="{ highlight: item.highlight, danger: item.danger }"
        @click="openKpi(item.to)"
      >
        <template #content>
          <div class="kpi-card">
            <span class="kpi-label">{{ item.label }}</span>
            <Skeleton v-if="isLoading" width="4rem" height="2rem" />
            <span v-else class="kpi-value">{{ item.value }}</span>
          </div>
        </template>
      </Card>
    </div>

    <Card class="mt-4">
      <template #title>Последние оплаты</template>
      <template #content>
        <DataTable
          :value="data?.recentPayments ?? []"
          :loading="isLoading"
          striped-rows
        >
          <Column field="clientName" header="Клиент" />
          <Column field="amount" header="Сумма">
            <template #body="{ data: row }">
              {{ formatMoney(row.amount) }}
            </template>
          </Column>
          <Column field="paidAt" header="Дата">
            <template #body="{ data: row }">
              {{ formatDateTime(row.paidAt) }}
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.mt-4 {
  margin-top: 1.5rem;
}

.kpi-card-wrap {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.kpi-card-wrap:hover {
  transform: translateY(-2px);
}

.kpi-card-wrap.highlight :deep(.p-card) {
  border-left: 3px solid var(--p-orange-500);
}

.kpi-card-wrap.danger :deep(.p-card) {
  border-left: 3px solid var(--p-red-500);
}
</style>
