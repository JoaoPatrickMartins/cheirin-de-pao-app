// ClientHookService unit tests — gancho de porta pelo cliente (coleção HookRequest).
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ClientHookService } from '../client-hook.service.js'

interface LatestHook {
  id: string
  type: 'FREE' | 'PAID' | 'BONUS'
  status: 'PENDING_PAYMENT' | 'REQUESTED' | 'DELIVERED' | 'CANCELLED'
  reason: string | null
  requestedAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
}

function makeFastify(
  opts: {
    user?: { role?: string; name?: string; apartment?: string | null; block?: string | null } | null
    comboPurchases?: number
    bigSingleOrders?: number
    /** R3 — Cestinhas confirmadas cujo totalValue atinge o limiar. */
    bigCestinhas?: number
    /** R4a — pedidos únicos entregues a partir do marco. */
    deliveredSingles?: number
    /** R4b — Cestinhas entregues a partir do marco. */
    deliveredCestinhas?: number
    totalHooks?: number
    openHooks?: number
    latestHook?: LatestHook | null
    existingHook?: { id: string; status: string; type: string } | null
    pedidoUnicoMin?: number
    preco?: number
    /** Preço do pão avulso; `null` = Setting ausente (R3 desativada). */
    avulsoUnit?: number | null
    recorrenciaMin?: number
    /** Marco de vigência da fidelidade; `null` = regra nunca ligada. */
    recorrenciaDesde?: string | null
  } = {},
) {
  const {
    user = { role: 'CLIENT', name: 'Ana', apartment: '10', block: null },
    comboPurchases = 0,
    bigSingleOrders = 0,
    bigCestinhas = 0,
    deliveredSingles = 0,
    deliveredCestinhas = 0,
    totalHooks = 0,
    openHooks = 0,
    latestHook = null,
    existingHook = null,
    pedidoUnicoMin = 10,
    preco = 5,
    avulsoUnit = 1.2,
    recorrenciaMin = 0,
    recorrenciaDesde = null,
  } = opts

  const hookCreate = vi.fn().mockResolvedValue({ id: 'h1', status: 'REQUESTED', type: 'FREE' })
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findMany: vi.fn().mockResolvedValue([]), // admins (notifyAdmins)
    },
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === 'ganchoPedidoUnicoMin') return Promise.resolve({ value: String(pedidoUnicoMin) })
        if (where.key === 'ganchoPreco') return Promise.resolve({ value: String(preco) })
        if (where.key === 'ganchoRecorrenciaMin') return Promise.resolve({ value: String(recorrenciaMin) })
        if (where.key === 'ganchoRecorrenciaDesde')
          return Promise.resolve(recorrenciaDesde ? { value: recorrenciaDesde } : null)
        if (where.key === 'avulsoUnit')
          return Promise.resolve(avulsoUnit === null ? null : { value: String(avulsoUnit) })
        return Promise.resolve(null)
      }),
    },
    payment: { count: vi.fn().mockResolvedValue(comboPurchases) },
    // R2 filtra por quantity; R4a filtra por deliveredAt — é o que separa as duas contagens.
    order: {
      count: vi
        .fn()
        .mockImplementation(({ where }: { where: { deliveredAt?: unknown } }) =>
          Promise.resolve(where?.deliveredAt ? deliveredSingles : bigSingleOrders),
        ),
    },
    // R3 filtra por totalValue; R4b filtra por deliveredAt.
    marketOrder: {
      count: vi
        .fn()
        .mockImplementation(({ where }: { where: { deliveredAt?: unknown } }) =>
          Promise.resolve(where?.deliveredAt ? deliveredCestinhas : bigCestinhas),
        ),
    },
    hookRequest: {
      // getStatus: 1ª chamada = total (where { userId }); 2ª = abertos (where tem status)
      count: vi
        .fn()
        .mockImplementation(({ where }: { where: { status?: unknown } }) =>
          Promise.resolve(where?.status ? openHooks : totalHooks),
        ),
      // getStatus usa findFirst para o "latest"; requestHook usa para o "existing"
      findFirst: vi.fn().mockResolvedValue(existingHook ?? latestHook),
      create: hookCreate,
    },
    notification: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  }
  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown as FastifyInstance,
    prisma,
    hookCreate,
  }
}

describe('ClientHookService.getStatus', () => {
  it('needsConsent=true quando comprou combo e não tem gancho', async () => {
    const { fastify } = makeFastify({ comboPurchases: 1, totalHooks: 0 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.freeEligible).toBe(true)
    expect(res.hasHook).toBe(false)
    expect(res.needsConsent).toBe(true)
    expect(res.canRequestPaid).toBe(false)
  })

  it('needsConsent=true quando fez pedido único >= mínimo', async () => {
    const { fastify } = makeFastify({ comboPurchases: 0, bigSingleOrders: 1, totalHooks: 0 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.freeEligible).toBe(true)
    expect(res.needsConsent).toBe(true)
  })

  it('needsConsent=false quando não atende ao critério', async () => {
    const { fastify } = makeFastify({ comboPurchases: 0, bigSingleOrders: 0, totalHooks: 0 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.freeEligible).toBe(false)
    expect(res.needsConsent).toBe(false)
  })

  it('needsConsent=false e canRequestPaid=true quando já tem gancho entregue', async () => {
    const { fastify } = makeFastify({
      comboPurchases: 1,
      totalHooks: 1,
      openHooks: 0,
      latestHook: {
        id: 'h1',
        type: 'FREE',
        status: 'DELIVERED',
        reason: null,
        requestedAt: new Date('2026-07-01'),
        deliveredAt: new Date('2026-07-03'),
        createdAt: new Date('2026-07-01'),
      },
    })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.hasHook).toBe(true)
    expect(res.needsConsent).toBe(false)
    expect(res.canRequestPaid).toBe(true)
  })

  it('canRequestPaid=false quando há gancho em andamento', async () => {
    const { fastify } = makeFastify({ totalHooks: 1, openHooks: 1 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.canRequestPaid).toBe(false)
  })

  it('lança 404 quando o usuário não é CLIENT', async () => {
    const { fastify } = makeFastify({ user: { role: 'ADMIN' } })
    await expect(new ClientHookService(fastify).getStatus('u1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ClientHookService.getStatus — regra da Cestinha (R3)', () => {
  /** A chamada de marketOrder.count que corresponde a R3 (a que filtra por totalValue). */
  function cestinhaCall(prisma: { marketOrder: { count: { mock: { calls: unknown[][] } } } }) {
    return prisma.marketOrder.count.mock.calls
      .map((c) => c[0] as { where?: { totalValue?: { gte: number }; status?: unknown } })
      .find((arg) => arg?.where?.totalValue !== undefined)
  }

  it('needsConsent=true quando uma Cestinha atinge o valor equivalente ao mínimo de pães', async () => {
    const { fastify } = makeFastify({ bigCestinhas: 1, totalHooks: 0 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.freeEligible).toBe(true)
    expect(res.needsConsent).toBe(true)
  })

  it('needsConsent=false quando nenhuma Cestinha atinge o limiar', async () => {
    const { fastify } = makeFastify({ bigCestinhas: 0, totalHooks: 0 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.freeEligible).toBe(false)
  })

  it('converte o mínimo de pães em reais (10 × R$ 1,20 = R$ 12,00) com tolerância de float', async () => {
    const { fastify, prisma } = makeFastify({ pedidoUnicoMin: 10, avulsoUnit: 1.2 })
    const res = await new ClientHookService(fastify).getStatus('u1')

    expect(res.cestinhaMinValue).toBe(12)
    // meio centavo abaixo: totalValue é Float e 12,00 pode estar gravado como 11,999999…
    expect(cestinhaCall(prisma)?.where?.totalValue).toEqual({ gte: 11.995 })
  })

  it('ignora Cestinha cancelada ou aguardando pagamento', async () => {
    const { fastify, prisma } = makeFastify({})
    await new ClientHookService(fastify).getStatus('u1')

    expect(cestinhaCall(prisma)?.where?.status).toEqual({ notIn: ['CANCELLED', 'PENDING_PAYMENT'] })
  })

  it('sem preço avulso configurado, a regra da Cestinha não roda (não libera o gancho)', async () => {
    const { fastify, prisma } = makeFastify({ avulsoUnit: null, bigCestinhas: 3 })
    const res = await new ClientHookService(fastify).getStatus('u1')

    expect(res.freeEligible).toBe(false)
    expect(res.cestinhaMinValue).toBe(0)
    expect(cestinhaCall(prisma)).toBeUndefined()
  })
})

describe('ClientHookService.getStatus — regra da fidelidade (R4)', () => {
  const MARCO = '2026-08-01T00:00:00.000Z'

  it('não roda nem conta progresso quando a regra está desligada (0)', async () => {
    const { fastify, prisma } = makeFastify({ recorrenciaMin: 0, deliveredSingles: 9 })
    const res = await new ClientHookService(fastify).getStatus('u1')

    expect(res.recorrenciaMin).toBe(0)
    expect(res.recorrenciaProgress).toBe(0)
    expect(res.freeEligible).toBe(false)
    // só a contagem de R2 rodou — nenhuma query de entregas
    expect(prisma.order.count).toHaveBeenCalledTimes(1)
  })

  it('concede o gancho ao atingir o número de pedidos entregues (avulso + Cestinha)', async () => {
    const { fastify } = makeFastify({
      recorrenciaMin: 5,
      recorrenciaDesde: MARCO,
      deliveredSingles: 3,
      deliveredCestinhas: 2,
    })
    const res = await new ClientHookService(fastify).getStatus('u1')

    expect(res.recorrenciaProgress).toBe(5)
    expect(res.freeEligible).toBe(true)
    expect(res.needsConsent).toBe(true)
  })

  it('um pedido antes do alvo ainda não concede — mas o progresso aparece', async () => {
    const { fastify } = makeFastify({
      recorrenciaMin: 5,
      recorrenciaDesde: MARCO,
      deliveredSingles: 4,
    })
    const res = await new ClientHookService(fastify).getStatus('u1')

    expect(res.recorrenciaProgress).toBe(4)
    expect(res.freeEligible).toBe(false)
  })

  it('conta apenas entregas a partir do marco de vigência', async () => {
    const { fastify, prisma } = makeFastify({ recorrenciaMin: 5, recorrenciaDesde: MARCO })
    await new ClientHookService(fastify).getStatus('u1')

    const args = prisma.order.count.mock.calls
      .map((c) => c[0] as { where?: { deliveredAt?: { gte: Date }; status?: unknown } })
      .find((a) => a?.where?.deliveredAt !== undefined)
    expect(args?.where?.status).toBe('DELIVERED')
    expect(args?.where?.deliveredAt?.gte).toEqual(new Date(MARCO))
  })

  it('sem marco gravado a regra não vale (nunca retroage a pedidos antigos)', async () => {
    const { fastify } = makeFastify({
      recorrenciaMin: 5,
      recorrenciaDesde: null,
      deliveredSingles: 30,
    })
    const res = await new ClientHookService(fastify).getStatus('u1')

    expect(res.recorrenciaProgress).toBe(0)
    expect(res.freeEligible).toBe(false)
  })
})

describe('ClientHookService.getStatus — o grátis é uma vez só', () => {
  const BONUS_DO_ADMIN: LatestHook = {
    id: 'h-bonus',
    type: 'BONUS',
    status: 'DELIVERED',
    reason: 'cortesia',
    requestedAt: new Date('2026-07-01'),
    deliveredAt: new Date('2026-07-02'),
    createdAt: new Date('2026-07-01'),
  }

  it('gancho de cortesia do admin encerra o direito ao grátis por qualquer regra', async () => {
    const { fastify, prisma } = makeFastify({
      totalHooks: 1,
      latestHook: BONUS_DO_ADMIN,
      // satisfaz TODAS as regras — e ainda assim não tem direito a outro grátis
      comboPurchases: 2,
      bigSingleOrders: 2,
      bigCestinhas: 2,
      recorrenciaMin: 5,
      recorrenciaDesde: '2026-08-01T00:00:00.000Z',
      deliveredSingles: 9,
    })
    const res = await new ClientHookService(fastify).getStatus('u1')

    expect(res.hasHook).toBe(true)
    expect(res.freeEligible).toBe(false)
    expect(res.needsConsent).toBe(false)
    // curto-circuito: nenhuma query de elegibilidade é disparada para quem já tem gancho
    expect(prisma.payment.count).not.toHaveBeenCalled()
    expect(prisma.order.count).not.toHaveBeenCalled()
    expect(prisma.marketOrder.count).not.toHaveBeenCalled()
  })

  it('requestHook não cria um segundo gancho para quem recebeu a cortesia do admin', async () => {
    const { fastify, hookCreate } = makeFastify({
      existingHook: { id: 'h-bonus', status: 'DELIVERED', type: 'BONUS' },
      bigCestinhas: 5,
      recorrenciaMin: 1,
      recorrenciaDesde: '2026-08-01T00:00:00.000Z',
      deliveredSingles: 9,
    })
    const res = await new ClientHookService(fastify).requestHook('u1')

    expect(hookCreate).not.toHaveBeenCalled()
    expect(res.hookRequestId).toBe('h-bonus')
    expect(res.type).toBe('BONUS')
  })
})

describe('ClientHookService.requestHook (grátis)', () => {
  it('cria um HookRequest FREE quando elegível e sem gancho', async () => {
    const { fastify, hookCreate } = makeFastify({ comboPurchases: 1, existingHook: null })
    const res = await new ClientHookService(fastify).requestHook('u1')
    expect(hookCreate).toHaveBeenCalledOnce()
    expect(hookCreate.mock.calls[0][0].data).toMatchObject({ type: 'FREE', status: 'REQUESTED' })
    expect(res.hookRequestId).toBe('h1')
  })

  it('é idempotente: já tem gancho → devolve o atual sem criar outro', async () => {
    const { fastify, hookCreate } = makeFastify({
      existingHook: { id: 'hX', status: 'DELIVERED', type: 'FREE' },
    })
    const res = await new ClientHookService(fastify).requestHook('u1')
    expect(hookCreate).not.toHaveBeenCalled()
    expect(res.hookRequestId).toBe('hX')
  })

  it('lança 422 quando ainda não atende ao critério do grátis', async () => {
    const { fastify } = makeFastify({ comboPurchases: 0, bigSingleOrders: 0, existingHook: null })
    await expect(new ClientHookService(fastify).requestHook('u1')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('cria o gancho quando a elegibilidade veio só da Cestinha', async () => {
    const { fastify, hookCreate } = makeFastify({ bigCestinhas: 1, existingHook: null })
    await new ClientHookService(fastify).requestHook('u1')
    expect(hookCreate.mock.calls[0][0].data).toMatchObject({ type: 'FREE', status: 'REQUESTED' })
  })

  it('cria o gancho quando a elegibilidade veio só da fidelidade', async () => {
    const { fastify, hookCreate } = makeFastify({
      existingHook: null,
      recorrenciaMin: 3,
      recorrenciaDesde: '2026-08-01T00:00:00.000Z',
      deliveredCestinhas: 3,
    })
    await new ClientHookService(fastify).requestHook('u1')
    expect(hookCreate.mock.calls[0][0].data).toMatchObject({ type: 'FREE', status: 'REQUESTED' })
  })
})

describe('ClientHookService.requestPaidHook (pago)', () => {
  it('lança 422 quando o cliente ainda não tem gancho', async () => {
    const { fastify } = makeFastify({ totalHooks: 0, openHooks: 0 })
    await expect(new ClientHookService(fastify).requestPaidHook('u1', 'defeito')).rejects.toMatchObject({
      statusCode: 422,
    })
  })

  it('lança 422 quando já há um gancho em andamento', async () => {
    const { fastify } = makeFastify({ totalHooks: 1, openHooks: 1 })
    await expect(new ClientHookService(fastify).requestPaidHook('u1', 'perda')).rejects.toMatchObject({
      statusCode: 422,
    })
  })
})
