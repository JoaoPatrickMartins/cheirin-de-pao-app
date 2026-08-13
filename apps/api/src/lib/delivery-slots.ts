// delivery-slots.ts — config de slots de entrega: PADRÃO global + personalização por condomínio.
//
// Etapa A: a config global passou a viver em Setting(key='deliverySlots') e a ser propagada para
//   o `deliverySlots` de cada condomínio (que é o que o runtime lê).
// Etapa B: `time` (horário de entrega) tornou-se editável — a junção de agendas/pedidos passou a
//   usar `slotId`, então mudar o horário deixou de ser destrutivo.
// Etapa C (esta): `time` e `isActive` passam a ser PERSONALIZÁVEIS POR CONDOMÍNIO.
//   - A config global é o PADRÃO. Cada slot de condomínio carrega `timeCustom`/`activeCustom`:
//     false/ausente = herda (a propagação sobrescreve); true = valor local (a propagação PRESERVA).
//   - `cutoffTime` continua SEMPRE global (propagado por cima, sem exceção): o pipeline de pedido
//     ao fornecedor assume um corte único por (turno, data).
//   - `name` (identidade) e `slotId` seguem imutáveis; `label`/`emoji` seguem globais.
//
// REGRA A (ver cutoff.ts): a data de entrega de um corte é HOJE quando `time > cutoffTime`, senão
// AMANHÃ. Como o pedido ao fornecedor é gerado por (turno, data) a partir do horário GLOBAL, todo
// condomínio precisa cair do MESMO lado dessa fronteira — ver `validateCondoSlotTime`.

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

/** Slot de um condomínio: valor efetivo + de onde veio (para o badge "herdado" na UI). */
export interface CondoDeliverySlot extends GlobalDeliverySlot {
  timeCustom: boolean
  activeCustom: boolean
}

/**
 * Slot como a API devolve, num escopo ou no outro: no padrão global as flags de personalização
 * não existem; no escopo de um condomínio elas vêm preenchidas. Um tipo só evita que cada
 * consumidor tenha que estreitar uma união de arrays.
 */
export type DeliverySlotView = GlobalDeliverySlot & Partial<Pick<CondoDeliverySlot, 'timeCustom' | 'activeCustom'>>

export const DELIVERY_SLOTS_SETTING_KEY = 'deliverySlots'

export const DEFAULT_DELIVERY_SLOTS: GlobalDeliverySlot[] = [
  { slotId: 'manha', name: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', cutoffTime: '22:00', isActive: true },
  { slotId: 'tarde', name: 'tarde', label: 'Tarde', emoji: '🌙', time: '15:30', cutoffTime: '10:00', isActive: true },
]

const FALLBACK_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }
const FALLBACK_EMOJI: Record<string, string> = { manha: '☀️', tarde: '🌙' }

export const HHMM_RE = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/

/** Slot "cru" como vem do banco (composite legado pode não ter slotId/label/emoji/flags). */
export interface RawSlot {
  slotId?: string | null
  name: string
  label?: string | null
  emoji?: string | null
  time: string
  cutoffTime: string
  isActive: boolean
  timeCustom?: boolean | null
  activeCustom?: boolean | null
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

/** Como `normalizeSlot`, expondo as flags de personalização (ausente = herdado). */
export function normalizeCondoSlot(s: RawSlot): CondoDeliverySlot {
  return {
    ...normalizeSlot(s),
    timeCustom: s.timeCustom === true,
    activeCustom: s.activeCustom === true,
  }
}

/**
 * Lado da REGRA A: `true` = a entrega desse turno cai no MESMO dia do corte; `false` = no dia
 * seguinte. Fronteira que todo condomínio de um turno precisa respeitar em conjunto.
 */
export function isSameDayDelivery(time: string, cutoffTime: string): boolean {
  return time > cutoffTime
}

/**
 * Valida um horário de entrega personalizado contra o corte GLOBAL do turno.
 *
 * Recusa quando o horário local inverte a Regra A em relação ao horário global — nesse caso o
 * condomínio entregaria num dia diferente do resto da operação naquele mesmo corte, e o pedido
 * ao fornecedor (gerado por turno + data) erraria a data desse condomínio.
 *
 * @returns mensagem de erro (pt-BR, acionável) ou `null` se válido.
 */
export function validateCondoSlotTime(
  slot: Pick<GlobalDeliverySlot, 'label' | 'time' | 'cutoffTime'>,
  condoTime: string,
): string | null {
  if (!HHMM_RE.test(condoTime)) {
    return `Horário de entrega inválido em "${slot.label}". Use HH:MM.`
  }
  const globalSameDay = isSameDayDelivery(slot.time, slot.cutoffTime)
  if (isSameDayDelivery(condoTime, slot.cutoffTime) === globalSameDay) return null

  return globalSameDay
    ? `Em "${slot.label}" o corte é ${slot.cutoffTime} e a entrega é no MESMO dia, então o horário do condomínio precisa ser depois de ${slot.cutoffTime}.`
    : `Em "${slot.label}" o corte é ${slot.cutoffTime} e a entrega é no dia seguinte, então o horário do condomínio precisa ser até ${slot.cutoffTime}.`
}

/**
 * Edições permitidas na config GLOBAL. `slotId`/`name` são imutáveis (identidade).
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
 * Edições permitidas num CONDOMÍNIO. Só horário de entrega e ativação — o corte é global.
 * `null` em qualquer campo = voltar a HERDAR o padrão global.
 */
export interface CondoSlotPatch {
  slotId: string
  time?: string | null
  isActive?: boolean | null
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
 *
 * Antes de gravar, verifica se a nova config invalidaria algum horário PERSONALIZADO de
 * condomínio pela Regra A (ex.: mover o corte para depois do horário local de um condo). Nesse
 * caso lança 422 nomeando os condomínios — melhor recusar do que propagar uma config que faria o
 * pedido ao fornecedor errar a data.
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

  await assertCondoTimesStillValid(prisma, updated)

  await prisma.setting.upsert({
    where: { key: DELIVERY_SLOTS_SETTING_KEY },
    create: { key: DELIVERY_SLOTS_SETTING_KEY, value: JSON.stringify(updated) },
    update: { value: JSON.stringify(updated) },
  })

  await propagateToCondos(prisma, updated)
  return updated
}

/**
 * Garante que nenhum horário PERSONALIZADO de condomínio viola a Regra A sob a nova config
 * global. Só olha slots com `timeCustom` — os herdados acompanham o global por construção.
 *
 * @throws { statusCode: 422 } listando os condomínios em conflito.
 */
async function assertCondoTimesStillValid(
  prisma: PrismaClient,
  slots: GlobalDeliverySlot[],
): Promise<void> {
  const globalById = new Map(slots.map((s) => [s.slotId, s]))
  const condos = await prisma.condominium.findMany({
    select: { id: true, name: true, deliverySlots: true },
  })

  const conflicts: string[] = []
  for (const condo of condos) {
    for (const cs of condo.deliverySlots as RawSlot[]) {
      if (cs.timeCustom !== true) continue
      const g = globalById.get(cs.slotId ?? cs.name)
      if (!g) continue
      if (validateCondoSlotTime(g, cs.time)) {
        conflicts.push(`${condo.name} (${g.label} ${cs.time})`)
      }
    }
  }

  if (conflicts.length > 0) {
    throw {
      statusCode: 422,
      message:
        `Esta mudança conflita com o horário de entrega personalizado de: ${conflicts.join(', ')}. ` +
        'Ajuste esses condomínios primeiro (ou faça voltarem a herdar o padrão).',
    }
  }
}

/**
 * Propaga a config global para o `deliverySlots` de todos os condomínios.
 *
 * Alinha cada slot do condomínio à config global por `slotId` (fallback `name`). **`name` é
 * PRESERVADO** (identidade) e `cutoffTime`/`label`/`emoji` são SEMPRE sobrescritos (globais).
 * `time` e `isActive` só são sobrescritos quando o condomínio NÃO os personalizou
 * (`timeCustom`/`activeCustom`) — é isso que permite horário e turno por condomínio.
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
      const timeCustom = cs.timeCustom === true
      const activeCustom = cs.activeCustom === true
      return {
        slotId: g.slotId,
        name: cs.name, // identidade preservada
        label: g.label,
        emoji: g.emoji,
        time: timeCustom ? cs.time : g.time,
        cutoffTime: g.cutoffTime, // o corte é sempre global
        isActive: activeCustom ? cs.isActive : g.isActive,
        timeCustom,
        activeCustom,
      }
    })
    await prisma.condominium.update({ where: { id: condo.id }, data: { deliverySlots: merged } })
  }
}

/**
 * Valor EFETIVO de um slot de condomínio: o local no que foi personalizado, o padrão global no
 * resto. Função PURA — o ponto único onde "o que vale de verdade" é decidido, usada tanto pela
 * leitura de um condomínio quanto pelos crons que varrem todos.
 *
 * Sem correspondência no padrão global (slot exclusivo do condomínio), devolve o local como está.
 */
export function resolveEffectiveSlot(
  raw: RawSlot,
  global: GlobalDeliverySlot | undefined,
): CondoDeliverySlot {
  const normalized = normalizeCondoSlot(raw)
  if (!global) return normalized
  return {
    ...normalized,
    label: global.label,
    emoji: global.emoji,
    cutoffTime: global.cutoffTime, // sempre global
    time: normalized.timeCustom ? normalized.time : global.time,
    isActive: normalized.activeCustom ? normalized.isActive : global.isActive,
  }
}

/**
 * Slots EFETIVOS de um condomínio (o que o runtime usa), já alinhados ao padrão global naquilo
 * que não foi personalizado. Não cria nem remove slots — devolve os do condomínio.
 *
 * @throws { statusCode: 404 } condomínio inexistente.
 */
export async function getCondoDeliverySlots(
  prisma: PrismaClient,
  condominiumId: string,
): Promise<CondoDeliverySlot[]> {
  const [condo, global] = await Promise.all([
    prisma.condominium.findUnique({
      where: { id: condominiumId },
      select: { deliverySlots: true },
    }),
    getGlobalDeliverySlots(prisma),
  ])
  if (!condo) throw { statusCode: 404, message: 'Condomínio não encontrado' }

  const globalById = new Map(global.map((s) => [s.slotId, s]))
  return (condo.deliverySlots as RawSlot[]).map((cs) =>
    resolveEffectiveSlot(cs, globalById.get(cs.slotId ?? cs.name)),
  )
}

// ------------------------------------------------------------------ agrupamento por horário

/**
 * Um turno ATIVO de um condomínio ATIVO, já no horário efetivo daquele condomínio.
 */
export interface CondoSlotOccurrence {
  condominiumId: string
  condominiumName: string
  slot: CondoDeliverySlot
}

/**
 * Um grupo de condomínios que compartilham o MESMO turno no MESMO horário efetivo.
 *
 * Sem personalização, há exatamente um grupo por turno cobrindo todos os condomínios — que é o
 * comportamento histórico. Cada horário personalizado destaca aqueles condomínios num grupo
 * próprio, sem fragmentar os demais.
 */
export interface CondoSlotGroup {
  slotId: string
  label: string
  /** Horário de entrega efetivo compartilhado pelo grupo (HH:MM). */
  time: string
  condominiumIds: string[]
  condominiumNames: string[]
  /** true quando o grupo cobre TODOS os condomínios que têm esse turno ativo. */
  coversAllCondos: boolean
}

/**
 * Todos os pares (condomínio ativo, turno ativo) com o horário EFETIVO de cada um, numa leitura
 * só. É o que permite aos crons dispararem pelo horário real de cada condomínio em vez de pelo
 * horário do padrão global.
 */
export async function listActiveCondoSlots(prisma: PrismaClient): Promise<CondoSlotOccurrence[]> {
  const [condos, global] = await Promise.all([
    prisma.condominium.findMany({
      where: { isActive: true },
      select: { id: true, name: true, deliverySlots: true },
    }),
    getGlobalDeliverySlots(prisma),
  ])
  const globalById = new Map(global.map((s) => [s.slotId, s]))

  const out: CondoSlotOccurrence[] = []
  for (const condo of condos) {
    for (const raw of condo.deliverySlots as RawSlot[]) {
      const slot = resolveEffectiveSlot(raw, globalById.get(raw.slotId ?? raw.name))
      if (!slot.isActive) continue
      out.push({ condominiumId: condo.id, condominiumName: condo.name, slot })
    }
  }
  return out
}

/**
 * Agrupa as ocorrências por (turno, horário efetivo). Função PURA.
 *
 * Ordenada por horário e depois por slotId — determinístico, o que torna os testes estáveis e a
 * ordem dos avisos previsível.
 */
export function groupCondoSlotsByTime(occurrences: CondoSlotOccurrence[]): CondoSlotGroup[] {
  // Quantos condomínios têm cada turno ativo — base do `coversAllCondos`.
  const condosPerSlot = new Map<string, Set<string>>()
  for (const o of occurrences) {
    const set = condosPerSlot.get(o.slot.slotId) ?? new Set<string>()
    set.add(o.condominiumId)
    condosPerSlot.set(o.slot.slotId, set)
  }

  const groups = new Map<string, CondoSlotGroup>()
  for (const o of occurrences) {
    const key = `${o.slot.slotId}|${o.slot.time}`
    const g = groups.get(key) ?? {
      slotId: o.slot.slotId,
      label: o.slot.label,
      time: o.slot.time,
      condominiumIds: [],
      condominiumNames: [],
      coversAllCondos: false,
    }
    g.condominiumIds.push(o.condominiumId)
    g.condominiumNames.push(o.condominiumName)
    groups.set(key, g)
  }

  for (const g of groups.values()) {
    g.coversAllCondos = g.condominiumIds.length === (condosPerSlot.get(g.slotId)?.size ?? 0)
  }

  return [...groups.values()].sort(
    (a, b) => a.time.localeCompare(b.time) || a.slotId.localeCompare(b.slotId),
  )
}

/** Minuto do dia (0..1439) de um "HH:MM", com deslocamento opcional. Envolve na meia-noite. */
export function minuteOfDay(hhmm: string, offsetMin = 0): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (((h * 60 + m + offsetMin) % 1440) + 1440) % 1440
}

/**
 * Aplica patches nos slots de UM condomínio (horário de entrega + ativação).
 *
 * `time: null` / `isActive: null` = voltar a HERDAR o padrão global (limpa a flag e readota o
 * valor global na hora). Um `time` informado é validado contra a Regra A do corte global.
 *
 * @throws { statusCode: 404 } condomínio inexistente
 * @throws { statusCode: 422 } horário inválido ou que inverte a Regra A
 */
export async function setCondoDeliverySlots(
  prisma: PrismaClient,
  condominiumId: string,
  patches: CondoSlotPatch[],
): Promise<CondoDeliverySlot[]> {
  const [condo, global] = await Promise.all([
    prisma.condominium.findUnique({
      where: { id: condominiumId },
      select: { deliverySlots: true },
    }),
    getGlobalDeliverySlots(prisma),
  ])
  if (!condo) throw { statusCode: 404, message: 'Condomínio não encontrado' }

  const globalById = new Map(global.map((s) => [s.slotId, s]))
  const byId = new Map(patches.map((p) => [p.slotId, p]))

  const unknown = patches.find((p) => !globalById.has(p.slotId))
  if (unknown) {
    throw { statusCode: 422, message: `Turno desconhecido: ${unknown.slotId}` }
  }

  // Valida ANTES de escrever qualquer coisa (nada de gravação parcial).
  for (const p of patches) {
    if (p.time == null) continue
    const g = globalById.get(p.slotId)!
    const err = validateCondoSlotTime(g, p.time)
    if (err) throw { statusCode: 422, message: err }
  }

  const merged = (condo.deliverySlots as RawSlot[]).map((cs) => {
    const normalized = normalizeCondoSlot(cs)
    const g = globalById.get(normalized.slotId)
    const p = byId.get(normalized.slotId)
    if (!g) return cs

    // Sempre realinha o que é global; o patch decide time/isActive.
    let time = normalized.timeCustom ? normalized.time : g.time
    let timeCustom = normalized.timeCustom
    let isActive = normalized.activeCustom ? normalized.isActive : g.isActive
    let activeCustom = normalized.activeCustom

    if (p && p.time !== undefined) {
      if (p.time === null) {
        time = g.time
        timeCustom = false
      } else {
        time = p.time
        // Personalizar com o MESMO valor do global é herança, não override — evita "congelar"
        // o condomínio num valor que o admin espera que acompanhe o padrão.
        timeCustom = p.time !== g.time
      }
    }
    if (p && p.isActive !== undefined) {
      if (p.isActive === null) {
        isActive = g.isActive
        activeCustom = false
      } else {
        isActive = p.isActive
        activeCustom = p.isActive !== g.isActive
      }
    }

    return {
      slotId: g.slotId,
      name: normalized.name,
      label: g.label,
      emoji: g.emoji,
      time,
      cutoffTime: g.cutoffTime,
      isActive,
      timeCustom,
      activeCustom,
    }
  })

  await prisma.condominium.update({
    where: { id: condominiumId },
    data: { deliverySlots: merged },
  })

  return merged.map((s) => normalizeCondoSlot(s as RawSlot))
}
