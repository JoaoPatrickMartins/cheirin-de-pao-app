import { FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { SavedCardsService } from './saved-cards.service.js'
import { SavedCardParamsSchema, SetDefaultBodySchema, CreateSavedCardSchema } from './saved-cards.schema.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * Guard idêntico ao de payments.controller.ts — distingue erros de negócio
 * (nossos, com { error, status }) de erros do SDK do Mercado Pago.
 * Nunca vaza detalhes internos do MP ao cliente.
 */
function isBusinessError(err: unknown): err is { error: string; status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    !(err instanceof Error) &&
    'error' in err &&
    'status' in err &&
    typeof (err as { error: unknown }).error === 'string' &&
    typeof (err as { status: unknown }).status === 'number' &&
    !('message' in err) &&
    !('cause' in err)
  )
}

export class SavedCardsController {
  constructor(private service: SavedCardsService) {}

  // GET /users/me/cards — CARD-01
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const cards = await this.service.listCards(userId)
      return reply.status(200).send(cards)
    } catch (err) {
      request.log.error({ err }, 'saved-cards: erro ao listar')
      if (isBusinessError(err)) {
        return reply.status(err.status).send({ error: err.error })
      }
      return reply.status(500).send({ error: 'Erro ao listar cartões.' })
    }
  }

  // POST /users/me/cards — CARD-07: cadastro avulso de cartão (sem cobrança)
  async create(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof CreateSavedCardSchema.parse>
    try {
      body = CreateSavedCardSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const userId = request.user!.id
      const card = await this.service.addCard({ userId, token: body.token })
      return reply.status(201).send(card)
    } catch (err) {
      request.log.error({ err }, 'saved-cards: erro ao cadastrar')
      if (isBusinessError(err)) {
        return reply.status(err.status).send({ error: err.error })
      }
      return reply.status(500).send({ error: 'Erro ao cadastrar cartão.' })
    }
  }

  // PATCH /users/me/cards/:id — CARD-04
  async setDefault(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof SavedCardParamsSchema.parse>
    let body: ReturnType<typeof SetDefaultBodySchema.parse>
    try {
      params = SavedCardParamsSchema.parse(request.params)
      body = SetDefaultBodySchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    // Apenas suporta isDefault: true (definir como padrão)
    if (!body.isDefault) {
      return reply.status(400).send({ error: 'isDefault deve ser true.' })
    }

    try {
      const userId = request.user!.id
      await this.service.setDefault(params.id, userId)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      request.log.error({ err }, 'saved-cards: erro ao definir padrão')
      if (isBusinessError(err)) {
        return reply.status(err.status).send({ error: err.error })
      }
      return reply.status(500).send({ error: 'Erro ao definir cartão padrão.' })
    }
  }

  // DELETE /users/me/cards/:id — CARD-05
  async remove(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof SavedCardParamsSchema.parse>
    try {
      params = SavedCardParamsSchema.parse(request.params)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const userId = request.user!.id
      await this.service.removeCard(params.id, userId)
      return reply.status(204).send()
    } catch (err) {
      request.log.error({ err }, 'saved-cards: erro ao remover')
      if (isBusinessError(err)) {
        return reply.status(err.status).send({ error: err.error })
      }
      return reply.status(500).send({ error: 'Erro ao remover cartão.' })
    }
  }
}
