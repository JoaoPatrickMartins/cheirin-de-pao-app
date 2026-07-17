import { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service.js'
import { PaymentsService } from '../payments/payments.service.js'
import { getGanchoConfig } from '../../lib/gancho-config.js'

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

/**
 * ClientHookService — gancho de porta pelo próprio cliente.
 *
 * Regras (fonte da verdade: coleção HookRequest):
 *  - GRÁTIS: 1 por cliente. Elegível ao comprar um combo OU fazer um pedido único
 *    com quantidade >= ganchoPedidoUnicoMin. Só vale enquanto o cliente não tem NENHUM
 *    gancho (needsConsent). A concessão passa pelo modal de consentimento (requestHook).
 *  - PAGO: após já ter um gancho, o cliente pode pagar (Pix) um gancho adicional
 *    (reposição por defeito/perda). Bloqueado enquanto houver um gancho em andamento.
 *  - BÔNUS: concedido pelo admin (módulo admin-hooks) — não passa por aqui.
 */
export class ClientHookService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** Elegibilidade ao gancho grátis: comprou combo OU pedido único >= mínimo configurado. */
  private async isFreeEligible(userId: string, pedidoUnicoMin: number): Promise<boolean> {
    const [comboPurchases, bigSingleOrders] = await Promise.all([
      this.prisma.payment.count({
        where: { userId, status: 'PAID', comboId: { not: null } },
      }),
      this.prisma.order.count({
        where: {
          userId,
          type: 'SINGLE',
          status: { not: 'CANCELLED' },
          quantity: { gte: pedidoUnicoMin },
        },
      }),
    ])
    return comboPurchases > 0 || bigSingleOrders > 0
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

    const { pedidoUnicoMin, preco } = await getGanchoConfig(this.prisma)

    const [totalHooks, openHooks, latest, freeEligible] = await Promise.all([
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
      this.isFreeEligible(userId, pedidoUnicoMin),
    ])

    const hasHook = totalHooks > 0
    const needsConsent = freeEligible && !hasHook
    const canRequestPaid = hasHook && openHooks === 0

    return {
      hookPrice: preco,
      pedidoUnicoMin,
      freeEligible,
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
      select: { role: true, name: true, apartment: true, block: true },
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

    const { pedidoUnicoMin } = await getGanchoConfig(this.prisma)
    const eligible = await this.isFreeEligible(userId, pedidoUnicoMin)
    if (!eligible) {
      throw { statusCode: 422, message: 'Você ainda não tem direito ao gancho grátis' }
    }

    const created = await this.prisma.hookRequest.create({
      data: { userId, type: 'FREE', status: 'REQUESTED', requestedAt: new Date() },
      select: { id: true, status: true, type: true },
    })

    // Aviso ao admin — best-effort.
    try {
      const loc = [user.block, user.apartment].filter(Boolean).join(' ')
      await new NotificationsService(this.fastify).notifyAdmins({
        type: NotificationType.ADMIN_HOOK_REQUESTED,
        title: 'Solicitação de gancho',
        body: `${user.name ?? 'Cliente'}${loc ? ` · Apto ${loc}` : ''} confirmou o recebimento do gancho.`,
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
