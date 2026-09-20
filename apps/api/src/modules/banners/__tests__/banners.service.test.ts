// BannersService unit tests — o que o cliente vê e o registro do que ele fez.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { BannersService } from '../banners.service.js'

const brt = (dateStr: string, hhmm: string): Date => {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h + 3, m, 0, 0))
}

const AGORA = brt('2026-09-20', '10:00')
const USER = '1'.repeat(24)
const BANNER = '2'.repeat(24)
const CONDO_A = 'a'.repeat(24)
const CONDO_B = 'b'.repeat(24)

const gravado = (over: Record<string, unknown> = {}) => ({
  id: BANNER,
  name: 'Peça',
  placement: 'POPUP',
  imageUrl: 'https://cdn.exemplo.com/banners/x.jpg',
  alt: 'Arte',
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
    views?: Array<Record<string, unknown>>
    condominiumId?: string | null
    upsertFails?: boolean
  } = {},
) {
  const { banners = [], views = [], condominiumId = CONDO_A, upsertFails = false } = opts

  const upsert = upsertFails
    ? vi.fn().mockRejectedValue(new Error('mongo caiu'))
    : vi.fn().mockResolvedValue({})
  const warn = vi.fn()

  const prisma = {
    banner: { findMany: vi.fn().mockResolvedValue(banners) },
    bannerView: { findMany: vi.fn().mockResolvedValue(views), upsert },
    user: { findUnique: vi.fn().mockResolvedValue({ condominiumId }) },
  }

  return {
    fastify: { prisma, log: { error: vi.fn(), warn } } as unknown as FastifyInstance,
    prisma,
    upsert,
    warn,
  }
}

describe('BannersService.forClient', () => {
  it('agrupa por formato', async () => {
    const { fastify } = makeFastify({
      banners: [
        gravado({ id: 'p', placement: 'POPUP' }),
        gravado({ id: 's', placement: 'STRIP', imageUrl: null, title: 'Aviso' }),
        gravado({ id: 'm1', placement: 'MARKET', priority: 2 }),
        gravado({ id: 'm2', placement: 'MARKET', priority: 1 }),
      ],
    })
    const out = await new BannersService(fastify).forClient(USER, AGORA)

    expect(out.popup?.id).toBe('p')
    expect(out.strip?.id).toBe('s')
    expect(out.market.map((b) => b.id)).toEqual(['m1', 'm2'])
  })

  it('devolve null quando não há peça do formato', async () => {
    const { fastify } = makeFastify({ banners: [] })
    const out = await new BannersService(fastify).forClient(USER, AGORA)
    expect(out).toEqual({ popup: null, strip: null, market: [] })
  })

  it('respeita a segmentação por condomínio', async () => {
    const { fastify } = makeFastify({
      banners: [gravado({ id: 'outro', condominiumIds: [CONDO_B] })],
      condominiumId: CONDO_A,
    })
    const out = await new BannersService(fastify).forClient(USER, AGORA)
    expect(out.popup).toBeNull()
  })

  it('não repete o pop-up diário já visto hoje', async () => {
    const { fastify } = makeFastify({
      banners: [gravado()],
      views: [{ bannerId: BANNER, lastSeenAt: brt('2026-09-20', '08:00'), clickedAt: null }],
    })
    const out = await new BannersService(fastify).forClient(USER, AGORA)
    expect(out.popup).toBeNull()
  })

  // O cliente recebe a URL pronta; `actionType` nunca sai do servidor.
  it('entrega a URL resolvida e não vaza o tipo de ação', async () => {
    const { fastify } = makeFastify({
      banners: [gravado({ actionType: 'SCREEN', actionScreen: 'creditos' })],
    })
    const out = await new BannersService(fastify).forClient(USER, AGORA)

    expect(out.popup).toMatchObject({ actionUrl: '/client/creditos', external: false })
    expect(out.popup).not.toHaveProperty('actionType')
    expect(out.popup).not.toHaveProperty('actionScreen')
  })

  it('cadastro de ação inconsistente vira peça sem ação, não destino adivinhado', async () => {
    const { fastify } = makeFastify({
      banners: [gravado({ actionType: 'EXTERNAL', actionUrl: 'http://inseguro.com' })],
    })
    const out = await new BannersService(fastify).forClient(USER, AGORA)
    expect(out.popup?.actionUrl).toBeNull()
  })

  it('cliente sem condomínio ainda recebe as peças de todos', async () => {
    const { fastify } = makeFastify({ banners: [gravado()], condominiumId: null })
    const out = await new BannersService(fastify).forClient(USER, AGORA)
    expect(out.popup?.id).toBe(BANNER)
  })
})

describe('BannersService.track', () => {
  it('seen incrementa a contagem de exibições', async () => {
    const { fastify, upsert } = makeFastify()
    await new BannersService(fastify).track(USER, BANNER, 'seen', AGORA)

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bannerId_userId: { bannerId: BANNER, userId: USER } },
        update: { seenCount: { increment: 1 }, lastSeenAt: AGORA },
      }),
    )
  })

  // A impressão já foi contada quando a peça apareceu; recontar no clique inflaria o denominador
  // do CTR e faria a métrica mentir para baixo.
  it('click NÃO reconta a impressão', async () => {
    const { fastify, upsert } = makeFastify()
    await new BannersService(fastify).track(USER, BANNER, 'click', AGORA)

    expect(upsert.mock.calls[0][0].update).toEqual({ clickedAt: AGORA, lastSeenAt: AGORA })
  })

  it('dismiss marca a dispensa', async () => {
    const { fastify, upsert } = makeFastify()
    await new BannersService(fastify).track(USER, BANNER, 'dismiss', AGORA)

    expect(upsert.mock.calls[0][0].update).toEqual({ dismissedAt: AGORA, lastSeenAt: AGORA })
  })

  it('id inválido não chega ao banco', async () => {
    const { fastify, upsert } = makeFastify()
    await new BannersService(fastify).track(USER, 'não-é-objectid', 'seen', AGORA)
    expect(upsert).not.toHaveBeenCalled()
  })

  // Telemetria não pode derrubar a tela do cliente: a falha vira log, não exceção.
  it('falha de banco é engolida com log', async () => {
    const { fastify, warn } = makeFastify({ upsertFails: true })
    await expect(new BannersService(fastify).track(USER, BANNER, 'seen', AGORA)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })
})
