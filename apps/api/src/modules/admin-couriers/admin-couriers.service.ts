import { FastifyInstance } from 'fastify'
import { CreateCourierBody, UpdateCourierBody } from './admin-couriers.schema.js'

/**
 * AdminCouriersService — lógica de negócio para gestão de entregadores.
 *
 * T-07-03-02: CPF validado no schema (Zod) antes de chegar aqui.
 *             Prisma lança P2002 em cpf duplicado — tratado no controller (409).
 * T-07-03-01: Role check ADMIN fica no controller.
 */
export class AdminCouriersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async list() {
    return this.prisma.user.findMany({
      where: { role: 'COURIER' },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        email: true,
        isBlocked: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })
  }

  async create(data: CreateCourierBody) {
    // Cadastro pelo admin — não exige OTP (fluxo diferente de auth.service)
    return this.prisma.user.create({
      data: {
        ...data,
        role: 'COURIER',
        creditBalance: 0,
      },
    })
  }

  /**
   * Alterna isBlocked do entregador.
   *
   * @throws { statusCode: 404 } se user não encontrado
   * @throws { statusCode: 400 } se user não é COURIER
   */
  async toggle(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id } })

    if (!user) {
      throw { statusCode: 404, message: 'Entregador não encontrado' }
    }

    if (user.role !== 'COURIER') {
      throw { statusCode: 400, message: 'Usuário não é um COURIER' }
    }

    return this.prisma.user.update({
      where: { id },
      data: { isBlocked: !user.isBlocked },
      select: {
        id: true,
        name: true,
        isBlocked: true,
      },
    })
  }

  /**
   * Atualiza dados do entregador (sem CPF — imutável).
   *
   * @throws { statusCode: 404 } se user não encontrado ou não é COURIER
   */
  async updateCourier(id: string, data: UpdateCourierBody) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'COURIER' } })

    if (!user) {
      throw { statusCode: 404, message: 'Entregador não encontrado' }
    }

    return this.prisma.user.update({
      where: { id },
      data,
    })
  }
}
