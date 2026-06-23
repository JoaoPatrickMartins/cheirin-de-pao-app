// delivery-slots.ts — config GLOBAL de slots de entrega (fonte da verdade).
//
// Etapa A da refatoração de cutoff:
// - A config global vive em Setting(key='deliverySlots') como JSON.
// - Cada condomínio mantém seu próprio `deliverySlots` (usado pelo runtime); ao salvar
//   a config global, propagamos para todos os condomínios.
// - PROPAGAÇÃO PRESERVA `time` (chave de junção de agendas/pedidos) e `name` (identidade).
//   Só `cutoffTime`, `label`, `emoji`, `isActive` e `slotId` são sincronizados.
// - `slotId` é o identificador estável (reaproveita os valores de `name`: "manha"/"tarde").
//   Na Etapa B ele passa a ser a chave de junção; aqui só é introduzido.

import type { PrismaClient } from '@prisma/client'

export interface GlobalDeliverySlot {
  slotId: string
  name: string
  label: string
  emoji: string
  time: string
  cutoffTime: string
  isActive: boolean
}

export const DELIVERY_SLOTS_SETTING_KEY = 'deliverySlots'

export const DEFAULT_DELIVERY_SLOTS: GlobalDeliverySlot[] = [
  { slotId: 'manha', name: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', cutoffTime: '22:00', isActive: true },
  { slotId: 'tarde', name: 'tarde', label: 'Tarde', emoji: '🌙', time: '15:30', cutoffTime: '10:00', isActive: true },
]

const FALLBACK_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }
const FALLBACK_EMOJI: Record<string, string> = { manha: '☀️', tarde: '🌙' }

/** Slot "cru" como vem do banco (composite legado pode não ter slotId/label/emoji). */
export interface RawSlot {
  slotId?: string | null
  name: string
  label?: string | null
  emoji?: string | null
  time: string
  cutoffTime: string
  isActive: boolean
}

/**
 * Preenche campos novos (slotId/label/emoji) a partir de `name` quando ausentes —
 * para slots legados gravados antes da Etapa A.
 */
export function normalizeSlot(s: RawSlot): GlobalDeliverySlot {
  const slotId = s.slotId ?? s.name
  return {
    slotId,
    name: s.name ?? slotId,
    label: s.label ?? FALLBACK_LABEL[slotId] ?? s.name,
    emoji: s.emoji ?? FALLBACK_EMOJI[slotId] ?? '',
    time: s.time,
    cutoffTime: s.cutoffTime,
    isActive: s.isActive,
  }
}

/**
 * Edições permitidas. A partir da Etapa B, `time` (horário de entrega) também é editável —
 * a junção de agendas/pedidos passou a usar `slotId`, então mudar `time` é seguro.
 * `slotId`/`name` continuam imutáveis (identidade).
 */
export interface SlotPatch {
  slotId: string
  cutoffTime?: string
  time?: string
  label?: string
  emoji?: string
  isActive?: boolean
}

/**
 * Retorna a config global de slots (fonte da verdade). Default quando ausente/corrompida.
 */
export async function getGlobalDeliverySlots(prisma: PrismaClient): Promise<GlobalDeliverySlot[]> {
  const row = await prisma.setting.findUnique({ where: { key: DELIVERY_SLOTS_SETTING_KEY } })
  if (!row?.value) return DEFAULT_DELIVERY_SLOTS
  try {
    const parsed = JSON.parse(row.value) as RawSlot[]
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_DELIVERY_SLOTS
    return parsed.map(normalizeSlot)
  } catch {
    return DEFAULT_DELIVERY_SLOTS
  }
}

/**
 * Aplica os patches (por slotId) na config global, persiste e propaga para todos os condos.
 * Campos não informados em cada patch são mantidos. Retorna a config resultante.
 */
export async function setGlobalDeliverySlots(
  prisma: PrismaClient,
  patches: SlotPatch[],
): Promise<GlobalDeliverySlot[]> {
  const current = await getGlobalDeliverySlots(prisma)
  const byId = new Map(patches.map((p) => [p.slotId, p]))

  const updated: GlobalDeliverySlot[] = current.map((slot) => {
    const p = byId.get(slot.slotId)
    if (!p) return slot
    return {
      ...slot,
      ...(p.cutoffTime !== undefined ? { cutoffTime: p.cutoffTime } : {}),
      ...(p.time !== undefined ? { time: p.time } : {}),
      ...(p.label !== undefined ? { label: p.label } : {}),
      ...(p.emoji !== undefined ? { emoji: p.emoji } : {}),
      ...(p.isActive !== undefined ? { isActive: p.isActive } : {}),
    }
  })

  await prisma.setting.upsert({
    where: { key: DELIVERY_SLOTS_SETTING_KEY },
    create: { key: DELIVERY_SLOTS_SETTING_KEY, value: JSON.stringify(updated) },
    update: { value: JSON.stringify(updated) },
  })

  await propagateToCondos(prisma, updated)
  return updated
}

/**
 * Propaga a config global para o `deliverySlots` de todos os condomínios.
 *
 * Alinha cada slot do condomínio à config global por `slotId` (fallback `name`) e sincroniza
 * `slotId`, `label`, `emoji`, `time`, `cutoffTime`, `isActive`. **`name` é PRESERVADO** (identidade).
 * A partir da Etapa B `time` também é propagado — a junção passou a ser por `slotId`.
 *
 * Slots do condomínio sem correspondência na config global ficam inalterados (não removemos
 * nem adicionamos slots aqui — isso seria mudança de disponibilidade, fora do escopo).
 */
export async function propagateToCondos(
  prisma: PrismaClient,
  slots: GlobalDeliverySlot[],
): Promise<void> {
  const globalById = new Map(slots.map((s) => [s.slotId, s]))
  const condos = await prisma.condominium.findMany({ select: { id: true, deliverySlots: true } })

  for (const condo of condos) {
    const merged = (condo.deliverySlots as RawSlot[]).map((cs) => {
      const key = cs.slotId ?? cs.name
      const g = globalById.get(key)
      if (!g) return cs
      return {
        slotId: g.slotId,
        name: cs.name, // identidade preservada
        label: g.label,
        emoji: g.emoji,
        time: g.time,
        cutoffTime: g.cutoffTime,
        isActive: g.isActive,
      }
    })
    await prisma.condominium.update({ where: { id: condo.id }, data: { deliverySlots: merged } })
  }
}
