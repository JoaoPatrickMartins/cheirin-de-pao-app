import { FastifyInstance } from 'fastify'
import { AdminCondominiumsRepository } from './admin-condominiums.repository.js'
import { CreateCondominiumBody, UpdateCondominiumBody, SlotUpdateBody } from './admin-condominiums.schema.js'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { geocodeWithFallback } from '../../lib/geocode.js'

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
   * Detalha um condomínio por id (usado pelo formulário de edição). 404 se não existir.
   */
  async getById(id: string) {
    const condo = await this.repository.findById(id)
    if (!condo) throw { statusCode: 404, message: 'Condomínio não encontrado' }
    return condo
  }

  /**
   * Cria um novo condomínio herdando os slots da config global (fonte da verdade).
   * Coordenadas: usa as manuais (lat/lng) se informadas; senão geocodifica o endereço
   * com fallback (rua → cidade). Persiste lat/lng + approxLocation para a rota do entregador.
   */
  async create(data: CreateCondominiumBody) {
    const deliverySlots = await getGlobalDeliverySlots(this.fastify.prisma)
    const hasManual = data.lat != null && data.lng != null
    const geo = hasManual ? null : await geocodeWithFallback(data.address)
    return this.repository.create({
      ...data,
      deliverySlots,
      lat: hasManual ? data.lat! : geo?.lat ?? null,
      lng: hasManual ? data.lng! : geo?.lng ?? null,
      approxLocation: hasManual ? false : geo?.approximate ?? false,
    })
  }

  /**
   * Atualiza campos de um condomínio. Lança 404 se não encontrar.
   * Coordenadas manuais têm prioridade; senão, ao mudar o endereço, re-geocodifica
   * (com fallback) e atualiza lat/lng + approxLocation.
   */
  async update(id: string, data: UpdateCondominiumBody) {
    const existing = await this.repository.findById(id)
    if (!existing) throw { statusCode: 404, message: 'Condomínio não encontrado' }

    const patch: Omit<UpdateCondominiumBody, 'lat' | 'lng'> & { lat?: number | null; lng?: number | null; approxLocation?: boolean } = {
      ...data,
    }
    const hasManual = data.lat != null && data.lng != null
    if (hasManual) {
      patch.lat = data.lat
      patch.lng = data.lng
      patch.approxLocation = false
    } else if (data.address) {
      const geo = await geocodeWithFallback(data.address)
      patch.lat = geo?.lat ?? null
      patch.lng = geo?.lng ?? null
      patch.approxLocation = geo?.approximate ?? false
    }
    return this.repository.update(id, patch)
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
