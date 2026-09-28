import { FastifyInstance } from 'fastify'
import { AdminCombosRepository } from './admin-combos.repository.js'
import { CreateComboBody, UpdateComboBody } from './admin-combos.schema.js'
import { comboEconomy } from '../../lib/combo-pricing.js'
import { loadUnitCosts, type CostBasis } from '../../lib/product-cost.js'

// Data distante para representar promoção "permanente" (endsAt não é nulável no schema)
const FAR_FUTURE = new Date('9999-12-31T23:59:59.999Z')

/**
 * AdminCombosService — lógica de negócio para CRUD de combos e toggle de promoções.
 *
 * T-07-02-04: discountValue fixo em 15% — não configurável via request.
 * togglePromotion: ativa criando Promotion com discountType=PERCENT, discountValue=15;
 *                  desativa chamando updateMany isActive=false para o combo.
 */
export class AdminCombosService {
  private repository: AdminCombosRepository

  constructor(private fastify: FastifyInstance) {
    this.repository = new AdminCombosRepository(fastify)
  }

  /**
   * Lista todos os combos com promoção ativa embutida (activePromotion).
   * Promoção ativa = Promotion com comboId=id E isActive=true.
   */
  async list() {
    const [combos, avulsoUnit] = await Promise.all([
      this.repository.findAll(),
      this.repository.getAvulsoUnit(),
    ])

    const combosWithPromotion = await Promise.all(
      combos.map(async (combo) => {
        const activePromotion = await this.repository.findActivePromotion(combo.id)
        // Mapeia a Promotion crua para o shape `discount` consumido pelo frontend.
        const discount = activePromotion
          ? {
              type: activePromotion.discountType,
              value: activePromotion.discountValue,
              expiresAt: activePromotion.endsAt,
              active: activePromotion.isActive,
            }
          : null
        // Economia calculada vs. avulso (preview para o admin). null quando a tag
        // está desligada ou não há economia positiva.
        const eco =
          combo.showEconomy !== false ? comboEconomy(combo.price, combo.quantity, avulsoUnit) : null
        return {
          ...combo,
          // Normaliza null/ausente (combos antigos) para true no shape enviado ao admin.
          showEconomy: combo.showEconomy ?? true,
          discount,
          economyPercent: eco?.percent ?? null,
          economySavings: eco?.savings ?? null,
        }
      }),
    )

    return combosWithPromotion
  }

  /**
   * Busca um combo por ID (para edição). Lança 404 se não encontrar.
   */
  async getById(id: string) {
    const combo = await this.repository.findById(id)
    if (!combo) throw { statusCode: 404, message: 'Combo não encontrado' }
    return combo
  }

  /**
   * Insumos da precificação assistida (D1) — o custo do pão e o preço do avulso.
   *
   * Existe porque o formulário de combo define `price` **sem ver a margem**: hoje o admin digita
   * um preço no escuro, e margem se perde no cadastro, não no relatório. Com estes dois números a
   * tela calcula custo, margem e R$ por pãozinho ao vivo, a cada tecla.
   *
   * `breadUnitCost` é `null` — nunca zero — quando o pão não tem fornecedor ativo na matriz. Zero
   * apareceria no formulário como margem de 100%, e o admin precificaria em cima de uma mentira.
   */
  async getPricing(): Promise<{
    avulsoUnit: number
    breadProductId: string | null
    breadUnitCost: number | null
    costBasis: CostBasis | null
    costSuppliers: number
  }> {
    const [avulsoUnit, breadProductId] = await Promise.all([
      this.repository.getAvulsoUnit(),
      this.repository.getBreadProductId(),
    ])

    if (!breadProductId) {
      return { avulsoUnit, breadProductId: null, breadUnitCost: null, costBasis: null, costSuppliers: 0 }
    }

    const costs = await loadUnitCosts(this.fastify.prisma, [breadProductId])
    const cost = costs.get(breadProductId)
    return {
      avulsoUnit,
      breadProductId,
      breadUnitCost: cost?.unitCost ?? null,
      costBasis: cost?.basis ?? null,
      costSuppliers: cost?.suppliers ?? 0,
    }
  }

  /**
   * Cria um novo combo.
   */
  async create(data: CreateComboBody) {
    return this.repository.create(data)
  }

  /**
   * Atualiza campos de um combo. Lança 404 se não encontrar.
   */
  async update(id: string, data: UpdateComboBody) {
    const existing = await this.repository.findById(id)
    if (!existing) throw { statusCode: 404, message: 'Combo não encontrado' }

    // Desativar o combo desliga a compra automática dos clientes que o usam —
    // evita cobrá-los em um combo que não existe mais na loja.
    let affectedAutoRecharge = 0
    if (data.isActive === false && existing.isActive) {
      affectedAutoRecharge = await this.repository.disableAutoRechargeForCombo(id)
    }

    const updated = await this.repository.update(id, data)
    return { ...updated, affectedAutoRecharge }
  }

  /**
   * Remove um combo. Lança 404 se não encontrar.
   */
  async remove(id: string) {
    const existing = await this.repository.findById(id)
    if (!existing) throw { statusCode: 404, message: 'Combo não encontrado' }
    return this.repository.remove(id)
  }

  /**
   * Toggle de promoção para um combo.
   *
   * active=true: cria nova Promotion com discountType=PERCENT, discountValue=15,
   *   startsAt=agora, endsAt=FAR_FUTURE (permanente até desativar).
   *   Primeiro desativa qualquer promoção ativa existente (idempotente).
   *
   * active=false: desativa todas as promoções ativas do combo via updateMany.
   *
   * T-07-02-04: discountValue fixo em 15% — não configurável via request.
   */
  async togglePromotion(comboId: string, active: boolean): Promise<void> {
    const existing = await this.repository.findById(comboId)
    if (!existing) throw { statusCode: 404, message: 'Combo não encontrado' }

    if (active) {
      // Desativa qualquer promoção ativa antes de criar nova (idempotente)
      await this.repository.deactivatePromotions(comboId)

      await this.repository.createPromotion({
        comboId,
        discountType: 'PERCENT',
        discountValue: 15,
        startsAt: new Date(),
        endsAt: FAR_FUTURE,
        isActive: true,
      })
    } else {
      await this.repository.deactivatePromotions(comboId)
    }
  }
}
