import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'

/**
 * AdminSettingsService — gerencia configurações globais (horário de corte + avulso).
 *
 * T-07-02-02: setCutoffTime — valor já validado pelo Zod no controller.
 * Push processCutoff é best-effort — falha silenciosa.
 */

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

export class AdminSettingsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Retorna o horário de corte configurado ('HH:MM').
   * Default: '20:00' quando ainda não configurado.
   */
  async getCutoffTime(): Promise<string> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: 'cutoffTime' },
    })
    return setting?.value ?? '20:00'
  }

  /**
   * Atualiza (upsert) o horário de corte.
   * Valor deve seguir o formato HH:MM (validado via Zod no controller antes de chegar aqui).
   */
  async setCutoffTime(time: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key: 'cutoffTime' },
      create: { key: 'cutoffTime', value: time },
      update: { value: time },
    })
  }

  /**
   * Retorna a configuração de compra avulsa.
   * limit: quantidade máxima por pedido avulso
   * unitPrice: preço por unidade avulsa
   */
  async getAvulsoConfig(): Promise<{ limit: number; unitPrice: number }> {
    const [limiteRow, unitRow] = await Promise.all([
      this.prisma.setting.findUnique({ where: { key: 'avulsoLimite' } }),
      this.prisma.setting.findUnique({ where: { key: 'avulsoUnit' } }),
    ])

    return {
      limit: limiteRow ? parseInt(limiteRow.value, 10) : 0,
      unitPrice: unitRow ? parseFloat(unitRow.value) : 0,
    }
  }

  /**
   * Atualiza (upsert) as configurações de compra avulsa.
   */
  async setAvulsoConfig(limit: number, unitPrice: number): Promise<void> {
    await Promise.all([
      this.prisma.setting.upsert({
        where: { key: 'avulsoLimite' },
        create: { key: 'avulsoLimite', value: String(limit) },
        update: { value: String(limit) },
      }),
      this.prisma.setting.upsert({
        where: { key: 'avulsoUnit' },
        create: { key: 'avulsoUnit', value: String(unitPrice) },
        update: { value: String(unitPrice) },
      }),
    ])
  }

  /**
   * Retorna o status atual de corte para clientes.
   *
   * Endpoint público (sem autenticação) — usado pelo HomeScreen do cliente
   * para exibir banner de aviso quando o prazo de agendamento foi encerrado.
   *
   * Lógica: hora atual BRT (HH:MM) >= cutoffTime → isCutoff: true
   */
  async getCutoffStatus(): Promise<{ isCutoff: boolean; cutoffTime: string }> {
    const cutoffTime = await this.getCutoffTime()

    // Hora atual no fuso de Brasília — formato HH:MM (24h)
    const nowHHMM = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())

    const isCutoff = nowHHMM >= cutoffTime
    return { isCutoff, cutoffTime }
  }

  /**
   * Verifica se o horário atual (BRT) corresponde ao horário de corte.
   * Se sim, notifica via OneSignal todos os clientes sem Order para amanhã.
   *
   * Push é best-effort — falhas são logadas como warn e não interrompem o fluxo.
   * Chamado pelo cron job a cada hora cheia (cron.ts).
   */
  async processCutoff(): Promise<void> {
    const cutoffTime = await this.getCutoffTime()

    // Hora atual no fuso de Brasília
    const nowBrt = new Date().toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    if (nowBrt !== cutoffTime) {
      return
    }

    this.fastify.log.info(`[admin-settings] processCutoff iniciado para horário ${cutoffTime}`)

    // Calcula o intervalo de amanhã em BRT (início do dia / fim do dia)
    const now = new Date()
    const tomorrowStart = new Date(
      new Date(now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })).getTime() +
        24 * 60 * 60 * 1000,
    )
    // Ajuste para BRT (UTC-3)
    const tomorrowStartBrt = new Date(tomorrowStart.getTime() + 3 * 60 * 60 * 1000)
    const tomorrowEndBrt = new Date(tomorrowStartBrt.getTime() + 24 * 60 * 60 * 1000 - 1)

    // Busca clientes com oneSignalPlayerId
    const clients = await this.prisma.user.findMany({
      where: {
        role: 'CLIENT',
        oneSignalPlayerId: { not: null },
        isBlocked: false,
      },
      select: { id: true, oneSignalPlayerId: true },
    })

    if (clients.length === 0) return

    // Busca Orders de amanhã para filtrar quem JÁ tem pedido
    const tomorrowOrders = await this.prisma.order.findMany({
      where: {
        scheduledDate: {
          gte: tomorrowStartBrt,
          lte: tomorrowEndBrt,
        },
        status: { not: 'CANCELLED' },
      },
      select: { userId: true },
    })

    const usersWithOrderTomorrow = new Set(tomorrowOrders.map((o: { userId: string }) => o.userId))

    // Filtra clientes sem pedido para amanhã
    const clientsToNotify = clients.filter(
      (c: { id: string; oneSignalPlayerId: string | null }) =>
        !usersWithOrderTomorrow.has(c.id) && c.oneSignalPlayerId,
    )

    if (clientsToNotify.length === 0) {
      this.fastify.log.info('[admin-settings] processCutoff: todos os clientes já têm pedido para amanhã')
      return
    }

    // Envia push para cada cliente que não tem pedido amanhã — best-effort
    const osClient = createOsClient()

    for (const client of clientsToNotify) {
      try {
        const notification = new OneSignal.Notification()
        notification.app_id = process.env.ONESIGNAL_APP_ID!
        notification.include_subscription_ids = [client.oneSignalPlayerId!]
        notification.headings = { pt: 'Cheirin de Pão' }
        notification.contents = {
          pt: 'O prazo para pedidos de amanhã foi encerrado. Seus pãezinhos não chegarão amanhã.',
        }
        await osClient.createNotification(notification)
      } catch (pushErr) {
        this.fastify.log.warn({ err: pushErr }, `[admin-settings] falha ao enviar push para ${client.id} — ignorado`)
      }
    }

    this.fastify.log.info(
      `[admin-settings] processCutoff: ${clientsToNotify.length} notificação(ões) enviada(s)`,
    )
  }
}
