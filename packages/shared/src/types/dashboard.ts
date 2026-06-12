export interface DashboardStats {
  activeClients: number
  activeSubscriptions: number
  expiringSoon: number
  expired: number
  monthlyRevenue: string
  recentPayments: Array<{
    id: string
    clientName: string
    amount: string
    paidAt: string
  }>
}
