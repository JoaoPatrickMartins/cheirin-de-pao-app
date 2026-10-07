import { FastifyInstance } from 'fastify'
import { AdminCondominiumsRepository } from './admin-condominiums.repository.js'
import { CreateCondominiumBody, UpdateCondominiumBody, SlotUpdateBody } from './admin-condominiums.schema.js'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { geocodeWithFallback } from '../../lib/geocode.js'
import { ACCESS_FIELD_KEY, ACCESS_FIELD_LABELS, readCondoAccess, type AccessField, type CondoAccess } from '@cheirin-de-pao/shared'
import { isStorageConfigured, StorageError, uploadImage } from '../../lib/storage.js'
import { syncDefaultRoute } from '../../lib/default-route.js'

type AddressFields = { street?: string | null; number?: string | null; complement?: string | null; city?: string | null; state?: string | null; zip?: string | null }

/** Mesmo endereço, ignorando espaços, caixa e pontuação do CEP. */
export function sameAddress(a: AddressFields, b: AddressFields | null | undefined): boolean {
  if (!b) return false
  const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()
  const zip = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')
  return (
    norm(a.street) === norm(b.street) &&
    norm(a.number) === norm(b.number) &&
    norm(a.complement) === norm(b.complement) &&
    norm(a.city) === norm(b.city) &&
    norm(a.state) === norm(b.state) &&
    zip(a.zip) === zip(b.zip)
  )
}

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
    const condos = await this.repository.findAll()
    if (condos.length === 0) return condos
    const grouped = await this.repository.countClientsByCondominium(condos.map((c) => c.id))
    const countMap = new Map(grouped.map((g) => [g.condominiumId, g._count._all]))
    // Sugestões de acesso dos entregadores à espera de revisão (selo na lista, A6).
    const pending = await this.fastify.prisma.condoAccessSuggestion.groupBy({
      by: ['condominiumId'],
      where: { condominiumId: { in: condos.map((c) => c.id) }, status: 'PENDING' },
      _count: { _all: true },
    })
    const pendingMap = new Map(pending.map((g) => [g.condominiumId, g._count._all]))
    return condos.map((c) => ({ ...c, clientCount: countMap.get(c.id) ?? 0, pendingSuggestions: pendingMap.get(c.id) ?? 0 }))
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
    const created = await this.repository.create({
      ...data,
      courierAccess: (readCondoAccess(data.courierAccess) ?? null) as object | null,
      deliverySlots,
      lat: hasManual ? data.lat! : geo?.lat ?? null,
      lng: hasManual ? data.lng! : geo?.lng ?? null,
      approxLocation: hasManual ? false : geo?.approximate ?? false,
    })
    this.syncDefaultRoute()
    return created
  }

  /**
   * Rota padrão (plano-rota-padrao, D-3/D-6/D-11): prédio novo, reativado ou que mudou de lugar
   * encaixa sozinho; o desativado ou apagado sai. Em segundo plano — o OSRM não segura o "Salvar".
   */
  private syncDefaultRoute(moved?: string[]) {
    void syncDefaultRoute(this.fastify, { moved })
  }

  /**
   * Atualiza campos de um condomínio. Lança 404 se não encontrar.
   * Coordenadas manuais têm prioridade; senão, só re-geocodifica (com fallback) quando o
   * endereço de fato MUDOU ou o condomínio ainda não tem coordenadas. O formulário manda o
   * endereço em todo salvamento — re-geocodificar sempre sobrescrevia coordenadas digitadas à
   * mão e mexia no aviso de "localização aproximada" sem ninguém ter mudado nada.
   */
  async update(id: string, data: UpdateCondominiumBody) {
    const existing = await this.repository.findById(id)
    if (!existing) throw { statusCode: 404, message: 'Condomínio não encontrado' }

    const patch: Omit<UpdateCondominiumBody, 'lat' | 'lng' | 'numBlocks'> & { lat?: number | null; lng?: number | null; approxLocation?: boolean; numBlocks?: number | null } = {
      ...data,
    }
    // Ao trocar para SINGLE_ENTRANCE, limpa numBlocks para não deixar valor órfão.
    if (data.type === 'SINGLE_ENTRANCE') patch.numBlocks = null
    // Acesso para o entregador (A6): só quando veio no corpo; tudo vazio = sem dicas.
    if ('courierAccess' in data) (patch as Record<string, unknown>).courierAccess = readCondoAccess(data.courierAccess) ?? null
    const hasManual = data.lat != null && data.lng != null
    if (hasManual) {
      patch.lat = data.lat
      patch.lng = data.lng
      patch.approxLocation = false
    } else if (data.address && (!sameAddress(data.address, existing.address) || existing.lat == null || existing.lng == null)) {
      const geo = await geocodeWithFallback(data.address)
      patch.lat = geo?.lat ?? null
      patch.lng = geo?.lng ?? null
      patch.approxLocation = geo?.approximate ?? false
    }
    const updated = await this.repository.update(id, patch)
    const activeChanged = data.isActive !== undefined && data.isActive !== existing.isActive
    const coordsChanged = patch.lat !== undefined && (patch.lat !== (existing.lat ?? null) || patch.lng !== (existing.lng ?? null))
    if (activeChanged || coordsChanged) {
      // Mudou de lugar quem já tinha coordenada; quem ganhou a 1ª entra como novo.
      this.syncDefaultRoute(coordsChanged && existing.lat != null && existing.lng != null ? [id] : undefined)
    }
    return updated
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
    const removed = await this.repository.remove(id)
    this.syncDefaultRoute()
    return removed
  }

  // ── Acesso para o entregador (A6) ─────────────────────────────────────────

  /** Foto da entrada (pasta pública `condos/`). */
  async uploadAccessPhoto(body: Buffer, contentType: string): Promise<{ url: string }> {
    if (!isStorageConfigured()) throw { statusCode: 503, message: 'Armazenamento de fotos não configurado.' }
    try {
      return { url: await uploadImage(body, contentType, 'condos') }
    } catch (err) {
      if (err instanceof StorageError) throw { statusCode: 400, message: err.message }
      throw err
    }
  }

  /** Sugestões pendentes do condomínio, da mais recente. @throws 404 */
  async listAccessSuggestions(id: string) {
    const condo = await this.repository.findById(id)
    if (!condo) throw { statusCode: 404, message: 'Condomínio não encontrado' }
    const rows = await this.fastify.prisma.condoAccessSuggestion.findMany({ where: { condominiumId: id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } })
    const couriers = rows.length
      ? await this.fastify.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.courierId))] } }, select: { id: true, name: true, courierPhotoUrl: true } })
      : []
    const who = new Map(couriers.map((c) => [c.id, c]))
    return rows.map((r) => ({
      id: r.id,
      field: r.field,
      fieldLabel: ACCESS_FIELD_LABELS[r.field as AccessField] ?? r.field,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
      courierName: who.get(r.courierId)?.name ?? 'Entregador',
      courierPhotoUrl: who.get(r.courierId)?.courierPhotoUrl ?? null,
    }))
  }

  /**
   * "Aplicar": o texto vai para o campo correspondente do acesso (Outro → somado às observações).
   * @throws 404 · 409 já revisada
   */
  async applyAccessSuggestion(id: string, sid: string, adminId: string) {
    const [condo, sug] = await Promise.all([
      this.repository.findById(id),
      this.fastify.prisma.condoAccessSuggestion.findUnique({ where: { id: sid } }),
    ])
    if (!condo || !sug || sug.condominiumId !== id) throw { statusCode: 404, message: 'Sugestão não encontrada' }
    if (sug.status !== 'PENDING') throw { statusCode: 409, message: 'Esta sugestão já foi revisada' }
    const current: CondoAccess = readCondoAccess(condo.courierAccess) ?? { portaria: null, temPorteiro: null, portao: null, parar: null, obs: null, fotoUrl: null }
    const key = ACCESS_FIELD_KEY[sug.field as AccessField] ?? 'obs'
    const next = { ...current, [key]: key === 'obs' && sug.field === 'OUTRO' && current.obs ? `${current.obs} · ${sug.text}` : sug.text }
    await this.fastify.prisma.condominium.update({ where: { id }, data: { courierAccess: next as object } })
    await this.fastify.prisma.condoAccessSuggestion.update({ where: { id: sid }, data: { status: 'APPLIED', reviewedAt: new Date(), reviewedById: adminId } })
    return { courierAccess: readCondoAccess(next), suggestions: await this.listAccessSuggestions(id) }
  }

  /** "Descartar". @throws 404 · 409 */
  async discardAccessSuggestion(id: string, sid: string, adminId: string) {
    const sug = await this.fastify.prisma.condoAccessSuggestion.findUnique({ where: { id: sid } })
    if (!sug || sug.condominiumId !== id) throw { statusCode: 404, message: 'Sugestão não encontrada' }
    if (sug.status !== 'PENDING') throw { statusCode: 409, message: 'Esta sugestão já foi revisada' }
    await this.fastify.prisma.condoAccessSuggestion.update({ where: { id: sid }, data: { status: 'DISCARDED', reviewedAt: new Date(), reviewedById: adminId } })
    return { suggestions: await this.listAccessSuggestions(id) }
  }
}
