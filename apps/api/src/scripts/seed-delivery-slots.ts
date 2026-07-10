// seed-delivery-slots.ts — Etapa A: estabelece a config GLOBAL de slots como fonte da verdade
// e faz backfill de slotId/label/emoji nos condomínios existentes.
//
// Idempotente. Roda com: npm run seed:slots
//
// O que faz:
//   1. Garante que todo condomínio tenha slots no formato atual (DEFAULT se vazio/legado).
//   2. Persiste a config global (Setting key='deliverySlots'); se ausente, usa o DEFAULT.
//   3. Propaga a config global para todos os condos — preenchendo slotId/label/emoji e
//      sincronizando cutoffTime/isActive, PRESERVANDO `time` (chave de junção) e `name`.

import { PrismaClient } from '@prisma/client'
import {
  DEFAULT_DELIVERY_SLOTS,
  getGlobalDeliverySlots,
  setGlobalDeliverySlots,
} from '../lib/delivery-slots.js'

const prisma = new PrismaClient()

async function main() {
  // 1. Condomínios sem slots (ou legados sem `name`) recebem o DEFAULT no formato atual.
  const condos = await prisma.condominium.findMany({ select: { id: true, deliverySlots: true } })
  let seededCondos = 0
  for (const condo of condos) {
    const slots = condo.deliverySlots as Array<{ name?: string }>
    const needsSeed = slots.length === 0 || typeof slots[0]?.name !== 'string'
    if (needsSeed) {
      await prisma.condominium.update({
        where: { id: condo.id },
        data: { deliverySlots: DEFAULT_DELIVERY_SLOTS },
      })
      seededCondos++
    }
  }

  // 2 + 3. Persiste a config global atual (DEFAULT se ainda não existir) e propaga para
  // todos os condos — patches vazios (só slotId) mantêm os valores e disparam o backfill.
  const current = await getGlobalDeliverySlots(prisma)
  const result = await setGlobalDeliverySlots(
    prisma,
    current.map((s) => ({ slotId: s.slotId })),
  )

  console.log(
    `Seed de slots concluído: ${seededCondos} condomínio(s) inicializado(s); ` +
      `config global propagada para ${condos.length} condomínio(s).`,
  )
  console.log('Config global:', JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error('Falha no seed de slots:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
