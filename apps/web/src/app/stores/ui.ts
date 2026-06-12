import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const sidebarCollapsed = ref(false)

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  function toggleCollapsed() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    sidebarOpen,
    sidebarCollapsed,
    toggleSidebar,
    closeSidebar,
    toggleCollapsed,
  }
})
