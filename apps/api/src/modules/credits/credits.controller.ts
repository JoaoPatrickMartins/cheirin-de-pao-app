import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { AutoRechargeSchema, CardTokenSchema } from './credits.schema.js'
import { CreditsService } from './credits.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

export class CreditsController {
  private service: CreditsService

  constructor(private fastify: FastifyInstance) {
    this.service = new CreditsService(fastify)
  }

  async listCombos(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const combos = await this.service.listCombos()
      return reply.status(200).send(combos)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async getPricing(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const pricing = await this.service.getPricing()
      return reply.status(200).send(pricing)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async getCreditHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const history = await this.service.getCreditHistory(userId)
      return reply.status(200).send(history)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async updateAutoRecharge(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof AutoRechargeSchema.parse>
    try {
      body = AutoRechargeSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      await this.fastify.prisma.user.update({
        where: { id: request.user!.id },
        data: { autoRecharge: body },
      })
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  // GET /users/me/auto-recharge — status atual (para badges e pré-preenchimento da tela)
  async getAutoRecharge(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = await this.fastify.prisma.user.findUnique({
        where: { id: request.user!.id },
        select: { autoRecharge: true },
      })
      const ar = (user?.autoRecharge ?? null) as { active?: boolean; comboId?: string } | null
      let combo = null
      if (ar?.comboId) {
        combo = await this.fastify.prisma.combo.findUnique({ where: { id: ar.comboId } })
      }
      return reply.status(200).send({
        active: !!ar?.active,
        comboId: ar?.comboId ?? null,
        comboName: combo?.name ?? null,
        comboQuantity: combo?.quantity ?? null,
        price: combo?.price ?? null,
      })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async updateCardToken(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof CardTokenSchema.parse>
    try {
      body = CardTokenSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      await this.fastify.prisma.user.update({
        where: { id: request.user!.id },
        data: { cardTokenMp: body.token },
      })
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
