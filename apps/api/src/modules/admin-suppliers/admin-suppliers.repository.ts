import { FastifyInstance } from 'fastify'
import { CreateSupplierBody, UpdateSupplierBody } from './admin-suppliers.schema.js'

export class AdminSuppliersRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findAll() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  }

  findById(id: string) {
    return this.prisma.supplier.findUnique({ where: { id } })
  }

  create(data: CreateSupplierBody) {
    return this.prisma.supplier.create({ data })
  }

  update(id: string, data: UpdateSupplierBody) {
    return this.prisma.supplier.update({ where: { id }, data })
  }

  remove(id: string) {
    return this.prisma.supplier.delete({ where: { id } })
  }

  desativarPrincipais() {
    return this.prisma.supplier.updateMany({
      where: { isPrincipal: true },
      data: { isPrincipal: false },
    })
  }
}
