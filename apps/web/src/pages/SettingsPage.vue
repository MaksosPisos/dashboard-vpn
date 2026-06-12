<script setup lang="ts">
import { ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import InputSwitch from 'primevue/inputswitch'
import Select from 'primevue/select'
import PageHeader from '@/shared/ui/PageHeader.vue'
import { useAuthStore } from '@/app/stores/auth'
import { api } from '@/shared/api/client'
import { formatMoney } from '@/shared/lib/format'
import type { Plan, VpnServer } from '@dashboard-vpn/shared'
import { useToast } from 'primevue/usetoast'

const auth = useAuthStore()
const toast = useToast()
const queryClient = useQueryClient()

const showPlanDialog = ref(false)
const showServerDialog = ref(false)
const saving = ref(false)
const editingPlan = ref<Plan | null>(null)
const editingServer = ref<VpnServer | null>(null)

const planForm = ref({
  name: '',
  durationDays: 30,
  price: 300,
  maxDevices: 1,
})

const serverForm = ref({
  name: '',
  apiUrl: '',
  provider: 'MANUAL' as 'MANUAL' | 'AMNEZIA_API' | 'AWG_REST',
})

const providerOptions = [
  { label: 'Вручную', value: 'MANUAL' },
  { label: 'Amnezia API', value: 'AMNEZIA_API' },
  { label: 'AWG REST', value: 'AWG_REST' },
]

const { data: plans, isLoading: plansLoading } = useQuery({
  queryKey: ['plans-all'],
  queryFn: () => api.get<Plan[]>('/plans?all=true', auth.token),
})

const { data: servers, isLoading: serversLoading } = useQuery({
  queryKey: ['vpn-servers'],
  queryFn: () => api.get<VpnServer[]>('/vpn-servers', auth.token),
})

function openPlanDialog(plan?: Plan) {
  editingPlan.value = plan ?? null
  planForm.value = plan
    ? {
        name: plan.name,
        durationDays: plan.durationDays,
        price: Number(plan.price),
        maxDevices: plan.maxDevices,
      }
    : { name: '', durationDays: 30, price: 300, maxDevices: 1 }
  showPlanDialog.value = true
}

function openServerDialog(server?: VpnServer) {
  editingServer.value = server ?? null
  serverForm.value = server
    ? {
        name: server.name,
        apiUrl: server.apiUrl ?? '',
        provider: server.provider,
      }
    : { name: '', apiUrl: '', provider: 'MANUAL' }
  showServerDialog.value = true
}

async function savePlan() {
  saving.value = true
  try {
    if (editingPlan.value) {
      await api.patch(`/plans/${editingPlan.value.id}`, planForm.value, auth.token)
    } else {
      await api.post('/plans', planForm.value, auth.token)
    }
    showPlanDialog.value = false
    await queryClient.invalidateQueries({ queryKey: ['plans-all'] })
    await queryClient.invalidateQueries({ queryKey: ['plans'] })
    toast.add({ severity: 'success', summary: 'Тариф сохранён', life: 3000 })
  } finally {
    saving.value = false
  }
}

async function togglePlan(plan: Plan) {
  await api.patch(`/plans/${plan.id}`, { isActive: !plan.isActive }, auth.token)
  await queryClient.invalidateQueries({ queryKey: ['plans-all'] })
  await queryClient.invalidateQueries({ queryKey: ['plans'] })
}

async function saveServer() {
  saving.value = true
  try {
    const payload = {
      ...serverForm.value,
      apiUrl: serverForm.value.apiUrl || null,
    }
    if (editingServer.value) {
      await api.patch(`/vpn-servers/${editingServer.value.id}`, payload, auth.token)
    } else {
      await api.post('/vpn-servers', payload, auth.token)
    }
    showServerDialog.value = false
    await queryClient.invalidateQueries({ queryKey: ['vpn-servers'] })
    toast.add({ severity: 'success', summary: 'Сервер сохранён', life: 3000 })
  } finally {
    saving.value = false
  }
}

async function toggleServer(server: VpnServer) {
  await api.patch(`/vpn-servers/${server.id}`, { isActive: !server.isActive }, auth.token)
  await queryClient.invalidateQueries({ queryKey: ['vpn-servers'] })
}
</script>

<template>
  <div>
    <PageHeader title="Настройки" subtitle="Тарифы и VPN-серверы" />

    <Tabs value="0">
      <TabList>
        <Tab value="0">Тарифы</Tab>
        <Tab value="1">VPN-серверы</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="0">
          <Card>
            <template #content>
              <div class="toolbar">
                <Button label="Добавить тариф" icon="pi pi-plus" @click="openPlanDialog()" />
              </div>
              <DataTable :value="plans ?? []" :loading="plansLoading" striped-rows>
                <Column field="name" header="Название" />
                <Column field="durationDays" header="Дней" />
                <Column header="Цена">
                  <template #body="{ data: row }">
                    {{ formatMoney(row.price) }}
                  </template>
                </Column>
                <Column field="maxDevices" header="Устройств" />
                <Column header="Активен">
                  <template #body="{ data: row }">
                    <InputSwitch :model-value="row.isActive" @update:model-value="togglePlan(row)" />
                  </template>
                </Column>
                <Column header="">
                  <template #body="{ data: row }">
                    <Button icon="pi pi-pencil" text rounded @click="openPlanDialog(row)" />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </TabPanel>
        <TabPanel value="1">
          <Card>
            <template #content>
              <div class="toolbar">
                <Button label="Добавить сервер" icon="pi pi-plus" @click="openServerDialog()" />
              </div>
              <DataTable :value="servers ?? []" :loading="serversLoading" striped-rows>
                <Column field="name" header="Название" />
                <Column field="provider" header="Провайдер" />
                <Column field="apiUrl" header="API URL">
                  <template #body="{ data: row }">
                    {{ row.apiUrl ?? '—' }}
                  </template>
                </Column>
                <Column header="Активен">
                  <template #body="{ data: row }">
                    <InputSwitch :model-value="row.isActive" @update:model-value="toggleServer(row)" />
                  </template>
                </Column>
                <Column header="">
                  <template #body="{ data: row }">
                    <Button icon="pi pi-pencil" text rounded @click="openServerDialog(row)" />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <Dialog
      v-model:visible="showPlanDialog"
      modal
      :header="editingPlan ? 'Редактировать тариф' : 'Новый тариф'"
      :style="{ width: '440px' }"
    >
      <div class="form-field">
        <label>Название</label>
        <InputText v-model="planForm.name" class="w-full" />
      </div>
      <div class="form-field">
        <label>Срок (дней)</label>
        <InputNumber v-model="planForm.durationDays" class="w-full" />
      </div>
      <div class="form-field">
        <label>Цена</label>
        <InputNumber v-model="planForm.price" class="w-full" />
      </div>
      <div class="form-field">
        <label>Лимит устройств</label>
        <InputNumber v-model="planForm.maxDevices" class="w-full" />
      </div>
      <template #footer>
        <Button label="Отмена" text @click="showPlanDialog = false" />
        <Button label="Сохранить" :loading="saving" @click="savePlan" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showServerDialog"
      modal
      :header="editingServer ? 'Редактировать сервер' : 'Новый сервер'"
      :style="{ width: '480px' }"
    >
      <div class="form-field">
        <label>Название</label>
        <InputText v-model="serverForm.name" class="w-full" />
      </div>
      <div class="form-field">
        <label>Провайдер</label>
        <Select
          v-model="serverForm.provider"
          :options="providerOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>
      <div class="form-field">
        <label>API URL</label>
        <InputText v-model="serverForm.apiUrl" class="w-full" placeholder="https://..." />
      </div>
      <template #footer>
        <Button label="Отмена" text @click="showServerDialog = false" />
        <Button label="Сохранить" :loading="saving" @click="saveServer" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 1rem;
}

.w-full {
  width: 100%;
}
</style>
