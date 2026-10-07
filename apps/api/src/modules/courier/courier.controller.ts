import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import '@fastify/multipart' // augmenta FastifyRequest com .file()
import { ZodError } from 'zod'
import type { CourierRun } from '@prisma/client'
import {
  ConfirmDeliveryParams,
  NotDeliveredBody,
  ConfirmBody,
  LookupQuery,
  ProofQuery,
  ProofSkipBody,
  StartRunBody,
  PositionBody,
  ReorderBody,
  SlotQuery,
  RunParams,
  SlotParams,
  MessageBody,
  ReportBody,
  AccessSuggestionBody,
  IdParams,
  HookOutcomeBody,
  AcceptTermsBody,
  DeclineShiftBody,
} from './courier.schema.js'
import { CourierService } from './courier.service.js'
import { CourierRunService, courierRunSummary } from './courier-runs.js'
import { CourierMeService } from './courier-me.js'
import { CourierEarningsService } from './courier-earnings.js'
import { CourierOpsService } from './courier-ops.js'
import { CourierShiftService } from './courier-shifts.js'
import type { ShiftDeclineReason } from '@cheirin-de-pao/shared'

/** Rota do dia na resposta (datas em ISO). */
function runDto(r: CourierRun) {
  return {
    id: r.id,
    slotId: r.slotId,
    status: r.status,
    condominiumIds: r.condominiumIds,
    reordered: r.reordered,
    startedAt: r.startedAt?.toISOString() ?? null,
    endedAt: r.endedAt?.toISOString() ?? null,
    startMode: r.startMode ?? null,
    plannedKm: r.plannedKm ?? null,
    plannedMin: r.plannedMin ?? null,
  }
}

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * CourierController — HTTP handlers para o entregador.
 *
 * Seguranca:
 * - T-06-01/02: preHandler [authenticate, requireCourier] aplicado na rota
 * - courierId extraido SEMPRE de request.user.id (JWT) — NUNCA do body ou params
 */
export class CourierController {
  private service: CourierService
  private runs: CourierRunService
  private meService: CourierMeService
  private earningsService: CourierEarningsService
  private ops: CourierOpsService
  private shifts: CourierShiftService

  constructor(private fastify: FastifyInstance) {
    this.service = new CourierService(fastify)
    this.runs = new CourierRunService(fastify)
    this.meService = new CourierMeService(fastify)
    this.earningsService = new CourierEarningsService(fastify)
    this.ops = new CourierOpsService(fastify)
    this.shifts = new CourierShiftService(fastify)
  }

  /** GET /courier/me — E14/E15 (perfil e crachá, só leitura). */
  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.meService.me(request.user!.id))
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /** GET /courier/badge-key — crachá v3 (Onda 11): segredo do QR + hora do servidor. Sem cache. */
  async badgeKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = await this.meService.badgeKey(request.user!.id)
      return reply.header('Cache-Control', 'no-store').status(200).send(body)
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /** GET /courier/stats?days=7|30 — E17. */
  async stats(request: FastifyRequest, reply: FastifyReply) {
    const days = (request.query as { days?: string | number }).days
    try {
      return reply.status(200).send(await this.meService.stats(request.user!.id, Number(days) === 7 ? 7 : 30))
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /** GET /courier/earnings — E13 (meus ganhos: semana estimada + extrato). */
  async earnings(request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.earningsService.earnings(request.user!.id))
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  // ── Operação (Onda 8) ──────────────────────────────────────────────────────

  /** Erros da operação: 409 leva o `code` (OPT_OUT · ALREADY · NOT_TODAY) para a tela explicar. */
  private async runOps<T>(reply: FastifyReply, work: () => Promise<T>, okStatus = 200) {
    try {
      return reply.status(okStatus).send(await work())
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: err.issues.map((i) => i.message).join(', ') })
      const e = err as { statusCode?: number; message?: string; code?: string }
      if (e.code === 'FST_REQ_FILE_TOO_LARGE') return reply.status(400).send({ error: 'Imagem acima do limite de 5 MB.' })
      if (e.statusCode && [400, 403, 404, 409, 503].includes(e.statusCode)) return reply.status(e.statusCode).send({ error: e.message, ...(e.code ? { code: e.code } : {}) })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** POST /courier/messages — E16. */
  sendMessage(request: FastifyRequest, reply: FastifyReply) {
    return this.runOps(reply, () => this.ops.sendMessage(request.user!.id, MessageBody.parse(request.body ?? {})))
  }

  /** POST /courier/reports — E11/E12. */
  report(request: FastifyRequest, reply: FastifyReply) {
    return this.runOps(reply, () => this.ops.report(request.user!.id, ReportBody.parse(request.body ?? {})), 201)
  }

  /** POST /courier/reports/photo — foto da ocorrência (privada). */
  reportPhoto(request: FastifyRequest, reply: FastifyReply) {
    return this.runOps(reply, async () => {
      const file = await request.file()
      if (!file) throw { statusCode: 400, message: 'Envie a foto.' }
      return this.ops.uploadReportPhoto(await file.toBuffer(), file.mimetype)
    }, 201)
  }

  /** POST /courier/condos/:id/access-suggestions — E7. */
  suggestAccess(request: FastifyRequest, reply: FastifyReply) {
    return this.runOps(reply, () => this.ops.suggestAccess(request.user!.id, IdParams.parse(request.params).id, AccessSuggestionBody.parse(request.body ?? {})), 201)
  }

  /** POST /courier/hooks/:id/outcome — A7. */
  hookOutcome(request: FastifyRequest, reply: FastifyReply) {
    return this.runOps(reply, () => this.ops.hookOutcome(request.user!.id, IdParams.parse(request.params).id, HookOutcomeBody.parse(request.body ?? {}).delivered))
  }

  // ── Termo e turnos (plano-termos-legais) ──────────────────────────────────

  /** POST /courier/terms/accept — aceite do Termo do Entregador Parceiro (versão, IP, aparelho). */
  acceptTerms(request: FastifyRequest, reply: FastifyReply) {
    return this.runOps(reply, () =>
      this.meService.acceptTerms(request.user!.id, AcceptTermsBody.parse(request.body ?? {}).version, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        deviceId: (request.headers['x-device-id'] as string | undefined) ?? null,
      }),
    )
  }

  /** GET /courier/shifts — turnos de hoje oferecidos/aceitos. */
  shiftsToday(request: FastifyRequest, reply: FastifyReply) {
    return this.runOps(reply, () => this.shifts.today(request.user!.id))
  }

  /** POST /courier/shifts/:id/accept */
  acceptShift(request: FastifyRequest, reply: FastifyReply) {
    return this.runOps(reply, () => this.shifts.accept(request.user!.id, IdParams.parse(request.params).id))
  }

  /** POST /courier/shifts/:id/decline { reason? } — devolve as paradas e avisa o admin. */
  declineShift(request: FastifyRequest, reply: FastifyReply) {
    return this.runOps(reply, () =>
      this.shifts.decline(request.user!.id, IdParams.parse(request.params).id, (DeclineShiftBody.parse(request.body ?? {}).reason ?? null) as ShiftDeclineReason | null),
    )
  }

  /** GET /courier/schedule — E18. */
  async schedule(request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.meService.schedule(request.user!.id))
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /** Valida com Zod; inválido → 400 com a mensagem. */
  private parse<T>(reply: FastifyReply, run: () => T): T | null {
    try {
      return run()
    } catch (err) {
      reply.status(400).send({ error: err instanceof ZodError ? zodMessage(err) : 'Dados invalidos.' })
      return null
    }
  }

  /** Erros esperados das rotas do dia (404/403/409/422); o resto vira 500. */
  private sendRunError(reply: FastifyReply, err: unknown) {
    const e = err as { statusCode?: number; message?: string; pending?: unknown }
    if (e.statusCode === 422) return reply.status(422).send({ error: e.message, pending: e.pending })
    if (e.statusCode && [400, 403, 404, 409].includes(e.statusCode)) return reply.status(e.statusCode).send({ error: e.message })
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  /** POST /courier/runs/start — E8. */
  async startRun(request: FastifyRequest, reply: FastifyReply) {
    const body = this.parse(reply, () => StartRunBody.parse(request.body ?? {}))
    if (!body) return reply
    try {
      const { run, notified } = await this.runs.start(request.user!.id, body)
      return reply.status(200).send({ run: runDto(run), notified })
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /** POST /courier/runs/:id/position — T-9. */
  async position(request: FastifyRequest, reply: FastifyReply) {
    const params = this.parse(reply, () => RunParams.parse(request.params))
    if (!params) return reply
    const body = this.parse(reply, () => PositionBody.parse(request.body ?? {}))
    if (!body) return reply
    try {
      await this.runs.position(request.user!.id, params.id, body)
      return reply.status(204).send()
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /** PUT /courier/runs/order — D-5b. */
  async reorder(request: FastifyRequest, reply: FastifyReply) {
    const body = this.parse(reply, () => ReorderBody.parse(request.body ?? {}))
    if (!body) return reply
    try {
      return reply.status(200).send(runDto(await this.runs.reorder(request.user!.id, body)))
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /** DELETE /courier/runs/order?slotId= — volta à rota padrão. */
  async resetOrder(request: FastifyRequest, reply: FastifyReply) {
    const query = this.parse(reply, () => SlotQuery.parse(request.query))
    if (!query) return reply
    try {
      const run = await this.runs.resetOrder(request.user!.id, query.slotId)
      return reply.status(200).send({ run: run ? runDto(run) : null })
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /** GET /courier/runs/:slotId/summary — E10. */
  async runSummary(request: FastifyRequest, reply: FastifyReply) {
    const params = this.parse(reply, () => SlotParams.parse(request.params))
    if (!params) return reply
    try {
      return reply.status(200).send(courierRunSummary(await this.runs.summary(request.user!.id, params.slotId)))
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /** POST /courier/runs/:id/end — E10. */
  async endRun(request: FastifyRequest, reply: FastifyReply) {
    const params = this.parse(reply, () => RunParams.parse(request.params))
    if (!params) return reply
    try {
      const { run, summary } = await this.runs.end(request.user!.id, params.id)
      return reply.status(200).send({ run: runDto(run), summary: courierRunSummary(summary) })
    } catch (err) {
      return this.sendRunError(reply, err)
    }
  }

  /**
   * GET /courier/orders/today
   *
   * Retorna ordens do dia agrupadas por condominio para o entregador logado.
   * courierId extraido de request.user.id (JWT).
   */
  async getTodayOrders(request: FastifyRequest, reply: FastifyReply) {
    try {
      // T-06-03: courierId do JWT — nunca de query params
      const courierId = request.user!.id
      const result = await this.service.getTodayOrders(courierId)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 403) return reply.status(403).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /courier/orders/:id/confirm
   *
   * Confirma entrega de uma order e devolve o resumo da parada (pop-up do scan).
   * courierId extraido de request.user.id (JWT) — NUNCA do body.
   * D-12: params validados via ConfirmDeliveryParams Zod schema.
   * 409 = parada já tem desfecho: vai junto o resumo, para o app mostrar "Já confirmada às HH:MM".
   */
  async confirmDelivery(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof ConfirmDeliveryParams.parse>
    let body: ReturnType<typeof ConfirmBody.parse>
    try {
      params = ConfirmDeliveryParams.parse(request.params)
      body = ConfirmBody.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }

    try {
      // T-06-01: courierId do JWT — nunca do body nem dos params
      const summary = await this.service.confirmDelivery(params.id, request.user!.id, body)
      return reply.status(200).send(summary)
    } catch (err) {
      return this.sendConfirmError(reply, err)
    }
  }

  /** Erros da confirmação: 409 carrega o resumo da parada; os demais, só a mensagem. */
  private sendConfirmError(reply: FastifyReply, err: unknown) {
    const e = err as { statusCode?: number; message?: string; summary?: unknown }
    if (e.statusCode === 409) return reply.status(409).send({ error: e.message, summary: e.summary })
    if (e.statusCode === 403 || e.statusCode === 404 || e.statusCode === 422) {
      return reply.status(e.statusCode).send({ error: e.message })
    }
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  /**
   * GET /courier/stops/lookup?code=
   * E3 "Digitar código": paradas de hoje do entregador cujo cupom termina com o código.
   */
  async lookupStops(request: FastifyRequest, reply: FastifyReply) {
    let query: ReturnType<typeof LookupQuery.parse>
    try {
      query = LookupQuery.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }
    try {
      const matches = await this.service.lookupStopsByCode(request.user!.id, query.code)
      if (matches.length === 0) return reply.status(404).send({ error: 'Não achamos esse código na sua rota.' })
      return reply.status(200).send({ matches })
    } catch (err) {
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /courier/orders/:id/not-delivered
   *
   * Marca a entrega como NÃO entregue com motivo padronizado e devolve o resumo da parada (a foto
   * da não entrega vem em seguida). courierId extraido de request.user.id (JWT) — NUNCA do body.
   */
  async markNotDelivered(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof ConfirmDeliveryParams.parse>
    let body: ReturnType<typeof NotDeliveredBody.parse>
    try {
      params = ConfirmDeliveryParams.parse(request.params)
      body = NotDeliveredBody.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }

    try {
      const summary = await this.service.markNotDelivered(params.id, request.user!.id, body)
      return reply.status(200).send(summary)
    } catch (err) {
      return this.sendConfirmError(reply, err)
    }
  }

  /**
   * POST /courier/stops/:key/proof?outcome= (multipart `file`) — foto da entrega/não entrega.
   * 503 sem armazenamento configurado: o app segue e marca "sem foto · armazenamento indisponível".
   */
  async uploadProof(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof ConfirmDeliveryParams.parse>
    let query: ReturnType<typeof ProofQuery.parse>
    try {
      params = ConfirmDeliveryParams.parse({ id: (request.params as { key?: string }).key })
      query = ProofQuery.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }
    try {
      const file = await request.file()
      if (!file) return reply.status(400).send({ error: 'Envie a foto.' })
      const body = await file.toBuffer()
      const proof = await this.service.uploadProof(request.user!.id, params.id, query.outcome, { body, mimetype: file.mimetype })
      return reply.status(201).send(proof)
    } catch (err) {
      const e = err as { statusCode?: number; message?: string; code?: string }
      // Arquivo acima do limite do @fastify/multipart (5 MB).
      if (e.code === 'FST_REQ_FILE_TOO_LARGE') return reply.status(400).send({ error: 'Imagem acima do limite de 5 MB.' })
      if (e.statusCode && [400, 403, 404, 503].includes(e.statusCode)) return reply.status(e.statusCode).send({ error: e.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** POST /courier/stops/:key/proof/skip — seguir sem foto (exceção ou opcional). */
  async skipProof(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof ConfirmDeliveryParams.parse>
    let body: ReturnType<typeof ProofSkipBody.parse>
    try {
      params = ConfirmDeliveryParams.parse({ id: (request.params as { key?: string }).key })
      body = ProofSkipBody.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }
    try {
      const proof = await this.service.skipProof(request.user!.id, params.id, body.outcome, body.mode, body.reasonCode, body.text)
      return reply.status(200).send(proof)
    } catch (err) {
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode && [403, 404, 422].includes(e.statusCode)) return reply.status(e.statusCode).send({ error: e.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** PATCH /courier/market-orders/:id/confirm — confirma parada só-market e devolve o resumo. */
  async confirmMarketDelivery(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof ConfirmDeliveryParams.parse>
    let body: ReturnType<typeof ConfirmBody.parse>
    try {
      params = ConfirmDeliveryParams.parse(request.params)
      body = ConfirmBody.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }
    try {
      const summary = await this.service.confirmMarketDelivery(params.id, request.user!.id, body)
      return reply.status(200).send(summary)
    } catch (err) {
      return this.sendConfirmError(reply, err)
    }
  }

  /** PATCH /courier/market-orders/:id/not-delivered — nega parada só-market e devolve o resumo. */
  async markMarketNotDelivered(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof ConfirmDeliveryParams.parse>
    let body: ReturnType<typeof NotDeliveredBody.parse>
    try {
      params = ConfirmDeliveryParams.parse(request.params)
      body = NotDeliveredBody.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }
    try {
      const summary = await this.service.markMarketNotDelivered(params.id, request.user!.id, body)
      return reply.status(200).send(summary)
    } catch (err) {
      return this.sendConfirmError(reply, err)
    }
  }

  /** PATCH /courier/hooks/:id/confirm — confirma a parada só de gancho e devolve o resumo. */
  async confirmHookStop(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof ConfirmDeliveryParams.parse>
    let body: ReturnType<typeof ConfirmBody.parse>
    try {
      params = ConfirmDeliveryParams.parse(request.params)
      body = ConfirmBody.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }
    try {
      const summary = await this.service.confirmHookStop(params.id, request.user!.id, body)
      return reply.status(200).send(summary)
    } catch (err) {
      return this.sendConfirmError(reply, err)
    }
  }

  /** PATCH /courier/hooks/:id/not-delivered — parada só de gancho não realizada; o gancho volta para a fila. */
  async markHookNotDelivered(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof ConfirmDeliveryParams.parse>
    let body: ReturnType<typeof NotDeliveredBody.parse>
    try {
      params = ConfirmDeliveryParams.parse(request.params)
      body = NotDeliveredBody.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }
    try {
      const summary = await this.service.markHookNotDelivered(params.id, request.user!.id, body)
      return reply.status(200).send(summary)
    } catch (err) {
      return this.sendConfirmError(reply, err)
    }
  }
}
