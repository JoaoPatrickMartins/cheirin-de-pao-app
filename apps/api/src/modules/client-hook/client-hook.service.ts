import { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service.js'
import { PaymentsService } from '../payments/payments.service.js'
import { getGanchoConfig, type GanchoConfig } from '../../lib/gancho-config.js'
import { clientLabel } from '../../lib/client-label.js'

/** Snapshot do gancho mais recente do cliente (ou null se nunca teve). */
interface CurrentHook {
  id: string
  type: 'FREE' | 'PAID' | 'BONUS'
  status: 'PENDING_PAYMENT' | 'REQUESTED' | 'DELIVERED' | 'CANCELLED'
  reason: string | null
  requestedAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
}

/** Resultado da avaliação das regras do gancho GRÁTIS para um cliente. */
interface FreeEligibility {
  /** true se pelo menos uma das regras R1..R4 foi satisfeita. */
  eligible: boolean
  /** Pedidos entregues já contados na fidelidade (0 quando a regra está desligada). */
  recorrenciaProgress: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Meio centavo de tolerância no limiar da Cestinha. `MarketOrder.totalValue` é Float: uma
 * Cestinha de exatamente R$ 12,00 pode estar gravada como 11,999999…, o que produziria um
 * falso negativo num `gte` exato. Meio centavo a favor do cliente é irrelevante no negócio.
 */
const FLOAT_EPSILON = 0.005

/**
 * ClientHookService — gancho de porta pelo próprio cliente.
 *
 * Regras (fonte da verdade: coleção HookRequest):
 *  - GRÁTIS: 1 por cliente, concedido por QUALQUER uma destas regras:
 *      R1 comprou um combo;
 *      R2 pedido único com quantidade >= ganchoPedidoUnicoMin;
 *      R3 Cestinha cujo valor equivale a >= ganchoPedidoUnicoMin pães (limiar em R$ =
 *         pedidoUnicoMin × avulsoUnit) — vale já na compra, como R1/R2;
 *      R4 fidelidade: >= ganchoRecorrenciaMin pedidos ENTREGUES (pedido único + Cestinha)
 *         a partir do marco ganchoRecorrenciaDesde. Desligada quando o mínimo é 0.
 *    Só vale enquanto o cliente não tem NENHUM gancho (needsConsent) — inclusive o BONUS
 *    concedido pelo admin, que também encerra o direito ao grátis. A concessão passa pelo
 *    modal de consentimento (requestHook).
 *  - PAGO: após já ter um gancho, o cliente pode pagar (Pix) um gancho adicional
 *    (reposição por defeito/perda). Bloqueado enquanto houver um gancho em andamento.
 *  - BÔNUS: concedido pelo admin (módulo admin-hooks) — não passa por aqui.
 */
export class ClientHookService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** Preço do pão avulso (Setting avulsoUnit). 0 quando ausente/inválido. */
  private async getAvulsoUnit(): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key: 'avulsoUnit' } })
    const parsed = row ? parseFloat(row.value) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  /**
   * Avalia as regras R1..R4 do gancho grátis. Só deve ser chamada para clientes SEM gancho —
   * quem já tem não tem direito ao grátis e não precisa pagar por estas queries.
   *
   * R3 compara `totalValue >= pedidoUnicoMin × avulsoUnit` no banco, em vez de converter cada
   * pedido em pães com `creditsForPrice`: é a mesma matemática (a conversão é linear) e evita
   * carregar todas as Cestinhas do cliente para filtrar em memória.
   */
  private async evaluateFree(
    userId: string,
    config: Pick<GanchoConfig, 'pedidoUnicoMin' | 'recorrenciaMin' | 'recorrenciaDesde'>,
    avulsoUnit: number,
  ): Promise<FreeEligibility> {
    // Sem preço avulso configurado não há como converter o mínimo em reais → R3 fica fora
    // (em vez de virar limiar 0, que liberaria o gancho para qualquer Cestinha).
    const cestinhaMin =
      avulsoUnit > 0 ? round2(config.pedidoUnicoMin * avulsoUnit) - FLOAT_EPSILON : null

    // Sem marco não há vigência definida — a fidelidade não vale retroativamente.
    const recorrenciaOn = config.recorrenciaMin > 0 && config.recorrenciaDesde != null
    const desde = config.recorrenciaDesde ?? undefined

    const [comboPurchases, bigSingleOrders, bigCestinhas, deliveredSingles, deliveredCestinhas] =
      await Promise.all([
        // R1 — comprou combo
        this.prisma.payment.count({
          where: { userId, status: 'PAID', comboId: { not: null } },
        }),
        // R2 — pedido único >= mínimo
        this.prisma.order.count({
          where: {
            userId,
            type: 'SINGLE',
            status: { not: 'CANCELLED' },
            quantity: { gte: config.pedidoUnicoMin },
          },
        }),
        // R3 — Cestinha >= limiar (só a confirmada: PENDING_PAYMENT ainda não é compra)
        cestinhaMin === null
          ? Promise.resolve(0)
          : this.prisma.marketOrder.count({
              where: {
                userId,
                status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] },
                totalValue: { gte: cestinhaMin },
              },
            }),
        // R4a — pedidos únicos entregues desde o marco
        recorrenciaOn
          ? this.prisma.order.count({
              where: { userId, type: 'SINGLE', status: 'DELIVERED', deliveredAt: { gte: desde } },
            })
          : Promise.resolve(0),
        // R4b — Cestinhas entregues desde o marco
        recorrenciaOn
          ? this.prisma.marketOrder.count({
              where: { userId, status: 'DELIVERED', deliveredAt: { gte: desde } },
            })
          : Promise.resolve(0),
      ])

    const recorrenciaProgress = deliveredSingles + deliveredCestinhas
    const eligible =
      comboPurchases > 0 ||
      bigSingleOrders > 0 ||
      bigCestinhas > 0 ||
      (recorrenciaOn && recorrenciaProgress >= config.recorrenciaMin)

    return { eligible, recorrenciaProgress }
  }

  /**
   * Status do gancho para o app (Perfil → Meu gancho e o modal de consentimento).
   *
   * @throws { statusCode: 404 } se o usuário não for CLIENT
   */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    const config = await getGanchoConfig(this.prisma)
    const { pedidoUnicoMin, preco, recorrenciaMin } = config

    const [totalHooks, openHooks, latest, avulsoUnit] = await Promise.all([
      this.prisma.hookRequest.count({ where: { userId } }),
      this.prisma.hookRequest.count({
        where: { userId, status: { in: ['PENDING_PAYMENT', 'REQUESTED'] } },
      }),
      this.prisma.hookRequest.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          status: true,
          reason: true,
          requestedAt: true,
          deliveredAt: true,
          createdAt: true,
        },
      }),
      this.getAvulsoUnit(),
    ])

    const hasHook = totalHooks > 0

    // Curto-circuito: quem já tem gancho (de qualquer tipo, inclusive o BONUS do admin) não tem
    // direito ao grátis — não gasta as 5 queries de elegibilidade numa rota que roda no mount de
    // toda sessão de cliente.
    const free: FreeEligibility = hasHook
      ? { eligible: false, recorrenciaProgress: 0 }
      : await this.evaluateFree(userId, config, avulsoUnit)

    const needsConsent = free.eligible && !hasHook
    const canRequestPaid = hasHook && openHooks === 0

    return {
      hookPrice: preco,
      pedidoUnicoMin,
      cestinhaMinValue: avulsoUnit > 0 ? round2(pedidoUnicoMin * avulsoUnit) : 0,
      recorrenciaMin,
      recorrenciaProgress: free.recorrenciaProgress,
      freeEligible: free.eligible,
      hasHook,
      needsConsent,
      canRequestPaid,
      current: (latest as CurrentHook | null) ?? null,
    }
  }

  /**
   * Concede o gancho GRÁTIS após o consentimento do cliente (modal). Idempotente —
   * se o cliente já tem qualquer gancho, devolve o atual sem criar outro.
   *
   * @throws { statusCode: 404 } se o usuário não for CLIENT
   * @throws { statusCode: 422 } se o cliente ainda não atende ao critério do grátis
   */
  async requestHook(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true, apartment: true, block: true, complement: true },
    })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    // Idempotente / "grátis uma vez só": já tem gancho → não cria outro.
    const existing = await this.prisma.hookRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      return { hookRequestId: existing.id, status: existing.status, type: existing.type }
    }

    const config = await getGanchoConfig(this.prisma)
    const avulsoUnit = await this.getAvulsoUnit()
    const { eligible } = await this.evaluateFree(userId, config, avulsoUnit)
    if (!eligible) {
      throw { statusCode: 422, message: 'Você ainda não tem direito ao gancho grátis' }
    }

    const created = await this.prisma.hookRequest.create({
      data: { userId, type: 'FREE', status: 'REQUESTED', requestedAt: new Date() },
      select: { id: true, status: true, type: true },
    })

    // Aviso ao admin — best-effort.
    try {
      await new NotificationsService(this.fastify).notifyAdmins({
        type: NotificationType.ADMIN_HOOK_REQUESTED,
        title: 'Solicitação de gancho',
        body: `${clientLabel(user)} pediu o gancho grátis.`,
        actionRoute: '/admin',
      })
    } catch (err) {
      this.fastify.log.warn({ err }, '[client-hook] falha ao notificar admin — ignorado')
    }

    return { hookRequestId: created.id, status: created.status, type: created.type }
  }

  /**
   * Inicia a compra de um gancho ADICIONAL (Pix). Cria o pagamento (purpose HOOK) e um
   * HookRequest PAID em PENDING_PAYMENT vinculado. O gancho só entra na fila do admin
   * quando o pagamento confirma (credit-payment.ts, ramo HOOK).
   *
   * @throws { statusCode: 404 } se o usuário não for CLIENT
   * @throws { statusCode: 422 } se ainda não tem gancho, ou já há um gancho em andamento
   */
  async requestPaidHook(userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    const [totalHooks, openHooks] = await Promise.all([
      this.prisma.hookRequest.count({ where: { userId } }),
      this.prisma.hookRequest.count({
        where: { userId, status: { in: ['PENDING_PAYMENT', 'REQUESTED'] } },
      }),
    ])
    if (totalHooks === 0) {
      throw { statusCode: 422, message: 'Solicite primeiro o seu gancho grátis' }
    }
    if (openHooks > 0) {
      throw { statusCode: 422, message: 'Você já tem um gancho em andamento' }
    }

    // 1) Cria o pagamento Pix (externo). 2) Vincula o HookRequest. Se (2) falhar, o
    // cliente não recebe o QR e não paga — o pagamento PENDING órfão expira sozinho.
    const paymentsService = new PaymentsService(this.fastify)
    const pix = await paymentsService.createHookPix({ userId })

    const hook = await this.prisma.hookRequest.create({
      data: {
        userId,
        type: 'PAID',
        status: 'PENDING_PAYMENT',
        paymentId: pix.paymentId,
        reason: reason?.trim() || null,
      },
      select: { id: true },
    })

    return {
      hookRequestId: hook.id,
      paymentId: pix.paymentId,
      amount: pix.amount,
      pixCopyPaste: pix.pixCopyPaste,
      pixQrCodeUrl: pix.pixQrCodeUrl,
      expiresAt: pix.expiresAt,
    }
  }
}
