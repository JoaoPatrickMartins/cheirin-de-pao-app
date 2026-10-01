import type { PrismaClient } from '@prisma/client'
import { getGlobalDeliverySlots, listActiveCondoSlots } from '../../lib/delivery-slots.js'
import { currentRewardBreads, getReferralConfig } from '../../lib/referral-config.js'

/**
 * O que a página pública /sobre/ ajusta por cima do HTML estático (plano-pagina-sobre.md §4.1).
 * Só booleanos e números: nada de horário nem de nome de condomínio sai daqui.
 */
export interface PublicLandingInfo {
  shifts: { manha: boolean; tarde: boolean }
  referral: { active: false } | { active: true; reward: number; friendBonus: number }
}

/**
 * Um turno conta como ativo quando está ativo (valor efetivo — herdado ou personalizado) em pelo
 * menos UM condomínio ativo (D-5). Sem nenhum par condomínio × turno ativo, vale o padrão global,
 * para a página não ficar sem turno.
 */
async function activeShifts(prisma: PrismaClient): Promise<PublicLandingInfo['shifts']> {
  const occurrences = await listActiveCondoSlots(prisma)
  const names = occurrences.length
    ? occurrences.map((o) => o.slot.name)
    : (await getGlobalDeliverySlots(prisma)).filter((s) => s.isActive).map((s) => s.name)
  return { manha: names.includes('manha'), tarde: names.includes('tarde') }
}

/** Indique e Ganhe só aparece ligado (D-6); a recompensa já com o multiplicador da campanha do dia. */
async function referralInfo(prisma: PrismaClient, now: Date): Promise<PublicLandingInfo['referral']> {
  const config = await getReferralConfig(prisma)
  if (!config.ativa) return { active: false }
  return { active: true, reward: currentRewardBreads(config, now), friendBonus: config.bonusIndicado }
}

export async function getPublicLandingInfo(prisma: PrismaClient, now: Date = new Date()): Promise<PublicLandingInfo> {
  const [shifts, referral] = await Promise.all([activeShifts(prisma), referralInfo(prisma, now)])
  return { shifts, referral }
}
