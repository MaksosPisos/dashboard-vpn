import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { addDays } from '../src/services/date.js'

config({ path: resolve(process.cwd(), '../../.env') })
config({ path: resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'admin123', 10)

  await prisma.adminUser.upsert({
    where: { email: process.env.ADMIN_EMAIL ?? 'admin@example.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
      passwordHash,
    },
  })

  const monthlyPlan = await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: '1 месяц',
      durationDays: 30,
      price: 300,
      maxDevices: 2,
    },
  })

  const quarterlyPlan = await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: '3 месяца',
      durationDays: 90,
      price: 800,
      maxDevices: 3,
    },
  })

  const server = await prisma.vpnServer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Amnezia Main',
      provider: 'MANUAL',
    },
  })

  const clientsData = [
    { name: 'Алексей Иванов', contact: '@alex_vpn', daysLeft: 25 },
    { name: 'Мария Петрова', contact: 'maria@mail.ru', daysLeft: 5 },
    { name: 'Дмитрий Сидоров', contact: '@dmitry_s', daysLeft: -3 },
    { name: 'Елена Козлова', contact: '+7 900 123-45-67', daysLeft: 60 },
    { name: 'Игорь Новиков', contact: '@igor_n', daysLeft: 1 },
  ]

  for (const [index, item] of clientsData.entries()) {
    const endDate = addDays(new Date(), item.daysLeft)
    const startDate = addDays(endDate, -30)
    const plan = item.daysLeft >= 60 ? quarterlyPlan : monthlyPlan

    const client = await prisma.client.upsert({
      where: { id: `00000000-0000-0000-0000-00000000010${index}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000010${index}`,
        name: item.name,
        contact: item.contact,
        notes: index === 2 ? 'Просрочил оплату, написать в Telegram' : null,
        status: item.daysLeft < 0 ? 'ACTIVE' : 'ACTIVE',
      },
    })

    await prisma.subscription.upsert({
      where: { id: `00000000-0000-0000-0000-00000000020${index}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000020${index}`,
        clientId: client.id,
        planId: plan.id,
        startDate,
        endDate,
        status: item.daysLeft < 0 ? 'EXPIRED' : 'ACTIVE',
      },
    })

    await prisma.payment.upsert({
      where: { id: `00000000-0000-0000-0000-00000000030${index}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000030${index}`,
        clientId: client.id,
        subscriptionId: `00000000-0000-0000-0000-00000000020${index}`,
        planId: plan.id,
        amount: plan.price,
        paidAt: startDate,
        method: index % 2 === 0 ? 'TRANSFER' : 'CASH',
        status: 'PAID',
      },
    })

    await prisma.vpnAccount.upsert({
      where: { id: `00000000-0000-0000-0000-00000000040${index}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000040${index}`,
        clientId: client.id,
        serverId: server.id,
        label: `${item.name} — телефон`,
        status: item.daysLeft < 0 ? 'SUSPENDED' : 'ACTIVE',
        configSnapshot: '[Interface]\nPrivateKey=...\n[Peer]\nPublicKey=...',
      },
    })
  }

  console.log('Seed completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
