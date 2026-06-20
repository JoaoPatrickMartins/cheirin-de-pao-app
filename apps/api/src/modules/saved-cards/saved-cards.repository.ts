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

  countByUser(userId: string) {
    return this.prisma.savedCard.count({ where: { userId } })
  }

  create(data: {
    userId: string
    mpCardId: string
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
      this.prisma.savedCard.update({
        where: { id: cardId },
        data: { isDefault: true },
      }),
    ])
  }

  deleteById(id: string) {
    return this.prisma.savedCard.delete({ where: { id } })
  }
}
