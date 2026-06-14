<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import PageHeader from '@/shared/ui/PageHeader.vue'
import StatusTag from '@/shared/ui/StatusTag.vue'
import ClientStatusTag from '@/shared/ui/ClientStatusTag.vue'
import { useAuthStore } from '@/app/stores/auth'
import { api } from '@/shared/api/client'
import { formatDate } from '@/shared/lib/format'
import type { ClientListItem } from '@dashboard-vpn/shared'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const search = ref('')
const debouncedSearch = ref('')
const subscriptionFilter = ref<string | null>(null)
const clientStatusFilter = ref<string | null>(null)
const showDialog = ref(false)
const creating = ref(false)
const form = ref({ name: '', contact: '', notes: '' })

const subscriptionOptions = [
  { label: 'Все подписки', value: null },
  { label: 'Активные', value: 'active' },
  { label: 'Истекают скоро', value: 'expiring_soon' },
  { label: 'Просрочены', value: 'expired' },
  { label: 'Ожидают', value: 'pending' },
]

const clientStatusOptions = [
  { label: 'Все статусы', value: null },
  { label: 'Ожидают', value: 'pending' },
  { label: 'Активные', value: 'active' },
  { label: 'Неактивные', value: 'inactive' },
  { label: 'Приостановлены', value: 'suspended' },
]

onMounted(() => {
  const status = route.query.status
  if (typeof status === 'string') {
    clientStatusFilter.value = status
  }
})

let searchTimer: ReturnType<typeof setTimeout>
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})

const { data, isLoading, refetch } = useQuery({
  queryKey: ['clients', debouncedSearch, subscriptionFilter, clientStatusFilter],
  queryFn: () => {
    const params = new URLSearchParams()
    if (debouncedSearch.value) params.set('search', debouncedSearch.value)
    if (subscriptionFilter.value) params.set('subscriptionStatus', subscriptionFilter.value)
    if (clientStatusFilter.value) params.set('status', clientStatusFilter.value)
    const query = params.toString()
    return api.get<ClientListItem[]>(`/clients${query ? `?${query}` : ''}`, auth.token)
  },
})

async function createClient() {
  creating.value = true
  try {
    await api.post('/clients', form.value, auth.token)
    showDialog.value = false
    form.value = { name: '', contact: '', notes: '' }
    await refetch()
  } finally {
    creating.value = false
  }
}

function openClient(id: string) {
  router.push({ name: 'client-detail', params: { id } })
}
</script>

<template>
  <div>
    <PageHeader title="Клиенты" subtitle="Учёт пользователей и подписок">
      <template #actions>
        <Button label="Добавить клиента" icon="pi pi-plus" @click="showDialog = true" />
      </template>
    </PageHeader>

    <Card>
      <template #content>
        <div class="filters">
          <span class="p-input-icon-left search-wrap">
            <i class="pi pi-search" />
            <InputText v-model="search" placeholder="Поиск по имени или контакту" />
          </span>
          <Select
            v-model="clientStatusFilter"
            :options="clientStatusOptions"
            option-label="label"
            option-value="value"
            placeholder="Статус клиента"
            class="filter-select"
          />
          <Select
            v-model="subscriptionFilter"
            :options="subscriptionOptions"
            option-label="label"
            option-value="value"
            placeholder="Подписка"
            class="filter-select"
          />
        </div>

        <DataTable
          :value="data ?? []"
          :loading="isLoading"
          striped-rows
          row-hover
          @row-click="(event) => openClient(event.data.id)"
        >
          <Column field="name" header="Имя" />
          <Column header="Статус">
            <template #body="{ data: row }">
              <ClientStatusTag :status="row.status" />
            </template>
          </Column>
          <Column field="contact" header="Контакт" />
          <Column field="telegramUsername" header="Telegram">
            <template #body="{ data: row }">
              {{ row.telegramUsername ?? '—' }}
            </template>
          </Column>
          <Column field="activeAccountsCount" header="Ключей" />
          <Column header="Подписка">
            <template #body="{ data: row }">
              <StatusTag :status="row.subscriptionStatus" />
            </template>
          </Column>
          <Column header="До">
            <template #body="{ data: row }">
              {{ formatDate(row.subscriptionEndDate) }}
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showDialog" modal header="Новый клиент" :style="{ width: '480px' }">
      <div class="form-field">
        <label>Имя</label>
        <InputText v-model="form.name" class="w-full" />
      </div>
      <div class="form-field">
        <label>Контакт</label>
        <InputText v-model="form.contact" class="w-full" placeholder="@telegram или email" />
      </div>
      <div class="form-field">
        <label>Заметки</label>
        <Textarea v-model="form.notes" rows="3" class="w-full" />
      </div>
      <template #footer>
        <Button label="Отмена" text @click="showDialog = false" />
        <Button label="Создать" :loading="creating" @click="createClient" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-wrap {
  flex: 1;
  min-width: 220px;
}

.filter-select {
  min-width: 200px;
}

.w-full {
  width: 100%;
}

:deep(.p-datatable tbody tr) {
  cursor: pointer;
}
</style>
