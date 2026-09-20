import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { BannerEventSchema } from '@cheirin-de-pao/shared'
import { BannersService } from './banners.service.js'

/**
 * BannersController — banners do cliente.
 *
 * Os três POSTs de telemetria respondem **202 sempre**, como o /analytics/event: o cliente dispara
 * e segue a vida. Registrar impressão não pode competir com o toque do usuário nem virar um erro
 * na tela por causa de um banner que alguém apagou no meio do caminho.
 */
export class BannersController {
  private service: BannersService

  constructor(private fastify: FastifyInstance) {
    this.service = new BannersService(fastify)
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.service.forClient(request.user!.id))
    } catch (err) {
      // Banner é enfeite: se a consulta falhar, o app segue sem nenhum, nunca com erro na Home.
      this.fastify.log.error(err)
      return reply.status(200).send({ popup: null, strip: null, market: [] })
    }
  }

  async track(request: FastifyRequest, reply: FastifyReply) {
    const { id, event } = request.params as { id: string; event: string }
    const parsed = BannerEventSchema.safeParse(event)
    if (parsed.success) {
      await this.service.track(request.user!.id, id, parsed.data)
    }
    return reply.status(202).send({ ok: true })
  }
}
