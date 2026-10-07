// Problemas e ocorrências dos entregadores no admin (Onda 8): lista com a parada, foto assinada,
// "Manter entregue" (KEPT) e "Resolvida" (DONE).
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/storage.js', () => ({
  isStorageConfigured: () => true,
  getSignedReadUrl: vi.fn(async (k: string) => `https://signed/${k}`),
}))

import { AdminCourierReportsService } from '../admin-courier-reports.service.js'

const now = new Date('2026-10-02T09:00:00.000Z')
function db() {
  return {
    courierReport: {
      findMany: vi.fn(async () => [
        { id: 'r1', kind: 'STOP_ISSUE', courierId: 'k1', orderId: 'o1', marketOrderId: null, type: 'CONFIRMEI_POR_ENGANO', text: 'Ficou comigo', photoUrl: null, status: 'OPEN', resolution: null, createdAt: now, resolvedAt: null },
        { id: 'r2', kind: 'INCIDENT', courierId: 'k1', orderId: null, marketOrderId: null, type: 'VEICULO', text: 'Pneu', photoUrl: 'reports/abc.jpg', status: 'OPEN', resolution: null, createdAt: now, resolvedAt: null },
      ]),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, kind: where.id === 'r1' ? 'STOP_ISSUE' : 'INCIDENT', status: 'OPEN', resolution: null })),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 2),
    },
    order: { findMany: vi.fn(async () => [{ id: 'o1', userId: 'u1', status: 'DELIVERED' }]) },
    marketOrder: { findMany: vi.fn(async () => []) },
    user: {
      findMany: vi.fn(async () => [
        { id: 'k1', name: 'Antônio Ribeiro', apartment: null, block: null, condominiumId: null },
        { id: 'u1', name: 'Pedro Alves', apartment: '204', block: '1', condominiumId: 'c1' },
      ]),
    },
    condominium: { findMany: vi.fn(async () => [{ id: 'c1', name: 'Residencial Jardins' }]) },
  }
}
const svc = (p: unknown) => new AdminCourierReportsService({ prisma: p, log: { warn: vi.fn() } } as never)

describe('reportes dos entregadores', () => {
  it('lista o problema com a parada e a ocorrência com a foto assinada', async () => {
    const [issue, incident] = await svc(db()).list()
    expect(issue).toMatchObject({ kind: 'STOP_ISSUE', label: 'Confirmei por engano', courier: { name: 'Antônio Ribeiro' }, stop: { orderId: 'o1', clientName: 'Pedro Alves', place: 'Bloco 1 · Apto 204 · Residencial Jardins', status: 'DELIVERED' } })
    expect(incident).toMatchObject({ kind: 'INCIDENT', label: 'Problema no veículo', photoUrl: 'https://signed/reports/abc.jpg', photoExpired: false, stop: null })
    expect(issue.photoExpired).toBe(false)
  })

  it('foto da ocorrência com mais de 90 dias: expirada, sem URL assinada', async () => {
    const later = new Date(now.getTime() + 91 * 24 * 60 * 60 * 1000)
    const [, incident] = await svc(db()).list('ALL', 50, later)
    expect(incident).toMatchObject({ photoUrl: null, photoExpired: true })
  })

  it('resolver: problema → KEPT (manter entregue); ocorrência → DONE', async () => {
    const prisma = db()
    expect(await svc(prisma).resolve('r1', 'adm1', now)).toEqual({ id: 'r1', status: 'RESOLVED', resolution: 'KEPT' })
    expect(await svc(prisma).resolve('r2', 'adm1', now)).toEqual({ id: 'r2', status: 'RESOLVED', resolution: 'DONE' })
    expect(prisma.courierReport.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'RESOLVED', resolution: 'KEPT', resolvedAt: now, resolvedById: 'adm1' } })
    expect(await svc(prisma).summary()).toEqual({ open: 2 })
  })
})
