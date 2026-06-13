<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'
import AppLogo from '@/shared/ui/AppLogo.vue'
import { useAuthStore } from '@/app/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('admin@example.com')
const password = ref('admin123')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  loading.value = true
  error.value = ''

  try {
    await auth.login(email.value, password.value)
    await auth.fetchMe()
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка входа'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <Card class="login-card">
      <template #title>
        <div class="login-brand">
          <AppLogo variant="login" />
          <span>Вход</span>
        </div>
      </template>
      <template #subtitle>Учёт клиентов, подписок и ключей Amnezia</template>
      <template #content>
        <form @submit.prevent="onSubmit">
          <Message v-if="error" severity="error" :closable="false" class="mb-3">
            {{ error }}
          </Message>

          <div class="form-field">
            <label for="email">Email</label>
            <InputText id="email" v-model="email" type="email" class="w-full" />
          </div>

          <div class="form-field">
            <label for="password">Пароль</label>
            <Password
              id="password"
              v-model="password"
              :feedback="false"
              toggle-mask
              class="w-full"
              input-class="w-full"
            />
          </div>

          <Button type="submit" label="Войти" class="w-full" :loading="loading" />
        </form>
      </template>
      <template #footer>
        <div class="topbar-actions" style="justify-content: center;">
          <ThemeToggle />
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.w-full {
  width: 100%;
}

.mb-3 {
  margin-bottom: 1rem;
}
</style>
