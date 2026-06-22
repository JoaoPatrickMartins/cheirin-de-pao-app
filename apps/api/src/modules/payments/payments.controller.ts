import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError, z } from 'zod'
import { CreatePixPaymentSchema, CreateCardPaymentSchema } from './payments.schema.js'
import { PaymentsService } from './payments.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * Erros de negócio que ESTE serviço lança têm a forma { error, status } e
 * mensagem em português segura para exibir ao cliente. Já o SDK do Stripe,
 * em respostas não-2xx, lança o corpo JSON cru da API (com `message`/`cause`).
 * Este guard distingue os dois para NUNCA vazar o erro interno do MP ao usuário.
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
    // MP carrega `message`/`cause`; nossos erros de negócio não.
    !('message' in err) &&
    !('cause' in err)
  )
}

const GetStatusParamsSchema = z.object({
  id: z.string(),
})

export class PaymentsController {
  private service: PaymentsService

  constructor(private fastify: FastifyInstance) {
    this.service = new PaymentsService(fastify)
  }

  async createPix(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof CreatePixPaymentSchema.parse>
    try {
      body = CreatePixPaymentSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const userId = request.user!.id
      const result = await this.service.createPix({ ...body, userId })
      return reply.status(201).send(result)
    } catch (err) {
      // Loga o erro completo — inclui a resposta detalhada do Stripe (message/cause)
      this.fastify.log.error({ err }, 'pagamento: erro ao processar')
      // Erros de negócio (nossos): mensagem em PT, segura para exibir
      if (isBusinessError(err)) {
        return reply.status(err.status).send({ error: err.error })
      }
      // Erro inesperado (ex.: SDK do Stripe) — não vaza detalhe interno ao cliente
      return reply.status(500).send({ error: 'Não foi possível processar o pagamento. Tente novamente.' })
    }
  }

  async createCard(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof CreateCardPaymentSchema.parse>
    try {
      body = CreateCardPaymentSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const userId = request.user!.id
      const result = await this.service.createCard({ ...body, userId })
      return reply.status(201).send(result)
    } catch (err) {
      // Loga o erro completo — inclui a resposta detalhada do Stripe (message/cause)
      this.fastify.log.error({ err }, 'pagamento: erro ao processar')
      // Erros de negócio (nossos): mensagem em PT, segura para exibir
      if (isBusinessError(err)) {
        return reply.status(err.status).send({ error: err.error })
      }
      // Erro inesperado (ex.: SDK do Stripe) — não vaza detalhe interno ao cliente
      return reply.status(500).send({ error: 'Não foi possível processar o pagamento. Tente novamente.' })
    }
  }

  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof GetStatusParamsSchema.parse>
    try {
      params = GetStatusParamsSchema.parse(request.params)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }
    try {
      const userId = request.user!.id
      const result = await this.service.getStatus(params.id, userId)
      return reply.status(200).send(result)
    } catch (err) {
      // Loga o erro completo — inclui a resposta detalhada do Stripe (message/cause)
      this.fastify.log.error({ err }, 'pagamento: erro ao processar')
      // Erros de negócio (nossos): mensagem em PT, segura para exibir
      if (isBusinessError(err)) {
        return reply.status(err.status).send({ error: err.error })
      }
      // Erro inesperado (ex.: SDK do Stripe) — não vaza detalhe interno ao cliente
      return reply.status(500).send({ error: 'Não foi possível processar o pagamento. Tente novamente.' })
    }
  }
}
