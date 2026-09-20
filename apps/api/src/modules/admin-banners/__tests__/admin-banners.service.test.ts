// AdminBannersService unit tests — CRUD dos banners, avisos e promoções.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { AdminBannersService } from '../admin-banners.service.js'

/** Date a partir de um horário BRT. */
const brt = (dateStr: string, hhmm: string): Date => {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h + 3, m, 0, 0))
}

const AGORA = brt('2026-09-20', '10:00')

/** Um banner gravado, como o Prisma o devolveria. */
const gravado = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  name: 'Promo da semana',
  placement: 'POPUP',
  imageUrl: 'https://cdn.exemplo.com/banners/x.jpg',
  alt: 'Arte da promoção',
  title: null,
  body: null,
  bgColor: null,
  ctaLabel: 'Peça agora',
  actionType: 'NONE',
  actionScreen: null,
  actionProductId: null,
  actionComboId: null,
  actionUrl: null,
  frequency: 'DAILY',
  startsAt: null,
  endsAt: null,
  isActive: true,
  priority: 0,
  condominiumIds: [],
  createdById: null,
  createdAt: brt('2026-09-01', '10:00'),
  updatedAt: brt('2026-09-01', '10:00'),
  ...over,
})

function makeFastify(
  opts: {
    banners?: Array<Record<string, unknown>>
    banner?: Record<string, unknown> | null
    metrics?: Array<Record<string, unknown>>
  } = {},
) {
  const { banners = [], banner = null, metrics = [] } = opts

  const bannerCreate = vi.fn().mockResolvedValue(gravado())
  const bannerUpdate = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'b1', ...data }))
  const bannerDelete = vi.fn().mockResolvedValue({})
  const viewDeleteMany = vi.fn().mockResolvedValue({ count: 3 })

  const prisma = {
    banner: {
      findMany: vi.fn().mockResolvedValue(banners),
      findUnique: vi.fn().mockResolvedValue(banner),
      create: bannerCreate,
      update: bannerUpdate,
      delete: bannerDelete,
    },
    bannerView: {
      groupBy: vi.fn().mockResolvedValue(metrics),
      deleteMany: viewDeleteMany,
    },
  }

  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown as FastifyInstance,
    prisma,
    bannerCreate,
    bannerUpdate,
    bannerDelete,
    viewDeleteMany,
  }
}

describe('AdminBannersService.list', () => {
  it('deriva o status de cada peça', async () => {
    const { fastify } = makeFastify({
      banners: [
        gravado({ id: 'noAr' }),
        gravado({ id: 'agendado', startsAt: brt('2026-09-25', '00:00') }),
        gravado({ id: 'expirado', endsAt: brt('2026-09-10', '00:00') }),
        gravado({ id: 'pausado', isActive: false }),
      ],
    })
    const out = await new AdminBannersService(fastify).list(AGORA)

    expect(out.map((b) => [b.id, b.status])).toEqual([
      ['noAr', 'live'],
      ['agendado', 'scheduled'],
      ['pausado', 'paused'],
      ['expirado', 'expired'],
    ])
  })

  it('agendados saem na ordem de estreia, não na de prioridade', async () => {
    const { fastify } = makeFastify({
      banners: [
        gravado({ id: 'depois', priority: 9, startsAt: brt('2026-09-28', '00:00') }),
        gravado({ id: 'antes', priority: 1, startsAt: brt('2026-09-22', '00:00') }),
      ],
    })
    const out = await new AdminBannersService(fastify).list(AGORA)
    expect(out.map((b) => b.id)).toEqual(['antes', 'depois'])
  })

  it('junta as métricas e calcula o CTR sobre o ALCANCE', async () => {
    const { fastify } = makeFastify({
      banners: [gravado({ id: 'b1' })],
      metrics: [
        { bannerId: 'b1', _count: { _all: 40, clickedAt: 10, dismissedAt: 7 }, _sum: { seenCount: 120 } },
      ],
    })
    const [b] = await new AdminBannersService(fastify).list(AGORA)

    expect(b.metrics).toEqual({
      reach: 40,
      impressions: 120,
      clicks: 10,
      dismissals: 7,
      ctr: 0.25, // 10 cliques ÷ 40 clientes, e não ÷ 120 exibições
    })
  })

  it('peça sem nenhuma exibição vem zerada, não indefinida', async () => {
    const { fastify } = makeFastify({ banners: [gravado()], metrics: [] })
    const [b] = await new AdminBannersService(fastify).list(AGORA)
    expect(b.metrics).toEqual({ reach: 0, impressions: 0, clicks: 0, dismissals: 0, ctr: 0 })
  })
})

describe('AdminBannersService.update', () => {
  // O motivo de o PATCH validar o objeto MESCLADO: isolado, `{ placement: 'STRIP' }` é um patch
  // perfeitamente válido — e deixaria uma faixa de aviso com a imagem do pop-up gravada.
  it('recusa virar faixa sem tirar a imagem', async () => {
    const { fastify, bannerUpdate } = makeFastify({ banner: gravado() })
    await expect(
      new AdminBannersService(fastify).update('b1', { placement: 'STRIP' }),
    ).rejects.toBeInstanceOf(ZodError)
    expect(bannerUpdate).not.toHaveBeenCalled()
  })

  it('aceita virar faixa quando o patch também limpa a imagem e dá título', async () => {
    const { fastify, bannerUpdate } = makeFastify({ banner: gravado() })
    await new AdminBannersService(fastify).update('b1', {
      placement: 'STRIP',
      imageUrl: null,
      alt: null,
      title: 'Feriado dia 7',
    })
    expect(bannerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'b1' }, data: expect.objectContaining({ placement: 'STRIP' }) }),
    )
  })

  it('recusa link externo http', async () => {
    const { fastify } = makeFastify({ banner: gravado() })
    await expect(
      new AdminBannersService(fastify).update('b1', { actionType: 'EXTERNAL', actionUrl: 'http://x.com' }),
    ).rejects.toBeInstanceOf(ZodError)
  })

  it('404 quando o banner não existe', async () => {
    const { fastify } = makeFastify({ banner: null })
    await expect(new AdminBannersService(fastify).update('sumido', { name: 'x' })).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('AdminBannersService.remove', () => {
  it('apaga o histórico antes da peça', async () => {
    const { fastify, viewDeleteMany, bannerDelete } = makeFastify({ banner: gravado() })
    await new AdminBannersService(fastify).remove('b1')

    expect(viewDeleteMany).toHaveBeenCalledWith({ where: { bannerId: 'b1' } })
    expect(bannerDelete).toHaveBeenCalledWith({ where: { id: 'b1' } })
    expect(viewDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(bannerDelete.mock.invocationCallOrder[0])
  })

  it('404 quando o banner não existe', async () => {
    const { fastify, viewDeleteMany } = makeFastify({ banner: null })
    await expect(new AdminBannersService(fastify).remove('sumido')).rejects.toMatchObject({ statusCode: 404 })
    expect(viewDeleteMany).not.toHaveBeenCalled()
  })
})

describe('AdminBannersService.create', () => {
  it('carimba quem criou', async () => {
    const { fastify, bannerCreate } = makeFastify()
    await new AdminBannersService(fastify).create(
      {
        name: 'Promo',
        placement: 'MARKET',
        imageUrl: 'https://cdn.exemplo.com/banners/y.jpg',
        alt: 'Arte',
        actionType: 'NONE',
        frequency: 'DAILY',
        isActive: true,
        priority: 0,
        condominiumIds: [],
      },
      'admin-1',
    )
    expect(bannerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: 'admin-1' }) }),
    )
  })
})
