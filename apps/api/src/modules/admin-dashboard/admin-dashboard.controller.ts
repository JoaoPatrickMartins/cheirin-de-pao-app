import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { PeriodQuerySchema, specFromQuery } from '../../lib/period-query.js'
import { resolveWindow } from '../../lib/date-range.js'
import { AdminDashboardService, type DashboardOverview } from './admin-dashboard.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/** Default do painel: o mês corrente — é a pergunta "como vai o mês", não "como foi hoje". */
const DASHBOARD_DEFAULT_PERIOD = 'month' as const

/**
 * Cache TTL em memória da visão geral.
 *
 * Deliberadamente **não** é uma coleção materializada. `MaterializedCycle` existe porque o corte
 * PRECISA de durabilidade — perder a marca de um ciclo perde pedidos. Um painel não: ele é aberto
 * repetidamente por um ou dois admins, e um TTL curto corta as releituras sem criar mais um estado
 * persistido para dessincronizar.
 *
 * A chave inclui a janela, então trocar o período no seletor nunca serve número de outro período.
 */
const OVERVIEW_TTL_MS = 45_000

interface CacheEntry {
  at: number
  payload: DashboardOverview
}

export class AdminDashboardController {
  private service: AdminDashboardService
  private overviewCache = new Map<string, CacheEntry>()

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminDashboardService(fastify)
  }

  private requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
    if (request.user?.role !== 'ADMIN') {
      reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
      return false
    }
    return true
  }

  /** GET /admin/dashboard/alerts — Faixa 0. Sem cache: é o que precisa estar fresco. */
  async getAlerts(request: FastifyRequest, reply: FastifyReply) {
    if (!this.requireAdmin(request, reply)) return
    try {
      return reply.status(200).send(await this.service.getAlerts())
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** GET /admin/dashboard/overview — Faixas 2, 4 e 6. */
  async getOverview(request: FastifyRequest, reply: FastifyReply) {
    if (!this.requireAdmin(request, reply)) return

    let query: ReturnType<typeof PeriodQuerySchema.parse>
    try {
      query = PeriodQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    let window
    try {
      window = resolveWindow(specFromQuery(query, DASHBOARD_DEFAULT_PERIOD))
    } catch (err) {
      const message = err instanceof RangeError ? err.message : 'Parâmetros inválidos.'
      return reply.status(400).send({ error: message })
    }

    // A janela de preset termina em `now`, então a chave precisa ser o ponto de avanço e não o
    // instante exato — senão cada requisição geraria uma chave nova e o cache nunca acertaria.
    const bucket = Math.floor(window.endDate.getTime() / OVERVIEW_TTL_MS)
    const key = `${JSON.stringify(window.spec)}|${query.compare ? 'cmp' : 'plain'}|${bucket}`

    const hit = this.overviewCache.get(key)
    if (hit && Date.now() - hit.at < OVERVIEW_TTL_MS) {
      return reply.status(200).send(hit.payload)
    }

    try {
      const payload = await this.service.getOverview(window, query.compare)
      // O mapa é limpo em vez de crescer: as chaves carregam o bucket de tempo, então entradas
      // velhas nunca voltam a ser consultadas e só ocupariam memória.
      if (this.overviewCache.size > 32) this.overviewCache.clear()
      this.overviewCache.set(key, { at: Date.now(), payload })
      return reply.status(200).send(payload)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
