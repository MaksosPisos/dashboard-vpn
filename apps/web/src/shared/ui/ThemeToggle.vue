<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import { useThemeStore, type ThemeMode } from '@/app/stores/theme'

const themeStore = useThemeStore()

const options = [
  { label: 'Светлая', value: 'light', icon: 'pi pi-sun' },
  { label: 'Тёмная', value: 'dark', icon: 'pi pi-moon' },
  { label: 'Система', value: 'system', icon: 'pi pi-desktop' },
]

function onChange(value: ThemeMode) {
  themeStore.setMode(value)
}
</script>

<template>
  <SelectButton
    :model-value="themeStore.mode"
    :options="options"
    option-label="label"
    option-value="value"
    aria-label="Theme"
    @update:model-value="onChange"
  >
    <template #option="{ option }">
      <i :class="option.icon" />
    </template>
  </SelectButton>
</template>
