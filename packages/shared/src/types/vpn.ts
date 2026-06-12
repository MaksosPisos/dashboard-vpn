export type VpnAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
export type VpnServerProvider = 'MANUAL' | 'AMNEZIA_API' | 'AWG_REST'

export interface VpnServer {
  id: string
  name: string
  apiUrl: string | null
  provider: VpnServerProvider
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface VpnAccount {
  id: string
  clientId: string
  serverId: string | null
  label: string
  externalPeerId: string | null
  status: VpnAccountStatus
  configSnapshot: string | null
  createdAt: string
  updatedAt: string
  server?: VpnServer | null
}

export interface TelegramLink {
  id: string
  clientId: string
  chatId: string
  username: string | null
  linkedAt: string
}

export interface CreateVpnAccountDto {
  label: string
  serverId?: string
  configSnapshot?: string
}

export interface CreateVpnServerDto {
  name: string
  apiUrl?: string
  provider?: VpnServerProvider
}
