<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import PageHeader from '@/shared/ui/PageHeader.vue'
import { useAuthStore } from '@/app/stores/auth'
import { api } from '@/shared/api/client'
import { formatDateTime, formatMoney } from '@/shared/lib/format'

interface PaymentRow {
  id: string
  clientId: string
  clientName: string
  planName: string | null
  amount: string
  paidAt: string
  method: string
  status: string
  notes: string | null
}

const router = useRouter()
const auth = useAuthStore()

const methodLabels: Record<string, string> = {
  CASH: 'Наличные',
  TRANSFER: 'Перевод',
  OTHER: 'Другое',
  YOOKASSA: 'ЮKassa',
  ROBOKASSA: 'Robokassa',
}

const { data, isLoading } = useQuery({
  queryKey: ['payments'],
  queryFn: () => api.get<PaymentRow[]>('/payments', auth.token),
})

function openClient(clientId: string) {
  router.push({ name: 'client-detail', params: { id: clientId } })
}
</script>

<template>
  <div>
    <PageHeader title="Оплаты" subtitle="История всех платежей" />

    <Card>
      <template #content>
        <DataTable
          :value="data ?? []"
          :loading="isLoading"
          striped-rows
          row-hover
          @row-click="(e) => openClient(e.data.clientId)"
        >
          <Column field="clientName" header="Клиент" />
          <Column field="planName" header="Тариф">
            <template #body="{ data: row }">
              {{ row.planName ?? '—' }}
            </template>
          </Column>
          <Column header="Сумма">
            <template #body="{ data: row }">
              {{ formatMoney(row.amount) }}
            </template>
          </Column>
          <Column header="Метод">
            <template #body="{ data: row }">
              {{ methodLabels[row.method] ?? row.method }}
            </template>
          </Column>
          <Column header="Дата">
            <template #body="{ data: row }">
              {{ formatDateTime(row.paidAt) }}
            </template>
          </Column>
          <Column field="status" header="Статус" />
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<style scoped>
:deep(.p-datatable tbody tr) {
  cursor: pointer;
}
</style>
