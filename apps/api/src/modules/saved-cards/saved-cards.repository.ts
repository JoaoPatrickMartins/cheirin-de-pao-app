import { FastifyInstance } from 'fastify'

export class SavedCardsRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findByUser(userId: string) {
    return this.prisma.savedCard.findMany({ where: { userId } })
  }

  findById(id: string) {
    return this.prisma.savedCard.findUnique({ where: { id } })
  }

  findByStripePaymentMethodId(stripePaymentMethodId: string) {
    return this.prisma.savedCard.findFirst({ where: { stripePaymentMethodId } })
  }

  countByUser(userId: string) {
    return this.prisma.savedCard.count({ where: { userId } })
  }

  create(data: {
    userId: string
    stripePaymentMethodId: string
    brand: string
    lastFour: string
    expiresAt: string
    isDefault: boolean
  }) {
    return this.prisma.savedCard.create({ data })
  }

  async setDefault(cardId: string, userId: string) {
    return this.prisma.$transaction([
      this.prisma.savedCard.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      // WR-03: inclui userId no predicado do update para defesa em profundidade —
      // impede atualizar cartão de outro usuário mesmo que a guarda de serviço seja contornada
      this.prisma.savedCard.update({
        where: { id: cardId, userId },
        data: { isDefault: true },
      }),
    ])
  }

  // WR-04: recebe userId e inclui no predicado do delete para defesa em profundidade
  deleteById(id: string, userId: string) {
    return this.prisma.savedCard.delete({ where: { id, userId } })
  }
}
