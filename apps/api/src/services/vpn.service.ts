import { prisma } from '../lib/prisma.js'

function hasConfigSnapshot(config: string | null | undefined): config is string {
  return Boolean(config?.trim())
}

export class VpnService {
  async reactivateSuspendedAccounts(clientId: string) {
    await prisma.vpnAccount.updateMany({
      where: { clientId, status: 'SUSPENDED' },
      data: { status: 'ACTIVE' },
    })
  }

  async findActiveAccountWithConfig(clientId: string) {
    const accounts = await this.findActiveConfigsForClient(clientId, 1)
    return accounts[0] ?? null
  }

  async findActiveConfigsForClient(clientId: string, limit?: number) {
    const accounts = await prisma.vpnAccount.findMany({
      where: {
        clientId,
        status: 'ACTIVE',
        configSnapshot: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: limit } : {}),
    })

    return accounts.filter((account) => hasConfigSnapshot(account.configSnapshot))
  }

  async createAccount(
    clientId: string,
    input: { label: string; configSnapshot: string; serverId?: string },
  ) {
    return prisma.vpnAccount.create({
      data: {
        clientId,
        label: input.label,
        configSnapshot: input.configSnapshot,
        serverId: input.serverId,
      },
    })
  }

  async issueAfterPayment(
    clientId: string,
    input: { label?: string; configSnapshot?: string; serverId?: string },
  ) {
    await this.reactivateSuspendedAccounts(clientId)

    const configSnapshot = input.configSnapshot?.trim()
    if (configSnapshot) {
      const label = input.label?.trim()
      if (!label) {
        throw new Error('VPN_LABEL_REQUIRED')
      }

      return this.createAccount(clientId, {
        label,
        configSnapshot,
        serverId: input.serverId,
      })
    }

    const existing = await this.findActiveAccountWithConfig(clientId)
    if (!existing) {
      throw new Error('VPN_CONFIG_REQUIRED')
    }

    return existing
  }
}

export const vpnService = new VpnService()
