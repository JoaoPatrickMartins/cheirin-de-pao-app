import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { getPublicLandingInfo } from '../public-landing.service.js'

/** Página Sobre — turnos ativos e Indique e Ganhe (plano-pagina-sobre.md §4.1, D-5/D-6). */

type Slot = { slotId: string; name: string; time: string; cutoffTime: string; isActive: boolean; activeCustom?: boolean }

const manha = (over: Partial<Slot> = {}): Slot => ({ slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true, ...over })
const tarde = (over: Partial<Slot> = {}): Slot => ({ slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true, ...over })

/** Prisma com condomínios ATIVOS (o `where: { isActive: true }` é da query), o padrão global e os Settings da indicação. */
function makePrisma({ condos = [] as Slot[][], global = [manha(), tarde()], referral = {} as Record<string, string> } = {}) {
  const settings: Record<string, string> = { deliverySlots: JSON.stringify(global), ...referral }
  return {
    condominium: {
      findMany: vi.fn().mockResolvedValue(condos.map((deliverySlots, i) => ({ id: `c${i}`, name: `Condo ${i}`, deliverySlots }))),
    },
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(settings[where.key] !== undefined ? { key: where.key, value: settings[where.key] } : null),
      ),
      findMany: vi.fn().mockImplementation(({ where }: { where: { key: { in: string[] } } }) =>
        Promise.resolve(Object.entries(settings).filter(([k]) => where.key.in.includes(k)).map(([key, value]) => ({ key, value }))),
      ),
    },
  } as unknown as PrismaClient
}

const NOW = new Date('2026-10-01T15:00:00.000Z')

describe('getPublicLandingInfo — turnos', () => {
  it('manhã e tarde ativas no padrão e herdadas → as duas', async () => {
    const info = await getPublicLandingInfo(makePrisma({ condos: [[manha(), tarde()]] }), NOW)
    expect(info.shifts).toEqual({ manha: true, tarde: true })
  })

  it('tarde desligada no padrão global (herdada pelos condomínios) → só manhã', async () => {
    const prisma = makePrisma({ condos: [[manha(), tarde()]], global: [manha(), tarde({ isActive: false })] })
    expect((await getPublicLandingInfo(prisma, NOW)).shifts).toEqual({ manha: true, tarde: false })
  })

  it('manhã desligada no padrão → só tarde', async () => {
    const prisma = makePrisma({ condos: [[manha(), tarde()]], global: [manha({ isActive: false }), tarde()] })
    expect((await getPublicLandingInfo(prisma, NOW)).shifts).toEqual({ manha: false, tarde: true })
  })

  it('tarde desligada no padrão, mas ligada por personalização em UM condomínio → conta como ativa', async () => {
    const prisma = makePrisma({
      condos: [[manha(), tarde()], [manha(), tarde({ isActive: true, activeCustom: true })]],
      global: [manha(), tarde({ isActive: false })],
    })
    expect((await getPublicLandingInfo(prisma, NOW)).shifts).toEqual({ manha: true, tarde: true })
  })

  it('tarde desligada por personalização em todos os condomínios → só manhã, mesmo ligada no padrão', async () => {
    const off = tarde({ isActive: false, activeCustom: true })
    const prisma = makePrisma({ condos: [[manha(), off], [manha(), off]] })
    expect((await getPublicLandingInfo(prisma, NOW)).shifts).toEqual({ manha: true, tarde: false })
  })

  it('só os condomínios ATIVOS entram na conta (a query filtra isActive)', async () => {
    const prisma = makePrisma({ condos: [[manha()]] })
    await getPublicLandingInfo(prisma, NOW)
    expect(prisma.condominium.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }))
  })

  it('nenhum condomínio ativo → vale o padrão global', async () => {
    const prisma = makePrisma({ condos: [], global: [manha({ isActive: false }), tarde()] })
    expect((await getPublicLandingInfo(prisma, NOW)).shifts).toEqual({ manha: false, tarde: true })
  })

  it('sem config global gravada → padrão do código (manhã e tarde)', async () => {
    const prisma = makePrisma({ condos: [] })
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(null)
    expect((await getPublicLandingInfo(prisma, NOW)).shifts).toEqual({ manha: true, tarde: true })
  })
})

describe('getPublicLandingInfo — Indique e Ganhe', () => {
  it('desligado (padrão) → só { active: false }, sem valores', async () => {
    const info = await getPublicLandingInfo(makePrisma({ condos: [[manha()]] }), NOW)
    expect(info.referral).toEqual({ active: false })
  })

  it('ligado com bônus do amigo → reward e friendBonus', async () => {
    const referral = { indicacaoAtiva: 'true', indicacaoRecompensa: '5', indicacaoBonusIndicado: '2' }
    const info = await getPublicLandingInfo(makePrisma({ condos: [[manha()]], referral }), NOW)
    expect(info.referral).toEqual({ active: true, reward: 5, friendBonus: 2 })
  })

  it('ligado sem bônus do amigo → friendBonus 0', async () => {
    const referral = { indicacaoAtiva: 'true', indicacaoRecompensa: '5', indicacaoBonusIndicado: '0' }
    const info = await getPublicLandingInfo(makePrisma({ condos: [[manha()]], referral }), NOW)
    expect(info.referral).toEqual({ active: true, reward: 5, friendBonus: 0 })
  })

  it('campanha em dobro valendo hoje → a recompensa já sai multiplicada', async () => {
    const referral = {
      indicacaoAtiva: 'true',
      indicacaoRecompensa: '5',
      indicacaoCampanha: JSON.stringify({ rotulo: 'Semana em dobro', multiplicador: 2, inicio: '2026-09-28', fim: '2026-10-04' }),
    }
    const info = await getPublicLandingInfo(makePrisma({ condos: [[manha()]], referral }), NOW)
    expect(info.referral).toEqual({ active: true, reward: 10, friendBonus: 0 })
  })

  it('a resposta nunca traz horário nem nome de condomínio', async () => {
    const referral = { indicacaoAtiva: 'true', indicacaoRecompensa: '5' }
    const info = await getPublicLandingInfo(makePrisma({ condos: [[manha(), tarde()]], referral }), NOW)
    const raw = JSON.stringify(info)
    expect(raw).not.toMatch(/\d{2}:\d{2}/)
    expect(raw).not.toMatch(/Condo/)
  })
})
