import { FastifyInstance } from 'fastify'
import { CreditsRepository } from './credits.repository.js'
import { effectiveComboPrice, comboEconomy } from '../../lib/combo-pricing.js'
import { parseAgendaMinimos } from '../admin-settings/admin-settings.service.js'
import type { WeekdayMinimums } from '../admin-settings/admin-settings.schema.js'

export class CreditsService {
  private repo: CreditsRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new CreditsRepository(fastify)
  }

  // Lista combos com a promoção ativa já aplicada: price = preço com desconto,
  // antes = preço original (só quando há promoção). O front usa `antes` para o
  // preço riscado (ComboCard). findMany já vem ordenado por createdAt desc, então
  // o primeiro de cada comboId é a promoção ativa mais recente.
  async listCombos() {
    const combos = await this.repo.listActiveCombos()
    const promotions = await this.repo.findActivePromotionsByComboIds(combos.map((c) => c.id))
    const avulsoSetting = await this.repo.getSettingByKey('avulsoUnit')
    const avulsoUnit = avulsoSetting ? parseFloat(avulsoSetting.value) : 0

    const promoByCombo = new Map<string, (typeof promotions)[number]>()
    for (const p of promotions) {
      if (!promoByCombo.has(p.comboId)) promoByCombo.set(p.comboId, p)
    }

    return combos.map((combo) => {
      const promo = promoByCombo.get(combo.id) ?? null
      const price = effectiveComboPrice(combo.price, promo)
      const isOnPromotion = price < combo.price
      // Economia calculada vs. comprar a mesma quantidade no avulso. Usa o preço
      // efetivo (com desconto) para o valor ser verdadeiro em qualquer situação.
      const eco = combo.showEconomy !== false ? comboEconomy(price, combo.quantity, avulsoUnit) : null
      return {
        id: combo.id,
        name: combo.name,
        quantity: combo.quantity,
        tag: combo.tag,
        description: combo.description,
        economyPercent: eco?.percent ?? null,
        economySavings: eco?.savings ?? null,
        isActive: combo.isActive,
        price,
        isOnPromotion,
        ...(isOnPromotion ? { antes: combo.price } : {}),
      }
    })
  }

  async getPricing(): Promise<{
    avulsoLimite: number
    avulsoUnit: number
    pedidoMinimoUnico: number
    pedidoMinimoAgenda: WeekdayMinimums
  }> {
    const settings = await this.repo.getSettingsByKeys([
      'avulsoLimite',
      'avulsoUnit',
      'pedidoMinimoUnico',
      'pedidoMinimoAgenda',
    ])
    const limiteEntry = settings.find((s) => s.key === 'avulsoLimite')
    const unitEntry = settings.find((s) => s.key === 'avulsoUnit')
    const minUnicoEntry = settings.find((s) => s.key === 'pedidoMinimoUnico')
    const minAgendaEntry = settings.find((s) => s.key === 'pedidoMinimoAgenda')

    const minUnicoParsed = minUnicoEntry ? parseInt(minUnicoEntry.value, 10) : 1

    return {
      avulsoLimite: limiteEntry ? parseFloat(limiteEntry.value) : 0,
      avulsoUnit: unitEntry ? parseFloat(unitEntry.value) : 0,
      pedidoMinimoUnico: Number.isFinite(minUnicoParsed) && minUnicoParsed >= 1 ? minUnicoParsed : 1,
      pedidoMinimoAgenda: parseAgendaMinimos(minAgendaEntry?.value),
    }
  }

  getCreditHistory(userId: string) {
    return this.repo.getCreditHistory(userId)
  }

  async validateCustomPurchase(quantity: number, avulsoLimite: number): Promise<void> {
    if (quantity <= 0) {
      throw { error: 'Quantidade deve ser positiva', status: 400 }
    }
    if (quantity >= avulsoLimite) {
      throw {
        error: 'Compra personalizada limitada a combos acima deste limite. Escolha um combo para quantidades maiores.',
        status: 400,
      }
    }
  }

  async getUnitPrice(): Promise<{ avulsoUnit: number; bestComboUnitPrice: number }> {
    const [combos, setting] = await Promise.all([
      this.repo.listActiveCombos(),
      this.repo.getSettingByKey('avulsoUnit'),
    ])

    const avulsoUnit = setting ? parseFloat(setting.value) : 0

    let bestComboUnitPrice = Infinity
    for (const combo of combos) {
      const unitPrice = combo.price / combo.quantity
      if (unitPrice < bestComboUnitPrice) {
        bestComboUnitPrice = unitPrice
      }
    }

    return {
      avulsoUnit,
      bestComboUnitPrice: bestComboUnitPrice === Infinity ? 0 : bestComboUnitPrice,
    }
  }

  async checkBalance(userId: string, requiredQty: number): Promise<boolean> {
    const user = await this.repo.getUserById(userId)
    if (!user) return false
    return user.creditBalance >= requiredQty
  }
}
