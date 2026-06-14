import { FastifyInstance } from 'fastify'
import { CreditsRepository } from './credits.repository.js'

export class CreditsService {
  private repo: CreditsRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new CreditsRepository(fastify)
  }

  listCombos() {
    return this.repo.listActiveCombos()
  }

  async getPricing(): Promise<{ avulsoLimite: number; avulsoUnit: number }> {
    const settings = await this.repo.getSettingsByKeys(['avulsoLimite', 'avulsoUnit'])
    const limiteEntry = settings.find((s) => s.key === 'avulsoLimite')
    const unitEntry = settings.find((s) => s.key === 'avulsoUnit')

    return {
      avulsoLimite: limiteEntry ? parseFloat(limiteEntry.value) : 0,
      avulsoUnit: unitEntry ? parseFloat(unitEntry.value) : 0,
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
