import { FastifyInstance } from 'fastify'
import { CreateComboBody, UpdateComboBody } from './admin-combos.schema.js'

/**
 * AdminCombosRepository — acesso ao banco para operações CRUD de combos e promoções.
 * Padrão: private get prisma() de payments.repository.ts.
 */
export class AdminCombosRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findAll() {
    return this.prisma.combo.findMany({ orderBy: { name: 'asc' } })
  }

  findById(id: string) {
    return this.prisma.combo.findUnique({ where: { id } })
  }

  create(data: CreateComboBody) {
    return this.prisma.combo.create({ data })
  }

  update(id: string, data: UpdateComboBody) {
    return this.prisma.combo.update({ where: { id }, data })
  }

  remove(id: string) {
    return this.prisma.combo.delete({ where: { id } })
  }

  /**
   * Desliga a compra automática (autoRecharge.active=false) de todos os clientes que
   * usam este combo. Chamado ao desativar o combo. autoRecharge é Json — filtramos em
   * memória, pois Prisma/Mongo não consulta com segurança campo aninhado de Json.
   * Preserva o resto da config (comboId, mode, weekday). Retorna quantos foram afetados.
   */
  async disableAutoRechargeForCombo(comboId: string): Promise<number> {
    const clients = await this.prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: { id: true, autoRecharge: true },
    })
    const affected = clients.filter((u) => {
      const ar = u.autoRecharge as { active?: boolean; comboId?: string } | null
      return !!ar?.active && ar.comboId === comboId
    })
    for (const u of affected) {
      const ar = u.autoRecharge as Record<string, unknown>
      await this.prisma.user.update({
        where: { id: u.id },
        data: { autoRecharge: { ...ar, active: false } },
      })
    }
    return affected.length
  }

  findActivePromotion(comboId: string) {
    return this.prisma.promotion.findFirst({
      where: { comboId, isActive: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  createPromotion(data: {
    comboId: string
    discountType: 'PERCENT' | 'FIXED'
    discountValue: number
    startsAt: Date
    endsAt: Date
    isActive: boolean
  }) {
    return this.prisma.promotion.create({ data })
  }

  deactivatePromotions(comboId: string) {
    return this.prisma.promotion.updateMany({
      where: { comboId, isActive: true },
      data: { isActive: false },
    })
  }
}
