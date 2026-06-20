import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_SLOTS = [
  { name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
  { name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
]

async function main() {
  const condos = await prisma.condominium.findMany()
  let updated = 0
  let skipped = 0

  for (const condo of condos) {
    const slots = condo.deliverySlots as unknown[]
    const needsMigration =
      slots.length === 0 || typeof (slots[0] as Record<string, unknown>).name !== 'string'

    if (needsMigration) {
      await prisma.condominium.update({
        where: { id: condo.id },
        data: { deliverySlots: DEFAULT_SLOTS },
      })
      updated++
    } else {
      skipped++
    }
  }

  console.log(`Migração concluída: ${updated} condomínios atualizados, ${skipped} já estavam migrados`)
}

main().finally(() => prisma.$disconnect())
