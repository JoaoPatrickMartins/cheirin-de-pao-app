import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { DEFAULT_REFERRAL_MESSAGE } from '@cheirin-de-pao/shared'
import {
  REFERRAL_DEFAULTS,
  activeCampaign,
  currentRewardBreads,
  getReferralConfig,
} from '../referral-config.js'
import { seedReferralDefaults } from '../../bootstrap/defaults-seed.js'

/** Prisma com os Settings dados (chave → valor cru, como está no banco). */
function makePrisma(settings: Record<string, string>) {
  const findMany = vi.fn().mockImplementation(({ where }: { where: { key: { in: string[] } } }) =>
    Promise.resolve(
      Object.entries(settings)
        .filter(([key]) => where.key.in.includes(key))
        .map(([key, value]) => ({ key, value })),
    ),
  )
  return { setting: { findMany } } as unknown as PrismaClient
}

/** Meio-dia BRT de um dia "YYYY-MM-DD". */
const brtNoon = (day: string) => new Date(`${day}T15:00:00.000Z`)

const campaign = { rotulo: 'Semana em dobro', multiplicador: 2, inicio: '2026-10-05', fim: '2026-10-11' }

describe('referral-config', () => {
  describe('getReferralConfig', () => {
    it('sem nenhum Setting → padrões (programa desligado)', async () => {
      await expect(getReferralConfig(makePrisma({}))).resolves.toEqual(REFERRAL_DEFAULTS)
      expect(REFERRAL_DEFAULTS).toMatchObject({
        ativa: false,
        recompensa: 5,
        bonusIndicado: 0,
        compraMinima: 0,
        limiteMensal: 10,
        prazoDias: 60,
        mensagem: DEFAULT_REFERRAL_MESSAGE,
        campanha: null,
        metas: [],
      })
    })

    it('lê os valores válidos', async () => {
      const cfg = await getReferralConfig(
        makePrisma({
          indicacaoAtiva: 'true',
          indicacaoRecompensa: '8',
          indicacaoBonusIndicado: '3',
          indicacaoCompraMinima: '12.5',
          indicacaoLimiteMensal: '0',
          indicacaoPrazoDias: '0',
          indicacaoMensagem: 'Use o meu código {codigo} no Cheirin!',
          indicacaoCampanha: JSON.stringify(campaign),
          indicacaoMetas: JSON.stringify([{ quantidade: 10, bonus: 25 }, { quantidade: 5, bonus: 10 }]),
        }),
      )
      expect(cfg).toEqual({
        ativa: true,
        recompensa: 8,
        bonusIndicado: 3,
        compraMinima: 12.5,
        limiteMensal: 0,
        prazoDias: 0,
        mensagem: 'Use o meu código {codigo} no Cheirin!',
        campanha: campaign,
        // ordenadas pela quantidade
        metas: [{ quantidade: 5, bonus: 10 }, { quantidade: 10, bonus: 25 }],
      })
    })

    it('valores fora das faixas (D-13) caem no padrão', async () => {
      const cfg = await getReferralConfig(
        makePrisma({
          indicacaoRecompensa: '51',
          indicacaoBonusIndicado: '-1',
          indicacaoCompraMinima: '-5',
          indicacaoLimiteMensal: '100',
          indicacaoPrazoDias: '181',
        }),
      )
      expect(cfg).toMatchObject({ recompensa: 5, bonusIndicado: 0, compraMinima: 0, limiteMensal: 10, prazoDias: 60 })
    })

    it('lixo, fração e string vazia caem no padrão', async () => {
      const cfg = await getReferralConfig(
        makePrisma({
          indicacaoRecompensa: '',
          indicacaoBonusIndicado: '2.5',
          indicacaoCompraMinima: 'abc',
          indicacaoLimiteMensal: 'dez',
          indicacaoPrazoDias: ' ',
        }),
      )
      expect(cfg).toMatchObject({ recompensa: 5, bonusIndicado: 0, compraMinima: 0, limiteMensal: 10, prazoDias: 60 })
    })

    it('só "true" liga — e nunca com recompensa 0', async () => {
      expect((await getReferralConfig(makePrisma({ indicacaoAtiva: 'TRUE' }))).ativa).toBe(false)
      expect((await getReferralConfig(makePrisma({ indicacaoAtiva: '1' }))).ativa).toBe(false)
      expect((await getReferralConfig(makePrisma({ indicacaoAtiva: 'true' }))).ativa).toBe(true)
      expect(
        (await getReferralConfig(makePrisma({ indicacaoAtiva: 'true', indicacaoRecompensa: '0' }))).ativa,
      ).toBe(false)
    })

    it('mensagem sem {codigo}/{link} ou fora de 20..500 → mensagem padrão', async () => {
      const semVar = await getReferralConfig(makePrisma({ indicacaoMensagem: 'Oi {nome}, venha para o Cheirin de Pão!' }))
      expect(semVar.mensagem).toBe(DEFAULT_REFERRAL_MESSAGE)
      const curta = await getReferralConfig(makePrisma({ indicacaoMensagem: '{codigo}' }))
      expect(curta.mensagem).toBe(DEFAULT_REFERRAL_MESSAGE)
      const longa = await getReferralConfig(makePrisma({ indicacaoMensagem: `{codigo} ${'a'.repeat(500)}` }))
      expect(longa.mensagem).toBe(DEFAULT_REFERRAL_MESSAGE)
    })

    it('campanha: JSON quebrado, "null" ou fora das regras → sem campanha', async () => {
      for (const raw of ['{quebrado', 'null', JSON.stringify({ ...campaign, multiplicador: 7 }), JSON.stringify({ ...campaign, fim: '2026-10-01' })]) {
        expect((await getReferralConfig(makePrisma({ indicacaoCampanha: raw }))).campanha).toBeNull()
      }
    })

    it('metas: JSON quebrado → []; item inválido é descartado sem apagar os outros', async () => {
      expect((await getReferralConfig(makePrisma({ indicacaoMetas: '[{' }))).metas).toEqual([])
      expect((await getReferralConfig(makePrisma({ indicacaoMetas: '{"quantidade":5}' }))).metas).toEqual([])
      const cfg = await getReferralConfig(
        makePrisma({
          indicacaoMetas: JSON.stringify([
            { quantidade: 5, bonus: 10 },
            { quantidade: 0, bonus: 10 }, // quantidade fora da faixa
            { quantidade: 8, bonus: 99 }, // bônus fora da faixa
            { quantidade: 5, bonus: 20 }, // repetida — fica a primeira
            { quantidade: 3, bonus: 2 },
          ]),
        }),
      )
      expect(cfg.metas).toEqual([{ quantidade: 3, bonus: 2 }, { quantidade: 5, bonus: 10 }])
    })

    it('metas: corta em 5', async () => {
      const seis = [1, 2, 3, 4, 5, 6].map((q) => ({ quantidade: q, bonus: 1 }))
      const cfg = await getReferralConfig(makePrisma({ indicacaoMetas: JSON.stringify(seis) }))
      expect(cfg.metas.map((m) => m.quantidade)).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('campanha', () => {
    const cfg = { ...REFERRAL_DEFAULTS, recompensa: 5, campanha: campaign }

    it('vale nos dias BRT de início e fim, inclusive', () => {
      expect(activeCampaign(cfg, brtNoon('2026-10-05'))).toEqual(campaign)
      expect(activeCampaign(cfg, brtNoon('2026-10-11'))).toEqual(campaign)
      // 23:30 BRT do dia 11 ainda é dia 11 (02:30 UTC do dia 12)
      expect(activeCampaign(cfg, new Date('2026-10-12T02:30:00.000Z'))).toEqual(campaign)
    })

    it('fora da janela não vale', () => {
      expect(activeCampaign(cfg, brtNoon('2026-10-04'))).toBeNull()
      expect(activeCampaign(cfg, brtNoon('2026-10-12'))).toBeNull()
      expect(activeCampaign({ ...cfg, campanha: null }, brtNoon('2026-10-06'))).toBeNull()
    })

    it('currentRewardBreads = X × multiplicador só dentro da janela', () => {
      expect(currentRewardBreads(cfg, brtNoon('2026-10-06'))).toBe(10)
      expect(currentRewardBreads(cfg, brtNoon('2026-10-20'))).toBe(5)
    })
  })

  describe('seedReferralDefaults', () => {
    it('semeia só o que falta e a semente lida de volta dá os padrões', async () => {
      const stored: Record<string, string> = {}
      const upsert = vi.fn().mockImplementation(({ where, create }: { where: { key: string }; create: { value: string } }) => {
        stored[where.key] ??= create.value
        return Promise.resolve({})
      })
      await seedReferralDefaults({ setting: { upsert } } as unknown as PrismaClient)

      expect(upsert).toHaveBeenCalledTimes(9)
      for (const call of upsert.mock.calls) expect(call[0].update).toEqual({}) // nunca sobrescreve
      expect(stored).toMatchObject({ indicacaoAtiva: 'false', indicacaoCampanha: 'null', indicacaoMetas: '[]' })
      await expect(getReferralConfig(makePrisma(stored))).resolves.toEqual(REFERRAL_DEFAULTS)
    })
  })
})
