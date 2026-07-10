import { FastifyInstance } from 'fastify'

/**
 * AdminFinancialService — receita por período, tipo e condomínio
 *
 * ADMF-01: receita por dia/semana/mês
 * ADMF-02: filtrar por condomínio via $runCommandRaw com $lookup
 * ADMF-03: receita por tipo — combos vs avulso
 *
 * Segurança (T-07-05-01): role check ADMIN no controller.
 * T-07-05-05: $runCommandRaw sempre usa $match com date range antes do $lookup.
 */
export class AdminFinancialService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Calcula startDate e endDate em UTC com base no período e offset BRT (-3h).
   * BRT = UTC-3 → hora local BRT = UTC - 3h
   */
  private getDateRange(period: 'day' | 'week' | 'month'): { startDate: Date; endDate: Date } {
    // Offset BRT: -3h em ms
    const BRT_OFFSET = 3 * 60 * 60 * 1000

    const nowUtc = new Date()
    // Hora atual em BRT (UTC-3)
    const nowBrt = new Date(nowUtc.getTime() - BRT_OFFSET)

    let startBrt: Date

    if (period === 'day') {
      // Início do dia BRT (00:00 BRT = 03:00 UTC)
      startBrt = new Date(
        Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate()),
      )
    } else if (period === 'week') {
      // Segunda-feira desta semana em BRT
      const dayOfWeek = nowBrt.getUTCDay() // 0=Dom, 1=Seg, ...
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      startBrt = new Date(
        Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate() - daysFromMonday),
      )
    } else {
      // Primeiro dia do mês em BRT
      startBrt = new Date(Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), 1))
    }

    // Converter de volta para UTC (startBrt está em UTC mas representa hora BRT)
    // Adicionamos BRT_OFFSET para obter o UTC real correspondente ao início do dia BRT
    const startDate = new Date(startBrt.getTime() + BRT_OFFSET)
    const endDate = nowUtc

    return { startDate, endDate }
  }

  /**
   * getRevenue — agrega receita por período com breakdown por tipo e condomínio.
   *
   * @param period - 'day' | 'week' | 'month'
   * @param condominiumId - filtra por condomínio (opcional)
   */
  async getRevenue(
    period: 'day' | 'week' | 'month',
    condominiumId?: string,
  ): Promise<{
    total: number
    byType: { combos: number; avulso: number }
    byCondominium: Array<{ condominiumId: string; condominiumName?: string; total: number }>
  }> {
    const { startDate, endDate } = this.getDateRange(period)

    // ── Total geral ──────────────────────────────────────────────────────────
    const totalResult = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
      },
    })
    const total = totalResult._sum.amount ?? 0

    // ── Por tipo: combos ─────────────────────────────────────────────────────
    const combosResult = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
        comboId: { not: null },
      },
    })
    const combos = combosResult._sum.amount ?? 0

    // ── Por tipo: avulso ─────────────────────────────────────────────────────
    const avulsoResult = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
        customQuantity: { not: null },
      },
    })
    const avulso = avulsoResult._sum.amount ?? 0

    // ── Por condomínio (via $runCommandRaw — T-07-05-05: $match com date range primeiro) ──
    const pipeline: unknown[] = [
      {
        $match: {
          status: 'PAID',
          createdAt: {
            $gte: { $date: startDate.toISOString() },
            $lte: { $date: endDate.toISOString() },
          },
        },
      },
      {
        $lookup: {
          from: 'User',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ]

    // Filtrar por condomínio se informado
    if (condominiumId) {
      pipeline.push({
        $match: {
          'user.condominiumId': { $oid: condominiumId },
        },
      })
    }

    pipeline.push({
      $group: {
        _id: '$user.condominiumId',
        total: { $sum: '$amount' },
      },
    })

    // $runCommandRaw retorna Extended JSON: o _id (ObjectId) volta como { $oid: "..." },
    // não como string. Normalizamos para a string hex antes de usar no Prisma.
    const rawResult = await this.prisma.$runCommandRaw({
      aggregate: 'Payment',
      pipeline: pipeline as unknown as import('@prisma/client/runtime/library').InputJsonValue,
      cursor: {},
    }) as { cursor?: { firstBatch?: Array<{ _id: unknown; total: number }> } }

    const firstBatch = rawResult?.cursor?.firstBatch ?? []

    const extractId = (raw: unknown): string => {
      if (typeof raw === 'string') return raw
      if (raw && typeof raw === 'object' && '$oid' in raw) {
        return String((raw as { $oid: unknown }).$oid ?? '')
      }
      return ''
    }

    // Buscar nomes dos condomínios
    const condoIds = firstBatch
      .map((row) => extractId(row._id))
      .filter((id) => id.length > 0)

    const condominiums = condoIds.length > 0
      ? await this.prisma.condominium.findMany({
          where: { id: { in: condoIds } },
          select: { id: true, name: true },
        })
      : []

    const condoNameMap = new Map(condominiums.map((c) => [c.id, c.name]))

    const byCondominium = firstBatch.map((row) => {
      const id = extractId(row._id)
      return {
        condominiumId: id,
        condominiumName: condoNameMap.get(id) ?? undefined,
        total: row.total ?? 0,
      }
    })

    return { total, byType: { combos, avulso }, byCondominium }
  }
}
