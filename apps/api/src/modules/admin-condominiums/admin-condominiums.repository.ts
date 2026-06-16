import { FastifyInstance } from 'fastify'
import { CreateCondominiumBody, UpdateCondominiumBody } from './admin-condominiums.schema.js'

/**
 * AdminCondominiumsRepository — acesso ao banco para operações CRUD de condomínios.
 * Padrão: private get prisma() de payments.repository.ts.
 */
export class AdminCondominiumsRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findAll() {
    return this.prisma.condominium.findMany({ orderBy: { name: 'asc' } })
  }

  findById(id: string) {
    return this.prisma.condominium.findUnique({ where: { id } })
  }

  create(data: CreateCondominiumBody) {
    return this.prisma.condominium.create({ data })
  }

  update(id: string, data: UpdateCondominiumBody) {
    return this.prisma.condominium.update({ where: { id }, data })
  }

  remove(id: string) {
    return this.prisma.condominium.delete({ where: { id } })
  }
}
