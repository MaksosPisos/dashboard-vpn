import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import {
  createVpnServerSchema,
  updateVpnServerSchema,
} from '../schemas/index.js'

function mapVpnAccount(account: {
  id: string
  clientId: string
  serverId: string | null
  label: string
  externalPeerId: string | null
  status: string
  configSnapshot: string | null
  createdAt: Date
  updatedAt: Date
  client?: { name: string }
  server?: { id: string; name: string; apiUrl: string | null; provider: string; isActive: boolean; createdAt: Date; updatedAt: Date } | null
}) {
  return {
    id: account.id,
    clientId: account.clientId,
    clientName: account.client?.name ?? null,
    serverId: account.serverId,
    label: account.label,
    externalPeerId: account.externalPeerId,
    status: account.status,
    configSnapshot: account.configSnapshot,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    server: account.server
      ? {
          id: account.server.id,
          name: account.server.name,
          apiUrl: account.server.apiUrl,
          provider: account.server.provider,
          isActive: account.server.isActive,
          createdAt: account.server.createdAt.toISOString(),
          updatedAt: account.server.updatedAt.toISOString(),
        }
      : null,
  }
}

export async function vpnRoutes(app: FastifyInstance) {
  app.get('/vpn-accounts', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { status, clientId } = request.query as { status?: string; clientId?: string }

    const accounts = await prisma.vpnAccount.findMany({
      where: {
        ...(status ? { status: status.toUpperCase() as 'ACTIVE' | 'SUSPENDED' | 'REVOKED' } : {}),
        ...(clientId ? { clientId } : {}),
      },
      include: { client: true, server: true },
      orderBy: { createdAt: 'desc' },
    })

    return accounts.map(mapVpnAccount)
  })

  app.patch('/vpn-accounts/:id/suspend', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const account = await prisma.vpnAccount.update({
        where: { id },
        data: { status: 'SUSPENDED' },
        include: { client: true, server: true },
      })
      return mapVpnAccount(account)
    } catch {
      return reply.status(404).send({ message: 'VPN account not found' })
    }
  })

  app.patch('/vpn-accounts/:id/revoke', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const account = await prisma.vpnAccount.update({
        where: { id },
        data: { status: 'REVOKED' },
        include: { client: true, server: true },
      })
      return mapVpnAccount(account)
    } catch {
      return reply.status(404).send({ message: 'VPN account not found' })
    }
  })

  app.get('/vpn-servers', {
    preHandler: [app.authenticate],
  }, async () => {
    const servers = await prisma.vpnServer.findMany({ orderBy: { name: 'asc' } })
    return servers.map((server) => ({
      id: server.id,
      name: server.name,
      apiUrl: server.apiUrl,
      provider: server.provider,
      isActive: server.isActive,
      createdAt: server.createdAt.toISOString(),
      updatedAt: server.updatedAt.toISOString(),
    }))
  })

  app.post('/vpn-servers', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const body = createVpnServerSchema.parse(request.body)
    const server = await prisma.vpnServer.create({ data: body })
    return {
      id: server.id,
      name: server.name,
      apiUrl: server.apiUrl,
      provider: server.provider,
      isActive: server.isActive,
      createdAt: server.createdAt.toISOString(),
      updatedAt: server.updatedAt.toISOString(),
    }
  })

  app.patch('/vpn-servers/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateVpnServerSchema.parse(request.body)

    try {
      const server = await prisma.vpnServer.update({ where: { id }, data: body })
      return {
        id: server.id,
        name: server.name,
        apiUrl: server.apiUrl,
        provider: server.provider,
        isActive: server.isActive,
        createdAt: server.createdAt.toISOString(),
        updatedAt: server.updatedAt.toISOString(),
      }
    } catch {
      return reply.status(404).send({ message: 'VPN server not found' })
    }
  })
}
