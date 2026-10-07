import type { FastifyInstance } from 'fastify'
import { INCIDENT_LABELS, STOP_ISSUE_LABELS, isProofExpired, type IncidentType, type StopIssueType } from '@cheirin-de-pao/shared'
import { getSignedReadUrl, isStorageConfigured } from '../../lib/storage.js'

/**
 * Problemas e ocorrências dos entregadores (plano do entregador, Onda 8 · E11/E12 no admin).
 * Problema numa entrega: "Marcar não entregue" (H-2, em admin-orders) ou "Manter entregue".
 * Ocorrência: "Resolvida". A foto da ocorrência é privada (URL assinada de 10 min) e, como a da
 * entrega, vale 90 dias (regra de ciclo de vida do bucket para `reports/` + "expirada" aqui).
 */
export interface CourierReportView {
  id: string
  kind: 'STOP_ISSUE' | 'INCIDENT'
  type: string
  label: string
  text: string | null
  photoUrl: string | null
  /** Houve foto, mas passou dos 90 dias. */
  photoExpired: boolean
  status: 'OPEN' | 'RESOLVED'
  resolution: string | null
  createdAt: string
  resolvedAt: string | null
  courier: { id: string; name: string }
  /** Só no problema numa entrega: a parada. */
  stop: { orderId: string | null; marketOrderId: string | null; clientName: string; place: string; status: string | null } | null
}

export class AdminCourierReportsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async list(status: 'OPEN' | 'ALL' = 'OPEN', limit = 50, now: Date = new Date()): Promise<CourierReportView[]> {
    const rows = await this.prisma.courierReport.findMany({
      where: status === 'OPEN' ? { status: 'OPEN' } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    if (rows.length === 0) return []
    const orderIds = rows.map((r) => r.orderId).filter((x): x is string => !!x)
    const marketIds = rows.map((r) => r.marketOrderId).filter((x): x is string => !!x)
    const [orders, markets] = await Promise.all([
      orderIds.length ? this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, userId: true, status: true } }) : [],
      marketIds.length ? this.prisma.marketOrder.findMany({ where: { id: { in: marketIds } }, select: { id: true, userId: true, status: true } }) : [],
    ])
    const userIds = [...new Set([...rows.map((r) => r.courierId), ...orders.map((o) => o.userId), ...markets.map((m) => m.userId)])]
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, apartment: true, block: true, condominiumId: true } })
    const userById = new Map(users.map((u) => [u.id, u]))
    const condoIds = [...new Set(users.map((u) => u.condominiumId).filter((x): x is string => !!x))]
    const condos = condoIds.length ? await this.prisma.condominium.findMany({ where: { id: { in: condoIds } }, select: { id: true, name: true } }) : []
    const condoName = new Map(condos.map((c) => [c.id, c.name]))
    const orderById = new Map(orders.map((o) => [o.id, o]))
    const marketById = new Map(markets.map((m) => [m.id, m]))

    return Promise.all(
      rows.map(async (r) => {
        const ref = (r.orderId && orderById.get(r.orderId)) || (r.marketOrderId && marketById.get(r.marketOrderId)) || null
        const client = ref ? userById.get(ref.userId) : undefined
        let photoUrl: string | null = null
        const photoExpired = !!r.photoUrl && isProofExpired(r.createdAt, now)
        if (r.photoUrl && !photoExpired && isStorageConfigured()) {
          try {
            photoUrl = await getSignedReadUrl(r.photoUrl)
          } catch (err) {
            this.fastify.log.warn({ err, reportId: r.id }, '[courier-reports] falha ao assinar a foto')
          }
        }
        const label =
          r.kind === 'STOP_ISSUE' ? STOP_ISSUE_LABELS[r.type as StopIssueType] ?? r.type : INCIDENT_LABELS[r.type as IncidentType] ?? r.type
        return {
          id: r.id,
          kind: r.kind as CourierReportView['kind'],
          type: r.type,
          label,
          text: r.text ?? null,
          photoUrl,
          photoExpired,
          status: r.status as CourierReportView['status'],
          resolution: r.resolution ?? null,
          createdAt: r.createdAt.toISOString(),
          resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
          courier: { id: r.courierId, name: userById.get(r.courierId)?.name ?? 'Entregador' },
          stop:
            r.kind === 'STOP_ISSUE'
              ? {
                  orderId: r.orderId ?? null,
                  marketOrderId: r.marketOrderId ?? null,
                  clientName: client?.name ?? 'Cliente',
                  place: [
                    client?.block ? `Bloco ${client.block}` : null,
                    client?.apartment ? `Apto ${client.apartment}` : null,
                    client?.condominiumId ? condoName.get(client.condominiumId) : null,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  status: ref?.status ?? null,
                }
              : null,
        }
      }),
    )
  }

  async summary(): Promise<{ open: number }> {
    return { open: await this.prisma.courierReport.count({ where: { status: 'OPEN' } }) }
  }

  /**
   * "Manter entregue" (problema) ou "Resolvida" (ocorrência). Já resolvido → devolve como está.
   * @throws 404
   */
  async resolve(id: string, adminId: string, now: Date = new Date()): Promise<{ id: string; status: string; resolution: string | null }> {
    const r = await this.prisma.courierReport.findUnique({ where: { id }, select: { id: true, kind: true, status: true, resolution: true } })
    if (!r) throw { statusCode: 404, message: 'Reporte não encontrado' }
    if (r.status === 'RESOLVED') return { id: r.id, status: r.status, resolution: r.resolution ?? null }
    const resolution = r.kind === 'STOP_ISSUE' ? 'KEPT' : 'DONE'
    await this.prisma.courierReport.update({ where: { id }, data: { status: 'RESOLVED', resolution, resolvedAt: now, resolvedById: adminId } })
    return { id, status: 'RESOLVED', resolution }
  }
}
