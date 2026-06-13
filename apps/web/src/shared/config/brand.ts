export const brandAssets = {
  favicon: '/brand/favicon.png',
  icon: '/brand/icon.png',
  wordmarkDark: '/brand/wordmark-dark.png',
  horizontalDark: '/brand/logo-horizontal-dark-transparent.png',
  horizontalLight: '/brand/logo-horizontal-light-transparent.png',
  verticalDark: '/brand/logo-vertical-dark.png',
} as const

export function horizontalLogo(theme: 'light' | 'dark') {
  return theme === 'dark' ? brandAssets.horizontalDark : brandAssets.horizontalLight
}
