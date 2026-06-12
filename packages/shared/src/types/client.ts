export type ClientStatus = 'active' | 'inactive' | 'suspended'

export interface Client {
  id: string
  name: string
  contact: string | null
  notes: string | null
  status: ClientStatus
  createdAt: string
  updatedAt: string
}

export interface ClientListItem extends Client {
  activeAccountsCount: number
  subscriptionStatus: SubscriptionDisplayStatus | null
  subscriptionEndDate: string | null
  telegramUsername: string | null
}

export type SubscriptionDisplayStatus =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'suspended'

export interface CreateClientDto {
  name: string
  contact?: string
  notes?: string
}

export interface UpdateClientDto {
  name?: string
  contact?: string | null
  notes?: string | null
  status?: ClientStatus
}
