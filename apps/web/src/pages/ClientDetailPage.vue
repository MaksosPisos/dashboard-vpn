<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
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
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Calendar from 'primevue/calendar'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import PageHeader from '@/shared/ui/PageHeader.vue'
import StatusTag from '@/shared/ui/StatusTag.vue'
import ClientStatusTag from '@/shared/ui/ClientStatusTag.vue'
import VpnStatusTag from '@/shared/ui/VpnStatusTag.vue'
import { useAuthStore } from '@/app/stores/auth'
import { api } from '@/shared/api/client'
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format'
import type { Plan, VpnAccount } from '@dashboard-vpn/shared'
import { useToast } from 'primevue/usetoast'

interface ClientDetail {
  id: string
  name: string
  contact: string | null
  notes: string | null
  status: string
  subscriptions: Array<{
    id: string
    startDate: string
    endDate: string
    status: string
    suspendedAt: string | null
    plan: Plan
  }>
  payments: Array<{
    id: string
    amount: string
    paidAt: string
    method: string
    status: string
  }>
  vpnAccounts: VpnAccount[]
  telegramLink: {
    chatId: string | null
    username: string | null
    linkedAt: string | null
    isLinked: boolean
  } | null
}

const route = useRoute()
const auth = useAuthStore()
const queryClient = useQueryClient()
const toast = useToast()
const clientId = computed(() => route.params.id as string)

const showPaymentDialog = ref(false)
const showVpnDialog = ref(false)
const showEditDialog = ref(false)
const showConfigDialog = ref(false)
const showSuspendDialog = ref(false)
const showResumeDialog = ref(false)
const showRejectDialog = ref(false)
const selectedConfig = ref('')
const telegramDeepLink = ref<string | null>(null)
const generatingLink = ref(false)
const unlinking = ref(false)
const sendingPaymentReminder = ref(false)
const savingPayment = ref(false)
const savingVpn = ref(false)
const savingEdit = ref(false)
const suspendingSubscription = ref(false)
const resumingSubscription = ref(false)
const approvingLead = ref(false)
const rejectingLead = ref(false)

const editForm = ref({
  name: '',
  contact: '',
  notes: '',
})

const paymentForm = ref({
  amount: 300,
  method: 'TRANSFER',
  planId: '',
  paidAt: new Date(),
  notes: '',
  notifyTelegram: true,
  issueVpnAccount: true,
  vpnLabel: 'Телефон',
  vpnConfigSnapshot: '',
})

const vpnForm = ref({
  label: '',
  configSnapshot: '',
})

const suspendForm = ref({
  suspendVpn: true,
  notifyTelegram: true,
})

const resumeForm = ref({
  activateVpn: true,
  notifyTelegram: true,
})

const rejectForm = ref({
  reason: '',
  notifyTelegram: true,
})

const isPendingLead = computed(() => client.value?.status === 'pending')

const { data: client, isLoading } = useQuery({
  queryKey: ['client', clientId],
  queryFn: () => api.get<ClientDetail>(`/clients/${clientId.value}`, auth.token),
})

const { data: plans } = useQuery({
  queryKey: ['plans'],
  queryFn: () => api.get<Plan[]>('/plans', auth.token),
})

const displaySubscription = computed(() => {
  if (!client.value?.subscriptions.length) return null
  const active = client.value.subscriptions.find((item) => item.status === 'ACTIVE')
  if (active) return active
  const suspended = client.value.subscriptions.find((item) => item.status === 'SUSPENDED')
  return suspended ?? client.value.subscriptions[0]
})

const canSuspendSubscription = computed(() =>
  client.value?.subscriptions.some((item) => item.status === 'ACTIVE') ?? false,
)

const canResumeSubscription = computed(() =>
  client.value?.subscriptions.some((item) => item.status === 'SUSPENDED') ?? false,
)

const subscriptionStatus = computed(() => {
  if (client.value?.status === 'pending') return 'pending'
  const sub = displaySubscription.value
  if (!sub) return null
  if (sub.status === 'SUSPENDED') return 'suspended'
  const endDate = new Date(sub.endDate)
  const now = new Date()
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 7) return 'expiring_soon'
  return 'active'
})

const paymentMethods = [
  { label: 'Перевод', value: 'TRANSFER' },
  { label: 'Наличные', value: 'CASH' },
  { label: 'Другое', value: 'OTHER' },
]

function resolveSubRowStatus(row: { status: string; endDate: string }) {
  if (row.status === 'SUSPENDED') return 'suspended'
  if (row.status === 'EXPIRED') return 'expired'
  const endDate = new Date(row.endDate)
  const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 7) return 'expiring_soon'
  return 'active'
}

function toPaymentDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const hasActiveVpnConfig = computed(
  () =>
    client.value?.vpnAccounts.some(
      (account) => account.status === 'ACTIVE' && account.configSnapshot,
    ) ?? false,
)

async function submitPayment() {
  if (!paymentForm.value.planId) return

  if (paymentForm.value.issueVpnAccount) {
    const config = paymentForm.value.vpnConfigSnapshot.trim()
    if (!hasActiveVpnConfig.value && !config) {
      toast.add({
        severity: 'warn',
        summary: 'Нужен VPN-конфиг',
        detail: 'У клиента ещё нет ключа — вставьте конфиг Amnezia',
        life: 4000,
      })
      return
    }
    if (config && !paymentForm.value.vpnLabel.trim()) {
      toast.add({
        severity: 'warn',
        summary: 'Укажите название устройства',
        life: 3000,
      })
      return
    }
  }

  savingPayment.value = true
  try {
    const payload = {
      ...paymentForm.value,
      paidAt: toPaymentDateString(paymentForm.value.paidAt),
      vpnLabel: paymentForm.value.vpnLabel.trim() || undefined,
      vpnConfigSnapshot: paymentForm.value.vpnConfigSnapshot.trim() || undefined,
    }

    await api.post(`/clients/${clientId.value}/payments`, payload, auth.token)
    showPaymentDialog.value = false
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    await queryClient.invalidateQueries({ queryKey: ['vpn-accounts'] })
    toast.add({
      severity: 'success',
      summary: 'Оплата сохранена',
      detail: paymentForm.value.issueVpnAccount
        ? paymentForm.value.notifyTelegram
          ? 'Подписка продлена, ключ отправлен в Telegram'
          : 'Подписка продлена, VPN-ключ выдан'
        : undefined,
      life: 4000,
    })
  } finally {
    savingPayment.value = false
  }
}

async function submitVpnAccount() {
  savingVpn.value = true
  try {
    await api.post(`/clients/${clientId.value}/vpn-accounts`, vpnForm.value, auth.token)
    showVpnDialog.value = false
    vpnForm.value = { label: '', configSnapshot: '' }
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
  } finally {
    savingVpn.value = false
  }
}

function openPaymentDialog() {
  paymentForm.value.planId = plans.value?.[0]?.id ?? ''
  paymentForm.value.amount = Number(plans.value?.[0]?.price ?? 300)
  paymentForm.value.notifyTelegram = client.value?.telegramLink?.isLinked ?? false
  paymentForm.value.issueVpnAccount = true
  paymentForm.value.vpnLabel = 'Телефон'
  paymentForm.value.vpnConfigSnapshot = ''
  showPaymentDialog.value = true
}

function openEditDialog() {
  if (!client.value) return
  editForm.value = {
    name: client.value.name,
    contact: client.value.contact ?? '',
    notes: client.value.notes ?? '',
  }
  showEditDialog.value = true
}

async function saveEdit() {
  savingEdit.value = true
  try {
    await api.patch(
      `/clients/${clientId.value}`,
      {
        name: editForm.value.name,
        contact: editForm.value.contact || null,
        notes: editForm.value.notes || null,
      },
      auth.token,
    )
    showEditDialog.value = false
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    await queryClient.invalidateQueries({ queryKey: ['clients'] })
    toast.add({ severity: 'success', summary: 'Клиент обновлён', life: 3000 })
  } finally {
    savingEdit.value = false
  }
}

async function vpnAction(id: string, action: 'suspend' | 'revoke') {
  await api.patch(`/vpn-accounts/${id}/${action}`, {}, auth.token)
  await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
  await queryClient.invalidateQueries({ queryKey: ['vpn-accounts'] })
  toast.add({
    severity: 'success',
    summary: action === 'suspend' ? 'Ключ приостановлен' : 'Ключ отозван',
    life: 3000,
  })
}

function viewConfig(row: VpnAccount) {
  selectedConfig.value = row.configSnapshot ?? 'Конфиг не сохранён'
  showConfigDialog.value = true
}

async function generateTelegramLink() {
  generatingLink.value = true
  try {
    const result = await api.post<{
      linked: boolean
      deepLink: string | null
      startPayload?: string
      botUsername?: string
      username: string | null
    }>(`/clients/${clientId.value}/telegram/link`, {}, auth.token)

    if (result.linked) {
      toast.add({ severity: 'info', summary: 'Telegram уже привязан', life: 3000 })
    } else {
      const link =
        result.deepLink ??
        (result.botUsername && result.startPayload
          ? `https://t.me/${result.botUsername}?start=${result.startPayload}`
          : null)

      if (link) {
        telegramDeepLink.value = link
        toast.add({ severity: 'success', summary: 'Ссылка для привязки создана', life: 3000 })
      } else {
        toast.add({
          severity: 'error',
          summary: 'Не удалось собрать ссылку',
          detail: 'Проверьте TELEGRAM_BOT_USERNAME в .env и перезапустите API',
          life: 5000,
        })
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
  } finally {
    generatingLink.value = false
  }
}

async function copyTelegramLink() {
  if (!telegramDeepLink.value) return
  await navigator.clipboard.writeText(telegramDeepLink.value)
  toast.add({ severity: 'success', summary: 'Ссылка скопирована', life: 2000 })
}

async function unlinkTelegram() {
  unlinking.value = true
  try {
    await api.delete(`/clients/${clientId.value}/telegram/link`, auth.token)
    telegramDeepLink.value = null
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    toast.add({ severity: 'success', summary: 'Telegram отвязан', life: 3000 })
  } finally {
    unlinking.value = false
  }
}

async function sendPaymentReminder() {
  sendingPaymentReminder.value = true
  try {
    await api.post(`/clients/${clientId.value}/telegram/payment-reminder`, {}, auth.token)
    toast.add({ severity: 'success', summary: 'Напоминание об оплате отправлено', life: 3000 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось отправить'
    toast.add({ severity: 'error', summary: 'Ошибка', detail: message, life: 5000 })
  } finally {
    sendingPaymentReminder.value = false
  }
}

function openSuspendDialog() {
  suspendForm.value = {
    suspendVpn: true,
    notifyTelegram: client.value?.telegramLink?.isLinked ?? false,
  }
  showSuspendDialog.value = true
}

function openResumeDialog() {
  resumeForm.value = {
    activateVpn: true,
    notifyTelegram: client.value?.telegramLink?.isLinked ?? false,
  }
  showResumeDialog.value = true
}

async function submitSuspendSubscription() {
  suspendingSubscription.value = true
  try {
    await api.post(
      `/clients/${clientId.value}/subscriptions/suspend`,
      suspendForm.value,
      auth.token,
    )
    showSuspendDialog.value = false
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    await queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    await queryClient.invalidateQueries({ queryKey: ['vpn-accounts'] })
    toast.add({ severity: 'success', summary: 'Подписка приостановлена', life: 3000 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось приостановить подписку'
    toast.add({ severity: 'error', summary: 'Ошибка', detail: message, life: 5000 })
  } finally {
    suspendingSubscription.value = false
  }
}

async function submitResumeSubscription() {
  resumingSubscription.value = true
  try {
    const result = await api.post<{ expiredDuringPause?: boolean }>(
      `/clients/${clientId.value}/subscriptions/resume`,
      resumeForm.value,
      auth.token,
    )
    showResumeDialog.value = false
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    await queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    await queryClient.invalidateQueries({ queryKey: ['vpn-accounts'] })
    if (result.expiredDuringPause) {
      toast.add({
        severity: 'warn',
        summary: 'Подписка истекла во время паузы',
        detail: 'Нужна новая оплата для доступа к VPN',
        life: 5000,
      })
    } else {
      toast.add({ severity: 'success', summary: 'Подписка возобновлена', life: 3000 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось возобновить подписку'
    toast.add({ severity: 'error', summary: 'Ошибка', detail: message, life: 5000 })
  } finally {
    resumingSubscription.value = false
  }
}

function openRejectDialog() {
  rejectForm.value = {
    reason: '',
    notifyTelegram: client.value?.telegramLink?.isLinked ?? false,
  }
  showRejectDialog.value = true
}

async function submitApproveLead() {
  approvingLead.value = true
  try {
    await api.post(
      `/clients/${clientId.value}/approve`,
      { notifyTelegram: client.value?.telegramLink?.isLinked ?? false },
      auth.token,
    )
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    await queryClient.invalidateQueries({ queryKey: ['clients'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    toast.add({ severity: 'success', summary: 'Заявка одобрена', life: 3000 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось одобрить заявку'
    toast.add({ severity: 'error', summary: 'Ошибка', detail: message, life: 5000 })
  } finally {
    approvingLead.value = false
  }
}

async function submitRejectLead() {
  rejectingLead.value = true
  try {
    await api.post(
      `/clients/${clientId.value}/reject`,
      rejectForm.value,
      auth.token,
    )
    showRejectDialog.value = false
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    await queryClient.invalidateQueries({ queryKey: ['clients'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    toast.add({ severity: 'success', summary: 'Заявка отклонена', life: 3000 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось отклонить заявку'
    toast.add({ severity: 'error', summary: 'Ошибка', detail: message, life: 5000 })
  } finally {
    rejectingLead.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="client?.name ?? 'Клиент'"
      :subtitle="client?.contact ?? 'Загрузка...'"
    >
      <template #actions>
        <template v-if="isPendingLead">
          <Button
            label="Одобрить заявку"
            icon="pi pi-check"
            severity="success"
            :loading="approvingLead"
            @click="submitApproveLead"
          />
          <Button
            label="Отклонить"
            icon="pi pi-times"
            severity="danger"
            outlined
            @click="openRejectDialog"
          />
        </template>
        <template v-else>
        <Button label="Редактировать" icon="pi pi-pencil" severity="secondary" @click="openEditDialog" />
        <Button
          label="Напомнить об оплате"
          icon="pi pi-bell"
          severity="warn"
          :disabled="!client?.telegramLink?.isLinked"
          :loading="sendingPaymentReminder"
          @click="sendPaymentReminder"
        />
        <Button
          v-if="canResumeSubscription"
          label="Возобновить подписку"
          icon="pi pi-play"
          severity="success"
          :loading="resumingSubscription"
          @click="openResumeDialog"
        />
        <Button
          v-if="canSuspendSubscription"
          label="Приостановить подписку"
          icon="pi pi-pause"
          severity="warn"
          outlined
          @click="openSuspendDialog"
        />
        <Button label="Зафиксировать оплату" icon="pi pi-wallet" @click="openPaymentDialog" />
        <Button label="Выдать ключ" icon="pi pi-key" severity="secondary" @click="showVpnDialog = true" />
        </template>
      </template>
    </PageHeader>

    <Card v-if="client" class="mb-4">
      <template #content>
        <div class="overview-grid">
          <div>
            <span class="kpi-label">Статус клиента</span>
            <ClientStatusTag :status="client.status" />
          </div>
          <div>
            <span class="kpi-label">Статус подписки</span>
            <StatusTag :status="subscriptionStatus" />
          </div>
          <div>
            <span class="kpi-label">Тариф</span>
            <strong>{{ displaySubscription?.plan.name ?? '—' }}</strong>
          </div>
          <div>
            <span class="kpi-label">Действует до</span>
            <strong>{{ formatDate(displaySubscription?.endDate) }}</strong>
          </div>
          <div>
            <span class="kpi-label">Telegram</span>
            <strong>{{ client.telegramLink?.isLinked ? `@${client.telegramLink.username ?? client.telegramLink.chatId}` : 'Не привязан' }}</strong>
          </div>
        </div>
        <Message
          v-if="isPendingLead"
          severity="info"
          :closable="false"
          class="mt-3"
        >
          Заявка из Telegram-бота. Одобрите клиента, затем зафиксируйте оплату и выдайте VPN-ключ.
        </Message>
        <Message
          v-else-if="displaySubscription?.status === 'SUSPENDED'"
          severity="warn"
          :closable="false"
          class="mt-3"
        >
          Подписка приостановлена
          <span v-if="displaySubscription.suspendedAt">
            с {{ formatDateTime(displaySubscription.suspendedAt) }}
          </span>.
          Оставшееся время сохранится при возобновлении.
        </Message>
        <p v-if="client.notes" class="notes">{{ client.notes }}</p>
      </template>
    </Card>

    <Tabs value="0">
      <TabList>
        <Tab value="0">VPN-аккаунты</Tab>
        <Tab value="1">Подписки</Tab>
        <Tab value="2">Оплаты</Tab>
        <Tab value="3">Telegram</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="0">
          <DataTable :value="client?.vpnAccounts ?? []" :loading="isLoading" striped-rows>
            <Column field="label" header="Название" />
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
                  <Button icon="pi pi-file" text rounded @click="viewConfig(row)" />
                  <Button
                    v-if="row.status === 'ACTIVE'"
                    icon="pi pi-pause"
                    text
                    rounded
                    severity="warn"
                    @click="vpnAction(row.id, 'suspend')"
                  />
                  <Button
                    v-if="row.status !== 'REVOKED'"
                    icon="pi pi-times"
                    text
                    rounded
                    severity="danger"
                    @click="vpnAction(row.id, 'revoke')"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </TabPanel>
        <TabPanel value="1">
          <DataTable :value="client?.subscriptions ?? []" :loading="isLoading" striped-rows>
            <Column header="Тариф">
              <template #body="{ data: row }">
                {{ row.plan.name }}
              </template>
            </Column>
            <Column header="Период">
              <template #body="{ data: row }">
                {{ formatDate(row.startDate) }} — {{ formatDate(row.endDate) }}
              </template>
            </Column>
            <Column header="Статус">
              <template #body="{ data: row }">
                <StatusTag :status="resolveSubRowStatus(row)" />
              </template>
            </Column>
          </DataTable>
        </TabPanel>
        <TabPanel value="2">
          <DataTable :value="client?.payments ?? []" :loading="isLoading" striped-rows>
            <Column header="Сумма">
              <template #body="{ data: row }">
                {{ formatMoney(row.amount) }}
              </template>
            </Column>
            <Column field="method" header="Метод" />
            <Column header="Дата">
              <template #body="{ data: row }">
                {{ formatDateTime(row.paidAt) }}
              </template>
            </Column>
            <Column field="status" header="Статус" />
          </DataTable>
        </TabPanel>
        <TabPanel value="3">
          <div v-if="client?.telegramLink?.isLinked" class="telegram-panel">
            <Message severity="success" :closable="false">
              Привязан: @{{ client.telegramLink.username ?? client.telegramLink.chatId }}
              <span v-if="client.telegramLink.linkedAt">
                (с {{ formatDateTime(client.telegramLink.linkedAt) }})
              </span>
            </Message>
            <Button
              label="Отвязать Telegram"
              icon="pi pi-unlink"
              severity="danger"
              outlined
              :loading="unlinking"
              @click="unlinkTelegram"
            />
            <Button
              label="Напомнить об оплате"
              icon="pi pi-bell"
              severity="warn"
              :loading="sendingPaymentReminder"
              @click="sendPaymentReminder"
            />
          </div>
          <div v-else class="telegram-panel">
            <Message severity="info" :closable="false" class="telegram-info">
              <p><strong>Зачем это нужно?</strong></p>
              <p>
                Бот не знает, какой Telegram-пользователь — какой клиент в вашей базе.
                Ссылка — одноразовый «ключ»: клиент открывает её → бот запоминает его chat_id
                и дальше может слать статус, конфиг и уведомления об оплате.
              </p>
            </Message>
            <ol class="telegram-steps">
              <li>Нажмите «Сгенерировать ссылку»</li>
              <li>Отправьте ссылку клиенту в Telegram (или откройте сами для теста)</li>
              <li>Клиент нажимает Start — привязка готова</li>
            </ol>
            <Button
              label="Сгенерировать ссылку"
              icon="pi pi-link"
              :loading="generatingLink"
              @click="generateTelegramLink"
            />
            <div v-if="telegramDeepLink" class="link-box">
              <label class="link-label">Ссылка для клиента (откроет бота):</label>
              <InputText :model-value="telegramDeepLink" readonly class="w-full" />
              <div class="link-actions">
                <Button label="Копировать" icon="pi pi-copy" @click="copyTelegramLink" />
                <Button
                  label="Открыть в Telegram"
                  icon="pi pi-external-link"
                  severity="secondary"
                  as="a"
                  :href="telegramDeepLink"
                  target="_blank"
                />
              </div>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <Dialog v-model:visible="showPaymentDialog" modal header="Зафиксировать оплату" :style="{ width: '480px' }">
      <div class="form-field">
        <label>Тариф</label>
        <Select
          v-model="paymentForm.planId"
          :options="plans ?? []"
          option-label="name"
          option-value="id"
          class="w-full"
          @update:model-value="(id) => {
            const plan = plans?.find((item) => item.id === id)
            if (plan) paymentForm.amount = Number(plan.price)
          }"
        />
      </div>
      <div class="form-field">
        <label>Сумма</label>
        <InputNumber v-model="paymentForm.amount" class="w-full" />
      </div>
      <div class="form-field">
        <label>Метод</label>
        <Select v-model="paymentForm.method" :options="paymentMethods" option-label="label" option-value="value" class="w-full" />
      </div>
      <div class="form-field">
        <label>Дата оплаты</label>
        <Calendar v-model="paymentForm.paidAt" date-format="dd.mm.yy" class="w-full" />
        <small class="field-hint">
          Если подписка уже активна — дни тарифа прибавятся к текущей дате окончания.
          Если дата в прошлом — будет создан отдельный период с этой даты.
        </small>
      </div>
      <div class="form-field">
        <label>Заметки</label>
        <Textarea v-model="paymentForm.notes" rows="2" class="w-full" />
      </div>
      <div class="form-field checkbox-field">
        <Checkbox v-model="paymentForm.notifyTelegram" input-id="notifyTg" binary />
        <label for="notifyTg">Уведомить клиента в Telegram</label>
      </div>
      <div class="form-field checkbox-field">
        <Checkbox v-model="paymentForm.issueVpnAccount" input-id="issueVpn" binary />
        <label for="issueVpn">Выдать VPN-ключ</label>
      </div>
      <template v-if="paymentForm.issueVpnAccount">
        <Message v-if="hasActiveVpnConfig" severity="info" :closable="false" class="mb-3">
          У клиента уже есть ключ — конфиг можно не заполнять, будет отправлен существующий.
        </Message>
        <div class="form-field">
          <label>Название устройства</label>
          <InputText
            v-model="paymentForm.vpnLabel"
            class="w-full"
            placeholder="Телефон / ноутбук"
            :disabled="!paymentForm.vpnConfigSnapshot.trim() && hasActiveVpnConfig"
          />
        </div>
        <div class="form-field">
          <label>Config (Amnezia)</label>
          <Textarea
            v-model="paymentForm.vpnConfigSnapshot"
            rows="6"
            class="w-full"
            :placeholder="hasActiveVpnConfig ? 'Оставьте пустым, чтобы отправить существующий ключ' : 'Вставьте конфиг из Amnezia'"
          />
        </div>
      </template>
      <template #footer>
        <Button label="Отмена" text @click="showPaymentDialog = false" />
        <Button label="Сохранить" :loading="savingPayment" @click="submitPayment" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showVpnDialog" modal header="Выдать VPN-ключ" :style="{ width: '560px' }">
      <div class="form-field">
        <label>Название устройства</label>
        <InputText v-model="vpnForm.label" class="w-full" placeholder="Телефон / ноутбук" />
      </div>
      <div class="form-field">
        <label>Config (Amnezia)</label>
        <Textarea v-model="vpnForm.configSnapshot" rows="8" class="w-full" />
      </div>
      <template #footer>
        <Button label="Отмена" text @click="showVpnDialog = false" />
        <Button label="Сохранить" :loading="savingVpn" @click="submitVpnAccount" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showEditDialog" modal header="Редактировать клиента" :style="{ width: '480px' }">
      <div class="form-field">
        <label>Имя</label>
        <InputText v-model="editForm.name" class="w-full" />
      </div>
      <div class="form-field">
        <label>Контакт</label>
        <InputText v-model="editForm.contact" class="w-full" />
      </div>
      <div class="form-field">
        <label>Заметки</label>
        <Textarea v-model="editForm.notes" rows="3" class="w-full" />
      </div>
      <template #footer>
        <Button label="Отмена" text @click="showEditDialog = false" />
        <Button label="Сохранить" :loading="savingEdit" @click="saveEdit" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showConfigDialog" modal header="VPN Config" :style="{ width: '560px' }">
      <Textarea :model-value="selectedConfig" rows="10" readonly class="w-full" />
    </Dialog>

    <Dialog v-model:visible="showSuspendDialog" modal header="Приостановить подписку" :style="{ width: '480px' }">
      <Message severity="info" :closable="false" class="mb-3">
        Доступ к VPN будет временно отключён. Оставшиеся дни подписки сохранятся и продолжат идти после возобновления.
      </Message>
      <div class="form-field checkbox-field">
        <Checkbox v-model="suspendForm.suspendVpn" input-id="suspendVpn" binary />
        <label for="suspendVpn">Приостановить активные VPN-ключи</label>
      </div>
      <div class="form-field checkbox-field">
        <Checkbox
          v-model="suspendForm.notifyTelegram"
          input-id="notifySuspendTg"
          binary
          :disabled="!client?.telegramLink?.isLinked"
        />
        <label for="notifySuspendTg">Уведомить клиента в Telegram</label>
      </div>
      <template #footer>
        <Button label="Назад" text @click="showSuspendDialog = false" />
        <Button
          label="Приостановить"
          icon="pi pi-pause"
          severity="warn"
          :loading="suspendingSubscription"
          @click="submitSuspendSubscription"
        />
      </template>
    </Dialog>

    <Dialog v-model:visible="showResumeDialog" modal header="Возобновить подписку" :style="{ width: '480px' }">
      <Message severity="info" :closable="false" class="mb-3">
        Подписка снова станет активной. К дате окончания будет добавлено время, пока она была на паузе.
      </Message>
      <div class="form-field checkbox-field">
        <Checkbox v-model="resumeForm.activateVpn" input-id="activateVpn" binary />
        <label for="activateVpn">Активировать приостановленные VPN-ключи</label>
      </div>
      <div class="form-field checkbox-field">
        <Checkbox
          v-model="resumeForm.notifyTelegram"
          input-id="notifyResumeTg"
          binary
          :disabled="!client?.telegramLink?.isLinked"
        />
        <label for="notifyResumeTg">Уведомить клиента в Telegram</label>
      </div>
      <template #footer>
        <Button label="Назад" text @click="showResumeDialog = false" />
        <Button
          label="Возобновить"
          icon="pi pi-play"
          severity="success"
          :loading="resumingSubscription"
          @click="submitResumeSubscription"
        />
      </template>
    </Dialog>

    <Dialog v-model:visible="showRejectDialog" modal header="Отклонить заявку" :style="{ width: '480px' }">
      <div class="form-field">
        <label>Причина (необязательно)</label>
        <Textarea v-model="rejectForm.reason" rows="3" class="w-full" placeholder="Например: нет свободных слотов" />
      </div>
      <div class="form-field checkbox-field">
        <Checkbox
          v-model="rejectForm.notifyTelegram"
          input-id="notifyRejectTg"
          binary
          :disabled="!client?.telegramLink?.isLinked"
        />
        <label for="notifyRejectTg">Уведомить клиента в Telegram</label>
      </div>
      <template #footer>
        <Button label="Назад" text @click="showRejectDialog = false" />
        <Button
          label="Отклонить"
          icon="pi pi-times"
          severity="danger"
          :loading="rejectingLead"
          @click="submitRejectLead"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.mb-4 {
  margin-bottom: 1rem;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.notes {
  margin: 1rem 0 0;
  color: var(--p-text-muted-color);
}

.mt-3 {
  margin-top: 1rem;
}

.mb-3 {
  margin-bottom: 1rem;
}

.w-full {
  width: 100%;
}

.actions {
  display: flex;
  gap: 0.25rem;
}

.telegram-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 640px;
}

.telegram-info p {
  margin: 0 0 0.5rem;
}

.telegram-info p:last-child {
  margin-bottom: 0;
}

.telegram-steps {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--p-text-muted-color);
}

.link-label {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.link-box {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.link-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-direction: row;
}

.field-hint {
  display: block;
  margin-top: 0.35rem;
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
}
</style>
