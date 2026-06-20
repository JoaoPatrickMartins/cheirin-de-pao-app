import { FastifyInstance } from 'fastify'
import { AdminCondominiumsRepository } from './admin-condominiums.repository.js'
import { CreateCondominiumBody, UpdateCondominiumBody, SlotUpdateBody } from './admin-condominiums.schema.js'

const DEFAULT_SLOTS = [
  { name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
  { name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
]

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
   * Cria um novo condomínio com slots padrão (manhã e tarde) pré-injetados.
   */
  async create(data: CreateCondominiumBody) {
    return this.repository.create({ ...data, deliverySlots: DEFAULT_SLOTS })
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
   * Atualiza um slot individual de um condomínio (read-modify-write).
   * Lança 404 se condomínio ou slot não encontrado.
   */
  async updateSlot(id: string, slotName: string, patch: SlotUpdateBody) {
    return this.repository.updateSlot(id, slotName, patch)
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
