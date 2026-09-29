import { FastifyInstance } from 'fastify'
import { normalizeReferralCode } from '@cheirin-de-pao/shared'
import type { TrackEvent } from './analytics.schema.js'

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

/** Código de indicação com cara de código (letras e dígitos, 4 a 20) — o resto é descartado. */
const REF_CODE_RE = /^[A-Z0-9]{4,20}$/

/**
 * AnalyticsService — ingestão de eventos de acesso/login para os Relatórios.
 *
 * Imutável: apenas cria registros (nunca atualiza). `visitorId` é um ID anônimo
 * (device_id do cliente) — não há PII direta no stream.
 */
export class AnalyticsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Registra um evento. `userId` só é persistido quando é um ObjectId válido
   * (o campo é @db.ObjectId no schema); caso contrário é descartado.
   */
  async record(input: TrackEvent & { userAgent?: string }): Promise<void> {
    const userId =
      input.userId && OBJECT_ID_RE.test(input.userId) ? input.userId : null
    // Normalizado como no cadastro: "joao-7k2f" e "JOAO7K2F" contam como o mesmo link no funil.
    const ref = normalizeReferralCode(input.ref)
    const refCode = REF_CODE_RE.test(ref) ? ref : null

    await this.prisma.analyticsEvent.create({
      data: {
        type: input.type === 'login' ? 'LOGIN' : 'ACCESS',
        visitorId: input.visitorId,
        userId,
        role: input.role ?? null,
        path: input.path ?? null,
        referrer: input.referrer ?? null,
        platform: input.platform ?? null,
        userAgent: input.userAgent ?? null,
        refCode,
      },
    })
  }
}
