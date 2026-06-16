import { FastifyInstance } from 'fastify'
import { CreateSupplierBody, UpdateSupplierBody } from './admin-suppliers.schema.js'

/**
 * AdminSuppliersService — lógica de negócio para CRUD de fornecedores.
 *
 * T-07-03-03: Garantia de único isPrincipal via updateMany antes do create/update.
 * T-07-03-01: Role check ADMIN fica no controller (não no service).
 */
export class AdminSuppliersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async list() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  }

  async create(data: CreateSupplierBody) {
    // T-07-03-03: se isPrincipal=true, desativar todos os outros antes de criar
    if (data.isPrincipal) {
      await this.prisma.supplier.updateMany({
        where: { isPrincipal: true },
        data: { isPrincipal: false },
      })
    }
    return this.prisma.supplier.create({ data })
  }

  async update(id: string, data: UpdateSupplierBody) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Fornecedor não encontrado' }

    // T-07-03-03: se isPrincipal=true no update, desativar os outros primeiro
    if (data.isPrincipal) {
      await this.prisma.supplier.updateMany({
        where: { isPrincipal: true },
        data: { isPrincipal: false },
      })
    }

    return this.prisma.supplier.update({ where: { id }, data })
  }

  async remove(id: string) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Fornecedor não encontrado' }
    return this.prisma.supplier.delete({ where: { id } })
  }
}
