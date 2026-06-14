<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import PageHeader from '@/shared/ui/PageHeader.vue'
import VpnStatusTag from '@/shared/ui/VpnStatusTag.vue'
import { useAuthStore } from '@/app/stores/auth'
import { api } from '@/shared/api/client'
import { formatDate } from '@/shared/lib/format'
import { useToast } from 'primevue/usetoast'

interface VpnAccountRow {
  id: string
  clientId: string
  clientName: string | null
  label: string
  status: string
  configSnapshot: string | null
  createdAt: string
  server: { name: string } | null
}

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const queryClient = useQueryClient()

const statusFilter = ref<string | null>(null)
const configDialog = ref(false)
const selectedConfig = ref('')

const filterOptions = [
  { label: 'Все', value: null },
  { label: 'Активные', value: 'ACTIVE' },
  { label: 'Приостановленные', value: 'SUSPENDED' },
  { label: 'Отозванные', value: 'REVOKED' },
]

const { data, isLoading } = useQuery({
  queryKey: ['vpn-accounts', statusFilter],
  queryFn: () => {
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)
    const q = params.toString()
    return api.get<VpnAccountRow[]>(`/vpn-accounts${q ? `?${q}` : ''}`, auth.token)
  },
})

async function updateStatus(id: string, action: 'suspend' | 'revoke') {
  await api.patch(`/vpn-accounts/${id}/${action}`, {}, auth.token)
  await queryClient.invalidateQueries({ queryKey: ['vpn-accounts'] })
  toast.add({
    severity: 'success',
    summary: action === 'suspend' ? 'Ключ приостановлен' : 'Ключ отозван',
    life: 3000,
  })
}

function showConfig(row: VpnAccountRow) {
  selectedConfig.value = row.configSnapshot ?? 'Конфиг не сохранён'
  configDialog.value = true
}

function openClient(clientId: string) {
  router.push({ name: 'client-detail', params: { id: clientId } })
}
</script>

<template>
  <div>
    <PageHeader title="Аккаунты подключения" subtitle="Глобальный реестр конфигов" />

    <Card>
      <template #content>
        <div class="filters">
          <Select
            v-model="statusFilter"
            :options="filterOptions"
            option-label="label"
            option-value="value"
            placeholder="Статус"
            class="filter-select"
          />
        </div>

        <DataTable :value="data ?? []" :loading="isLoading" striped-rows>
          <Column field="label" header="Название" />
          <Column field="clientName" header="Клиент">
            <template #body="{ data: row }">
              <Button
                :label="row.clientName ?? '—'"
                link
                @click="openClient(row.clientId)"
              />
            </template>
          </Column>
          <Column header="Сервер">
            <template #body="{ data: row }">
              {{ row.server?.name ?? '—' }}
            </template>
          </Column>
          <Column header="Статус">
            <template #body="{ data: row }">
              <VpnStatusTag :status="row.status" />
            </template>
          </Column>
          <Column header="Создан">
            <template #body="{ data: row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </Column>
          <Column header="Действия">
            <template #body="{ data: row }">
              <div class="actions">
                <Button
                  icon="pi pi-file"
                  text
                  rounded
                  severity="secondary"
                  @click="showConfig(row)"
                />
                <Button
                  v-if="row.status === 'ACTIVE'"
                  icon="pi pi-pause"
                  text
                  rounded
                  severity="warn"
                  @click="updateStatus(row.id, 'suspend')"
                />
                <Button
                  v-if="row.status !== 'REVOKED'"
                  icon="pi pi-times"
                  text
                  rounded
                  severity="danger"
                  @click="updateStatus(row.id, 'revoke')"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="configDialog" modal header="Конфиг подключения" :style="{ width: '560px' }">
      <Textarea :model-value="selectedConfig" rows="12" readonly class="w-full" />
    </Dialog>
  </div>
</template>

<style scoped>
.filters {
  margin-bottom: 1rem;
}

.filter-select {
  min-width: 200px;
}

.actions {
  display: flex;
  gap: 0.25rem;
}

.w-full {
  width: 100%;
}
</style>
