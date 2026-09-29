import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PhoneSchema } from '@cheirin-de-pao/shared'
import { NotificationsService } from '../notifications/notifications.service.js'
import type { CondoInterestBody } from './condo-interests.schema.js'

/** Máximo de pedidos que a tela do admin lê (os mais recentes). */
const ADMIN_LIST_LIMIT = 2000

const EmailSchema = z.string().email()

/**
 * Chave do grupo: nome + cidade sem acento, minúsculos e com espaços simples. "Residencial Sol"
 * de Campinas e "residencial  sol" de campinas caem no mesmo grupo do admin.
 */
export function condoGroupKey(condoName: string, city: string): string {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  return `${norm(condoName)}|${norm(city)}`
}

/**
 * O campo único "E-mail ou celular" (D-15): com "@" é e-mail; senão, celular (dígitos, 10 a 13).
 * Inválido → `null` (a rota responde 400 com a mensagem do campo).
 */
export function parseContact(raw: string): { email: string | null; phone: string | null } | null {
  const value = raw.trim()
  if (value.includes('@')) {
    const email = EmailSchema.safeParse(value.toLowerCase())
    return email.success ? { email: email.data, phone: null } : null
  }
  const phone = PhoneSchema.safeParse(value)
  return phone.success ? { email: null, phone: phone.data } : null
}

export interface CondoInterestGroup {
  key: string
  /** Nome como o pedido mais recente escreveu. */
  name: string
  city: string
  count: number
  /** Quantos vieram com código de indicação. */
  viaReferral: number
  /** Tratado = todos os pedidos do grupo marcados. Um pedido novo reabre o grupo sozinho. */
  handled: boolean
  lastAt: string
  contacts: Array<{ id: string; name: string; email: string | null; phone: string | null; createdAt: string; viaReferral: boolean }>
}

/** Erro de domínio que o controller traduz em status HTTP. */
function fail(statusCode: number, message: string): never {
  throw { statusCode, message }
}

/**
 * CondoInterestsService — lista de espera de condomínio (C8 → A7).
 */
export class CondoInterestsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * `POST /condominiums/interest`. O mesmo contato no mesmo condomínio não entra duas vezes (quem
   * toca "Avisar" de novo não vira dois pedidos nem dois avisos ao admin).
   */
  async create(body: CondoInterestBody): Promise<void> {
    const contact = parseContact(body.contact)
    if (!contact) fail(400, 'Informe um e-mail ou celular válido')

    const groupKey = condoGroupKey(body.condoName, body.city)
    const duplicate = await this.prisma.condoInterest.findFirst({
      where: { groupKey, ...(contact.email ? { email: contact.email } : { phone: contact.phone }) },
      select: { id: true },
    })
    if (duplicate) return

    // Coleção nova: todas as chaves gravadas (null explícito) — consultar por campo é seguro.
    await this.prisma.condoInterest.create({
      data: {
        condoName: body.condoName,
        zip: body.zip ?? null,
        city: body.city,
        groupKey,
        contactName: body.contactName,
        email: contact.email,
        phone: contact.phone,
        refCode: body.refCode ?? null,
        visitorId: body.visitorId ?? null,
        handledAt: null,
      },
    })

    // Best-effort: o pedido já está gravado; o aviso ao admin não pode derrubar a tela do cliente.
    try {
      const count = await this.prisma.condoInterest.count({ where: { groupKey } })
      await new NotificationsService(this.fastify).notifyAdmins({
        type: 'ADMIN_CONDO_INTEREST',
        title: 'Pedido de novo condomínio',
        body: `${body.condoName} (${body.city}) — ${count}º pedido.`,
        actionRoute: '/admin',
      })
    } catch (err) {
      this.fastify.log.warn({ err }, '[condo-interests] falha ao avisar os admins — ignorado')
    }
  }

  /**
   * `GET /admin/condominiums/interests` — grupos do A7: os em aberto primeiro, depois os com mais
   * pedidos; os tratados vão para o fim.
   */
  async listGroups(): Promise<{ groups: CondoInterestGroup[] }> {
    const rows = await this.prisma.condoInterest.findMany({
      orderBy: { createdAt: 'desc' },
      take: ADMIN_LIST_LIMIT,
      select: {
        id: true,
        condoName: true,
        city: true,
        groupKey: true,
        contactName: true,
        email: true,
        phone: true,
        refCode: true,
        handledAt: true,
        createdAt: true,
      },
    })

    const byKey = new Map<string, CondoInterestGroup>()
    for (const r of rows) {
      let g = byKey.get(r.groupKey)
      if (!g) {
        // `rows` vem do mais recente: o 1º de cada grupo dá o nome e a data mais nova.
        g = {
          key: r.groupKey,
          name: r.condoName,
          city: r.city,
          count: 0,
          viaReferral: 0,
          handled: true,
          lastAt: r.createdAt.toISOString(),
          contacts: [],
        }
        byKey.set(r.groupKey, g)
      }
      g.count++
      if (r.refCode) g.viaReferral++
      if (!r.handledAt) g.handled = false
      g.contacts.push({
        id: r.id,
        name: r.contactName,
        email: r.email ?? null,
        phone: r.phone ?? null,
        createdAt: r.createdAt.toISOString(),
        viaReferral: !!r.refCode,
      })
    }

    const groups = [...byKey.values()].sort(
      (a, b) => Number(a.handled) - Number(b.handled) || b.count - a.count || b.lastAt.localeCompare(a.lastAt),
    )
    return { groups }
  }

  /** `PATCH /admin/condominiums/interests/handled` — marca ou reabre o grupo INTEIRO. */
  async setHandled(groupKey: string, handled: boolean, now: Date = new Date()): Promise<void> {
    const res = await this.prisma.condoInterest.updateMany({
      where: { groupKey },
      data: { handledAt: handled ? now : null },
    })
    if (res.count === 0) fail(404, 'Grupo não encontrado.')
  }
}
