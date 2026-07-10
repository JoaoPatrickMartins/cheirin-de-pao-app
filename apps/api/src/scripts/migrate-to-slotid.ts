// migrate-to-slotid.ts — Etapa B: migra agendas e pedidos da chave `time` para `slotId`.
//
// Idempotente. Roda com: npm run migrate:slotid
//
// Pré-requisito: a config global de slots já deve existir (rode `npm run seed:slots` antes).
//
// O que faz, usando o mapa time→slotId da config global:
//   1. Schedule.days: reescreve as chaves "06:30"→"manha", "15:30"→"tarde" (mantém quantidades).
//      Chaves que já são slotId são preservadas; chaves desconhecidas são logadas e mantidas.
//   2. Schedule legado (days nulo, weeklyQty+deliveryTime): converte para days = { [slotId]: weeklyQty }.
//   3. Order em aberto (status SCHEDULED) sem slotId: backfill a partir do deliveryTime.

import { PrismaClient } from '@prisma/client'
import { getGlobalDeliverySlots } from '../lib/delivery-slots.js'

const prisma = new PrismaClient()

type WeeklyQty = Record<string, number>

async function main() {
  const slots = await getGlobalDeliverySlots(prisma)
  const timeToSlotId = new Map<string, string>()
  const knownSlotIds = new Set<string>()
  for (const s of slots) {
    timeToSlotId.set(s.time, s.slotId)
    knownSlotIds.add(s.slotId)
  }

  // Resolve uma chave (time OU slotId já migrado) para slotId; null se desconhecida.
  const resolve = (key: string): string | null =>
    knownSlotIds.has(key) ? key : timeToSlotId.get(key) ?? null

  // ── 1 + 2. Schedules ──────────────────────────────────────────────────────
  const schedules = await prisma.schedule.findMany()
  let daysRekeyed = 0
  let legacyConverted = 0
  let scheduleSkipped = 0
  const unmappedKeys = new Set<string>()

  for (const sched of schedules) {
    const days = sched.days as Record<string, WeeklyQty> | null

    if (days && Object.keys(days).length > 0) {
      // Rekey das chaves time→slotId (mescla se colidir)
      const next: Record<string, WeeklyQty> = {}
      let changed = false
      for (const [key, wq] of Object.entries(days)) {
        const slotId = resolve(key)
        if (!slotId) {
          unmappedKeys.add(key)
          next[key] = wq // mantém o que não souber mapear
          continue
        }
        if (slotId !== key) changed = true
        // mescla caso duas chaves resolvam ao mesmo slotId
        next[slotId] = next[slotId]
          ? mergeWeekly(next[slotId], wq)
          : wq
      }
      if (changed) {
        await prisma.schedule.update({ where: { id: sched.id }, data: { days: next } })
        daysRekeyed++
      } else {
        scheduleSkipped++
      }
      continue
    }

    // Legado: weeklyQty + deliveryTime → days = { [slotId]: weeklyQty }
    if (sched.weeklyQty && sched.deliveryTime) {
      const slotId = resolve(sched.deliveryTime)
      if (!slotId) {
        unmappedKeys.add(sched.deliveryTime)
        scheduleSkipped++
        continue
      }
      await prisma.schedule.update({
        where: { id: sched.id },
        data: { days: { [slotId]: sched.weeklyQty as WeeklyQty } },
      })
      legacyConverted++
      continue
    }

    scheduleSkipped++
  }

  // ── 3. Orders em aberto sem slotId ────────────────────────────────────────
  // Importante: `slotId` pode estar AUSENTE (não apenas null) em docs criados antes do campo
  // existir — o filtro Prisma `slotId: null` NÃO casa campos ausentes no MongoDB. Por isso
  // buscamos amplo (status + deliveryTime) e filtramos `!slotId` em código.
  const candidates = await prisma.order.findMany({
    where: { deliveryTime: { not: null }, status: { not: 'CANCELLED' } },
    select: { id: true, slotId: true, deliveryTime: true },
  })
  const openOrders = candidates.filter((o) => !o.slotId)
  let ordersBackfilled = 0
  let ordersSkipped = 0
  for (const o of openOrders) {
    const slotId = o.deliveryTime ? resolve(o.deliveryTime) : null
    if (!slotId) {
      if (o.deliveryTime) unmappedKeys.add(o.deliveryTime)
      ordersSkipped++
      continue
    }
    await prisma.order.update({ where: { id: o.id }, data: { slotId } })
    ordersBackfilled++
  }

  console.log('Migração time→slotId concluída:')
  console.log(`  Schedules: ${daysRekeyed} rekey, ${legacyConverted} legado convertido, ${scheduleSkipped} sem mudança.`)
  console.log(`  Orders: ${ordersBackfilled} backfill, ${ordersSkipped} sem mapeamento.`)
  if (unmappedKeys.size > 0) {
    console.warn(`  ATENÇÃO — chaves sem correspondência na config global: ${[...unmappedKeys].join(', ')}`)
  }
}

function mergeWeekly(a: WeeklyQty, b: WeeklyQty): WeeklyQty {
  const out: WeeklyQty = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v
  return out
}

main()
  .catch((err) => {
    console.error('Falha na migração time→slotId:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
