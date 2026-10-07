// Foto da entrega vista pelo cliente (C2): só com a função ligada, por 90 dias, só para o dono,
// sempre por URL assinada.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage = vi.hoisted(() => ({ configured: true, getSignedReadUrl: vi.fn(async (key: string) => `https://s3/signed/${key}?X-Amz-Signature=x`) }))
vi.mock('../storage.js', () => ({ isStorageConfigured: () => storage.configured, getSignedReadUrl: storage.getSignedReadUrl }))

import { proofFlags, clientProofPhoto } from '../client-proof.js'

const now = new Date('2026-10-01T12:00:00Z')
const recent = new Date('2026-09-30T08:31:00Z')
const old = new Date('2026-06-01T08:31:00Z')

function prismaWith(opts: { visible?: boolean; proofs?: Array<Record<string, unknown>>; owner?: string } = {}) {
  return {
    setting: { findMany: vi.fn().mockResolvedValue(opts.visible === false ? [{ key: 'fotoClienteVisivel', value: 'false' }] : []) },
    deliveryProof: {
      findMany: vi.fn().mockResolvedValue(opts.proofs ?? []),
      findFirst: vi.fn().mockResolvedValue(opts.proofs?.[0] ?? null),
    },
    order: { findUnique: vi.fn().mockResolvedValue({ userId: opts.owner ?? 'u1' }) },
    marketOrder: { findUnique: vi.fn().mockResolvedValue({ userId: opts.owner ?? 'u1' }) },
  }
}

beforeEach(() => {
  storage.configured = true
  storage.getSignedReadUrl.mockClear()
})

describe('proofFlags', () => {
  it('foto recente → disponível; com mais de 90 dias → expirada', async () => {
    const prisma = prismaWith({ proofs: [{ orderId: 'o1', marketOrderIds: [], photoAt: recent }, { orderId: 'o2', marketOrderIds: ['m2'], photoAt: old }] })
    const { byOrder, byMarketOrder } = await proofFlags(prisma as never, { orderIds: ['o1', 'o2'], marketOrderIds: ['m2'] }, now)
    expect(byOrder.get('o1')).toEqual({ available: true, expired: false })
    expect(byOrder.get('o2')).toEqual({ available: false, expired: true })
    expect(byMarketOrder.get('m2')).toEqual({ available: false, expired: true })
  })

  it('função desligada pelo admin → nada aparece (nem "expirada")', async () => {
    const prisma = prismaWith({ visible: false, proofs: [{ orderId: 'o1', marketOrderIds: [], photoAt: recent }] })
    const { byOrder } = await proofFlags(prisma as never, { orderIds: ['o1'] }, now)
    expect(byOrder.size).toBe(0)
    expect(prisma.deliveryProof.findMany).not.toHaveBeenCalled()
  })
})

describe('clientProofPhoto', () => {
  const proof = { photoKey: 'deliveries/abc.jpg', photoAt: recent, outcome: 'DELIVERED' }

  it('dono + função ligada + dentro de 90 dias → URL assinada', async () => {
    const photo = await clientProofPhoto(prismaWith({ proofs: [proof] }) as never, 'u1', { orderId: 'o1' }, now)
    expect(photo).toEqual({ url: 'https://s3/signed/deliveries/abc.jpg?X-Amz-Signature=x', at: recent.toISOString(), outcome: 'DELIVERED' })
  })

  it('pedido de OUTRO cliente → null (não vaza que existe)', async () => {
    const prisma = prismaWith({ proofs: [proof], owner: 'outro' })
    expect(await clientProofPhoto(prisma as never, 'u1', { orderId: 'o1' }, now)).toBeNull()
    expect(storage.getSignedReadUrl).not.toHaveBeenCalled()
  })

  it('expirada, função desligada ou armazenamento fora → null', async () => {
    expect(await clientProofPhoto(prismaWith({ proofs: [{ ...proof, photoAt: old }] }) as never, 'u1', { orderId: 'o1' }, now)).toBeNull()
    expect(await clientProofPhoto(prismaWith({ visible: false, proofs: [proof] }) as never, 'u1', { orderId: 'o1' }, now)).toBeNull()
    storage.configured = false
    expect(await clientProofPhoto(prismaWith({ proofs: [proof] }) as never, 'u1', { marketOrderId: 'm1' }, now)).toBeNull()
  })
})
