<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { brandAssets, horizontalLogo } from '@/shared/config/brand'
import { useThemeStore } from '@/app/stores/theme'

const props = withDefaults(
  defineProps<{
    variant?: 'sidebar' | 'login' | 'icon'
    collapsed?: boolean
  }>(),
  {
    variant: 'sidebar',
    collapsed: false,
  },
)

const { resolvedTheme } = storeToRefs(useThemeStore())

const src = computed(() => {
  if (props.variant === 'icon' || props.collapsed) {
    return brandAssets.icon
  }

  if (props.variant === 'login') {
    return horizontalLogo(resolvedTheme.value)
  }

  return horizontalLogo(resolvedTheme.value)
})

const logoClass = computed(() => {
  if (props.variant === 'icon' || props.collapsed) {
    return 'app-logo app-logo--icon'
  }

  if (props.variant === 'login') {
    return 'app-logo app-logo--login-horizontal'
  }

  return 'app-logo app-logo--sidebar'
})
</script>

<template>
  <img :src="src" alt="VPN Dashboard" :class="logoClass" />
</template>
