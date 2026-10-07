// Operação do entregador (Onda 8): recado (E16) bloqueado sem permissão, com opt-out ou repetido;
// problema (E11) e ocorrência (E12) avisam a operação e são idempotentes; sugestão de acesso (E7);
// gancho na rota (A7): entregue ou de volta para a fila.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const notifyUser = vi.hoisted(() => vi.fn())
const notifyAdmins = vi.hoisted(() => vi.fn())
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    notifyUser = notifyUser
    notifyAdmins = notifyAdmins
  },
}))
const markDelivered = vi.hoisted(() => vi.fn())
vi.mock('../../admin-hooks/admin-hooks.service.js', () => ({
  AdminHooksService: class {
    markDelivered = markDelivered
  },
}))

import { CourierOpsService, returnHookToQueue } from '../courier-ops.js'

const now = new Date('2026-10-02T09:00:00.000Z') // 06:00 BRT
const today = new Date('2026-10-02T15:00:00.000Z')

function db(over: { rules?: Record<string, boolean>; optOut?: boolean; order?: Record<string, unknown> | null } = {}) {
  return {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'k1'
          ? { name: 'Antônio Ribeiro', courierRules: { fotoEntrega: true, fotoNaoEntrega: true, podeReordenar: false, podeRecados: true, ...over.rules } }
          : { name: 'Maria Souza', apartment: '204', block: '1', condominiumId: 'c1', courierMessagesOff: over.optOut ?? false },
      ),
    },
    condominium: { findUnique: vi.fn(async () => ({ id: 'c1', name: 'Residencial Jardins' })) },
    order: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string; courierId: string } }) =>
        over.order === null ? null : where.id === 'o1' && where.courierId === 'k1' ? { id: 'o1', userId: 'u1', slotId: 'manha', scheduledDate: today, status: 'OUT_FOR_DELIVERY', ...over.order } : null,
      ),
    },
    marketOrder: { findFirst: vi.fn(async () => null) },
    courierMessage: { create: vi.fn(async ({ data }: { data: object }) => data) },
    courierReport: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: 'r1', createdAt: now, ...data })),
    },
    condoAccessSuggestion: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: 's1', ...data })),
    },
    hookRequest: {
      findUnique: vi.fn(async () => ({ id: 'h1', userId: 'u1', status: 'REQUESTED', routeDate: '2026-10-02', routeSlotId: 'manha', routeCourierId: 'k1' })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  }
}
const svc = (prisma: unknown) => new CourierOpsService({ prisma, log: { warn: vi.fn() } } as never)

beforeEach(() => vi.clearAllMocks())

describe('E16 · recado', () => {
  it('envia o push "Antônio: Estou na portaria 🥖" e grava 1 por modelo/dia', async () => {
    const prisma = db()
    const r = await svc(prisma).sendMessage('k1', { stopKey: 'o1', template: 'NA_PORTARIA' }, now)
    expect(r.sentAt).toBe(now.toISOString())
    expect(prisma.courierMessage.create).toHaveBeenCalledWith({ data: { courierId: 'k1', userId: 'u1', date: '2026-10-02', template: 'NA_PORTARIA', sentAt: now } })
    expect(notifyUser).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'COURIER_MESSAGE', title: 'Antônio: Estou na portaria 🥖', body: 'Recado do seu entregador' }))
  })

  it('sem permissão → 403; cliente desligou → 409 OPT_OUT; repetido → 409 ALREADY; parada de outro → 404', async () => {
    await expect(svc(db({ rules: { podeRecados: false } })).sendMessage('k1', { stopKey: 'o1', template: 'NA_PORTARIA' }, now)).rejects.toMatchObject({ statusCode: 403 })
    await expect(svc(db({ optOut: true })).sendMessage('k1', { stopKey: 'o1', template: 'NA_PORTARIA' }, now)).rejects.toMatchObject({ statusCode: 409, code: 'OPT_OUT' })
    const dup = db()
    dup.courierMessage.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(svc(dup).sendMessage('k1', { stopKey: 'o1', template: 'NA_PORTARIA' }, now)).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY' })
    await expect(svc(db()).sendMessage('k1', { stopKey: 'o9', template: 'NA_PORTARIA' }, now)).rejects.toMatchObject({ statusCode: 404 })
    await expect(svc(db()).sendMessage('k1', { stopKey: 'o1', template: 'TEXTO_LIVRE' }, now)).rejects.toMatchObject({ statusCode: 400 })
    expect(notifyUser).not.toHaveBeenCalled()
  })
})

describe('E11/E12 · problema e ocorrência', () => {
  it('problema numa entrega realizada avisa a operação com o apto e o condomínio', async () => {
    const prisma = db({ order: { status: 'DELIVERED' } })
    const r = await svc(prisma).report('k1', { kind: 'STOP_ISSUE', stopKey: 'o1', type: 'CONFIRMEI_POR_ENGANO', text: 'O saquinho ainda está comigo', clientOpId: 'op-12345678' })
    expect(r.id).toBe('r1')
    expect(prisma.courierReport.create.mock.calls[0][0].data).toMatchObject({ kind: 'STOP_ISSUE', orderId: 'o1', marketOrderId: null, status: 'OPEN', clientOpId: 'op-12345678' })
    expect(notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ADMIN_COURIER_ISSUE', title: 'Problema reportado', body: 'Antônio R.: “Confirmei por engano” · Apto 204 · Bloco 1, Residencial Jardins — O saquinho ainda está comigo' }),
    )
  })

  it('mesmo clientOpId não duplica; entrega ainda pendente → 400; "Outro" sem texto → 400', async () => {
    const again = db({ order: { status: 'DELIVERED' } })
    again.courierReport.findFirst.mockResolvedValueOnce({ id: 'r0', createdAt: now } as never)
    expect(await svc(again).report('k1', { kind: 'STOP_ISSUE', stopKey: 'o1', type: 'CONFIRMEI_POR_ENGANO', clientOpId: 'op-12345678' })).toEqual({ id: 'r0', createdAt: now.toISOString() })
    expect(again.courierReport.create).not.toHaveBeenCalled()
    await expect(svc(db()).report('k1', { kind: 'STOP_ISSUE', stopKey: 'o1', type: 'APTO_ERRADO' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(svc(db({ order: { status: 'DELIVERED' } })).report('k1', { kind: 'STOP_ISSUE', stopKey: 'o1', type: 'OUTRO', text: '' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('ocorrência com foto privada', async () => {
    const prisma = db()
    const key = 'reports/123e4567-e89b-12d3-a456-426614174000.jpg'
    await svc(prisma).report('k1', { kind: 'INCIDENT', type: 'VEICULO', text: 'Pneu furou, ~20 min de atraso', photoKey: key })
    expect(prisma.courierReport.create.mock.calls[0][0].data).toMatchObject({ kind: 'INCIDENT', photoUrl: key, orderId: null })
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADMIN_COURIER_INCIDENT', body: 'Antônio R. · Problema no veículo: Pneu furou, ~20 min de atraso (com foto)' }))
    await expect(svc(db()).report('k1', { kind: 'INCIDENT', type: 'VEICULO', photoKey: 'deliveries/x.jpg' })).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('E7 · sugestão de acesso', () => {
  it('grava e avisa; a mesma pendente não duplica', async () => {
    const prisma = db()
    expect(await svc(prisma).suggestAccess('k1', 'c1', { field: 'PORTAO', text: 'O interfone agora é 9' })).toEqual({ id: 's1' })
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADMIN_CONDO_ACCESS_SUGGESTION', body: 'Residencial Jardins · Portão: “O interfone agora é 9” — Antônio R.' }))
    prisma.condoAccessSuggestion.findFirst.mockResolvedValueOnce({ id: 's0' } as never)
    expect(await svc(prisma).suggestAccess('k1', 'c1', { field: 'PORTAO', text: 'O interfone agora é 9' })).toEqual({ id: 's0' })
    expect(prisma.condoAccessSuggestion.create).toHaveBeenCalledTimes(1)
  })
})

describe('A7 · gancho na rota', () => {
  it('"Sim" registra a entrega pelo entregador', async () => {
    expect(await svc(db()).hookOutcome('k1', 'h1', true, now)).toEqual({ status: 'DELIVERED' })
    expect(markDelivered).toHaveBeenCalledWith('h1', 'k1', 'COURIER')
  })

  it('"Ficou para outro dia" volta para a fila (limpa a rota e marca routeFailedAt)', async () => {
    const prisma = db()
    expect(await svc(prisma).hookOutcome('k1', 'h1', false, now)).toEqual({ status: 'QUEUE' })
    expect(prisma.hookRequest.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'REQUESTED', routeDate: '2026-10-02', routeSlotId: 'manha' },
      data: { routeDate: null, routeSlotId: null, routeCourierId: null, routeFailedAt: now, routeFailedReason: null },
    })
    expect(markDelivered).not.toHaveBeenCalled()
  })

  it('gancho da rota de outro entregador → 404', async () => {
    const prisma = db()
    prisma.hookRequest.findUnique.mockResolvedValueOnce({ id: 'h1', userId: 'u1', status: 'REQUESTED', routeDate: '2026-10-02', routeSlotId: 'manha', routeCourierId: 'k2' } as never)
    await expect(svc(prisma).hookOutcome('k1', 'h1', true, now)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('não entrega da parada devolve o gancho (nunca lança)', async () => {
    const prisma = db()
    expect(await returnHookToQueue(prisma as never, { userId: 'u1', date: '2026-10-02', slotId: 'manha' }, now)).toBe(1)
    prisma.hookRequest.updateMany.mockRejectedValueOnce(new Error('db'))
    expect(await returnHookToQueue(prisma as never, { userId: 'u1', date: '2026-10-02', slotId: 'manha' }, now)).toBe(0)
  })
})
