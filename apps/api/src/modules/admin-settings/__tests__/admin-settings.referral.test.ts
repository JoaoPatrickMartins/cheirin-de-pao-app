import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { DEFAULT_REFERRAL_MESSAGE } from '@cheirin-de-pao/shared'
import { AdminSettingsService } from '../admin-settings.service.js'
import type { UpdateReferralSettingsBody } from '../admin-settings.schema.js'

/**
 * Config do Indique e Ganhe (A3) no service: as regras de negócio do PATCH (422) e o que a
 * leitura devolve. O "banco" é um mapa de Settings em memória — o upsert grava nele e a leitura
 * (`getReferralConfig`) lê dele, então o teste pega uma chave gravada com o nome errado.
 */

vi.mock('@onesignal/node-onesignal', () => ({
  createConfiguration: vi.fn().mockReturnValue({}),
  DefaultApi: vi.fn(),
  Notification: vi.fn(),
}))

function makeService(initial: Record<string, string> = {}, opts: { paid?: number; purchasedMilli?: number } = {}) {
  const store = new Map(Object.entries(initial))
  const upsert = vi.fn(({ where, create, update }: { where: { key: string }; create: { value: string }; update: { value: string } }) => {
    store.set(where.key, store.has(where.key) ? update.value : create.value)
    return Promise.resolve({ key: where.key, value: store.get(where.key) })
  })
  const prisma = {
    setting: {
      findMany: vi.fn(({ where }: { where: { key: { in: string[] } } }) =>
        Promise.resolve(where.key.in.filter((k) => store.has(k)).map((k) => ({ key: k, value: store.get(k)! }))),
      ),
      findUnique: vi.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(store.has(where.key) ? { key: where.key, value: store.get(where.key)! } : null),
      ),
      upsert,
    },
    payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: opts.paid ?? null } }) },
    creditTransaction: { aggregate: vi.fn().mockResolvedValue({ _sum: { quantityMilli: opts.purchasedMilli ?? null } }) },
    $transaction: vi.fn((ops: Array<Promise<unknown>>) => Promise.all(ops)),
  }
  const fastify = { prisma, log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as unknown as FastifyInstance
  return { service: new AdminSettingsService(fastify), store, prisma }
}

const body = (over: Partial<UpdateReferralSettingsBody> = {}): UpdateReferralSettingsBody => ({
  ativa: true,
  recompensa: 5,
  bonusIndicado: 3,
  compraMinima: 0,
  limiteMensal: 10,
  prazoDias: 60,
  mensagem: DEFAULT_REFERRAL_MESSAGE,
  campanha: null,
  metas: [],
  ...over,
})

// 29/09/2026 12:00 BRT
const NOW = new Date('2026-09-29T15:00:00.000Z')

describe('AdminSettingsService — Indique e Ganhe (A3)', () => {
  it('getReferralSettings: padrões + unitPrice do preço médio pago + today', async () => {
    const { service } = makeService({}, { paid: 60, purchasedMilli: 50_000 })
    const res = await service.getReferralSettings()
    expect(res).toMatchObject({ ativa: false, recompensa: 5, bonusIndicado: 0, metas: [], campanha: null })
    expect(res.unitPrice).toBeCloseTo(1.2)
    expect(res.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('getReferralSettings: sem vendas, o "≈ R$" cai no preço avulso', async () => {
    const { service } = makeService({ avulsoUnit: '1.5' })
    expect((await service.getReferralSettings()).unitPrice).toBe(1.5)
  })

  it('não liga o programa com recompensa 0 (422)', async () => {
    const { service, prisma } = makeService()
    await expect(service.setReferralSettings(body({ recompensa: 0 }), NOW)).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('recompensa maior que 0'),
    })
    expect(prisma.setting.upsert).not.toHaveBeenCalled()
  })

  it('recompensa 0 com o programa desligado é aceita', async () => {
    const { service } = makeService()
    const saved = await service.setReferralSettings(body({ ativa: false, recompensa: 0 }), NOW)
    expect(saved).toMatchObject({ ativa: false, recompensa: 0 })
  })

  it('mensagem sem {codigo} nem {link} → 422', async () => {
    const { service } = makeService()
    await expect(
      service.setReferralSettings(body({ mensagem: 'Cadastra e ganha {bonus} pãezins no primeiro pedido!' }), NOW),
    ).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('{codigo} ou {link}') })
  })

  it('campanha nova terminando antes de hoje → 422', async () => {
    const { service } = makeService()
    const campanha = { rotulo: 'Semana em dobro', multiplicador: 2, inicio: '2026-09-20', fim: '2026-09-28' }
    await expect(service.setReferralSettings(body({ campanha }), NOW)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('campanha já gravada e vencida não barra salvar o resto', async () => {
    const campanha = { rotulo: 'Semana em dobro', multiplicador: 2, inicio: '2026-09-20', fim: '2026-09-28' }
    const { service } = makeService({ indicacaoCampanha: JSON.stringify(campanha) })
    const saved = await service.setReferralSettings(body({ campanha, recompensa: 7 }), NOW)
    expect(saved.recompensa).toBe(7)
    expect(saved.campanha).toEqual(campanha)
  })

  it('grava as 9 chaves indicacao* e devolve o que a leitura enxerga (metas em ordem)', async () => {
    const { service, store } = makeService()
    const campanha = { rotulo: 'Semana em dobro', multiplicador: 3, inicio: '2026-10-05', fim: '2026-10-11' }
    const saved = await service.setReferralSettings(
      body({
        compraMinima: 12.5,
        campanha,
        metas: [
          { quantidade: 10, bonus: 25 },
          { quantidade: 5, bonus: 10 },
        ],
      }),
      NOW,
    )
    expect([...store.keys()].filter((k) => k.startsWith('indicacao')).sort()).toEqual(
      [
        'indicacaoAtiva',
        'indicacaoBonusIndicado',
        'indicacaoCampanha',
        'indicacaoCompraMinima',
        'indicacaoLimiteMensal',
        'indicacaoMensagem',
        'indicacaoMetas',
        'indicacaoPrazoDias',
        'indicacaoRecompensa',
      ].sort(),
    )
    expect(store.get('indicacaoAtiva')).toBe('true')
    expect(saved).toMatchObject({ ativa: true, recompensa: 5, bonusIndicado: 3, compraMinima: 12.5, campanha })
    expect(saved.metas).toEqual([
      { quantidade: 5, bonus: 10 },
      { quantidade: 10, bonus: 25 },
    ])
  })

  it('desligar a campanha grava null', async () => {
    const campanha = { rotulo: 'Semana em dobro', multiplicador: 2, inicio: '2026-10-05', fim: '2026-10-11' }
    const { service, store } = makeService({ indicacaoCampanha: JSON.stringify(campanha) })
    const saved = await service.setReferralSettings(body({ campanha: null }), NOW)
    expect(store.get('indicacaoCampanha')).toBe('null')
    expect(saved.campanha).toBeNull()
  })
})
