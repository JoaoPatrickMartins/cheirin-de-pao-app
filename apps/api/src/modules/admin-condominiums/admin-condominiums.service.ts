import { FastifyInstance } from 'fastify'
import { AdminCondominiumsRepository } from './admin-condominiums.repository.js'
import { CreateCondominiumBody, UpdateCondominiumBody } from './admin-condominiums.schema.js'

/**
 * AdminCondominiumsService — lógica de negócio para CRUD de condomínios.
 *
 * Lança { statusCode, message } para o controller mapear para HTTP status.
 * Admin vê todos os condomínios (sem filtro por isActive).
 */
export class AdminCondominiumsService {
  private repository: AdminCondominiumsRepository

  constructor(private fastify: FastifyInstance) {
    this.repository = new AdminCondominiumsRepository(fastify)
  }

  /**
   * Lista todos os condomínios ordenados por nome (admin vê tudo, sem filtro isActive).
   */
  async list() {
    return this.repository.findAll()
  }

  /**
   * Cria um novo condomínio.
   */
  async create(data: CreateCondominiumBody) {
    return this.repository.create(data)
  }

  /**
   * Atualiza campos de um condomínio. Lança 404 se não encontrar.
   */
  async update(id: string, data: UpdateCondominiumBody) {
    const existing = await this.repository.findById(id)
    if (!existing) throw { statusCode: 404, message: 'Condomínio não encontrado' }
    return this.repository.update(id, data)
  }

  /**
   * Remove um condomínio. Lança 404 se não encontrar.
   */
  async remove(id: string) {
    const existing = await this.repository.findById(id)
    if (!existing) throw { statusCode: 404, message: 'Condomínio não encontrado' }
    return this.repository.remove(id)
  }
}
