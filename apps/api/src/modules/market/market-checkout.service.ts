import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import type { MarketCheckoutInput } from '@cheirin-de-pao/shared'
import { brtNoonFromStr, brtDateStr, dayKeyOf, isPastCutoffForDelivery } from '../../lib/cutoff.js'
import { getAgendaRestrictions, isDayBlocked } from '../../lib/agenda-restrictions.js'
import { countCommittedDeliveries } from '../../lib/schedule-projection.js'
import { MARKET_CARTAO_MIN_KEY, isCardBelowMinimum, parseCartaoMinimo } from '../../lib/market-card-policy.js'
import { buildStockAlerts, type StockSnapshot } from '../../lib/market-stock-alerts.js'
import { PaymentsService } from '../payments/payments.service.js'
import { MarketRepository } from './market.repository.js'
import { notifyAdminLowStock, notifyAdminMarketOrderPlaced, notifyMarketCancelled } from './market-notify.js'

const AVULSO_KEY = 'avulsoUnit'
const MIN_CESTINHA_KEY = 'marketMinimoCestinha'
const DEFAULT_MIN_CESTINHA = 15
const PEDIDO_MINIMO_UNICO_KEY = 'pedidoMinimoUnico'
const BREAD_PRODUCT_KEY = 'breadProductId'
const WEEKDAY_PT: Record<string, string> = {
  seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta', sab: 'sábado', dom: 'domingo',
}

const round2 = (n: number) => Math.round(n * 100) / 100
const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface CheckoutResult {
  marketOrderId: string
  status: string
  totalValue: number
  creditsApplied: number
  moneyAmount: number
  scheduledDate: string
  slotId: string
  deliveryTime: string | null
  breadQty: number
  payment?: {
    method: 'pix' | 'card'
    paymentId: string
    status: 'pending' | 'approved'
    pixCopyPaste?: string
    pixQrCodeUrl?: string
    expiresAt?: string | null
    clientSecret?: string | null
  }
}

/**
 * MarketCheckoutService — finaliza a Cestinha (produtos + pães do add-on). Lê o carrinho no
 * servidor, valida (mínimo, corte do slot, availableDays, estoque), **recalcula o total no
 * servidor**, reserva estoque atomicamente + debita crédito + cria o `MarketOrder` numa
 * transação; se sobra dinheiro cria o `Payment` (purpose MARKET) via Pix/cartão; limpa a
 * Cestinha no sucesso. Idempotente por `idempotencyKey`. Falha síncrona do gateway → compensa.
 */
export class MarketCheckoutService {
  private repo: MarketRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new MarketRepository(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  async checkout(userId: string, input: MarketCheckoutInput): Promise<CheckoutResult> {
    // 1. Idempotência — mesma chave = mesmo pedido (duplo-clique / retry).
    const existing = await this.prisma.marketOrder.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) return this.buildResult(existing)

    // 2. Cestinha no servidor. O produto-pão só existe como breadQty — nunca como item.
    const cart = await this.repo.getCart(userId)
    const breadRow = await this.repo.getSetting(BREAD_PRODUCT_KEY)
    const breadProductId = breadRow?.value ?? null
    const rawItems = (cart?.items ?? [])
      .filter((i) => i.productId !== breadProductId)
      .map((i) => ({ productId: i.productId, qty: Math.max(1, Math.min(99, i.qty)) }))
    const breadQty = Math.max(0, Math.min(100, cart?.breadQty ?? 0))
    if (rawItems.length === 0 && breadQty === 0) {
      throw { statusCode: 400, message: 'Sua Cestinha está vazia.' }
    }

    // 3. Usuário + condomínio.
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { statusCode: 404, message: 'Usuário não encontrado' }
    if (!user.condominiumId) throw { statusCode: 400, message: 'Cadastre seu condomínio para receber entregas.' }

    // 4. Precificação.
    const avulsoUnit = await this.getNumberSetting(AVULSO_KEY, 0)
    if (!(avulsoUnit > 0)) throw { statusCode: 500, message: 'Preço avulso não configurado.' }
    const minimo = await this.getNumberSetting(MIN_CESTINHA_KEY, DEFAULT_MIN_CESTINHA)

    // 5. Produtos (snapshot + validação de existência/ativação).
    const products = await this.repo.findProductsByIds(rawItems.map((i) => i.productId))
    const byId = new Map(products.map((p) => [p.id, p]))
    const lines = rawItems.map((it) => {
      const product = byId.get(it.productId)
      if (!product || !product.isActive) {
        throw { statusCode: 409, message: 'Um item saiu do catálogo. Revise a Cestinha.' }
      }
      // Teto por pedido (DAILY = capacidade/dia; FIXED = estoque). Clampa aqui também para não
      // barrar Cestinhas antigas acima do teto — o front já limita o stepper por esse valor.
      const cap = product.stockType === 'FIXED' ? Math.max(0, product.stock ?? 0) : Math.max(0, product.dailyCapacity ?? 0)
      const qty = cap > 0 ? Math.min(it.qty, cap) : it.qty
      return { product, qty }
    })

    // 6. Slot + corte.
    const dateStr = input.scheduledDate.slice(0, 10)
    const scheduledDate = brtNoonFromStr(dateStr)
    const condo = await this.prisma.condominium.findUnique({
      where: { id: user.condominiumId },
      select: { deliverySlots: true },
    })
    const slots = (condo?.deliverySlots ?? []).filter((s) => s.isActive)
    const slot = slots.find((s) => (s.slotId ?? s.name) === input.slotId)
    if (!slot) throw { statusCode: 400, message: 'Horário de entrega indisponível.' }
    if (isPastCutoffForDelivery(slot.time, slot.cutoffTime, dateStr)) {
      throw { statusCode: 400, message: 'O prazo para esse horário de entrega já encerrou.' }
    }

    // 7. Disponibilidade por dia da semana.
    const dayKey = dayKeyOf(scheduledDate)
    for (const { product } of lines) {
      const days = (product.availableDays as string[] | null) ?? []
      if (days.length > 0 && !days.includes(dayKey)) {
        throw { statusCode: 422, message: `${product.name} não está disponível na ${WEEKDAY_PT[dayKey]}.` }
      }
    }

    // 7.5. Restrições do admin por dia da semana — MESMA regra do pedido único e da agenda
    // (getAgendaRestrictions): dia bloqueado nunca aceita entrega; com limite ativo, barra
    // quando as entregas comprometidas do dia atingem o teto. A contagem já inclui Cestinhas
    // (por parada userId+slotId), então a Cestinha respeita e consome o limite igual ao pão.
    // Backend é a autoridade — o front só sugere a régua de dias.
    const { blocked, limits } = await getAgendaRestrictions(this.prisma)
    if (isDayBlocked(blocked, dayKey)) {
      throw { statusCode: 422, message: 'Não há entregas neste dia da semana.' }
    }
    if (limits[dayKey] > 0) {
      const committed = await countCommittedDeliveries(this.prisma, scheduledDate)
      if (committed >= limits[dayKey]) {
        throw { statusCode: 422, message: 'O limite de pedidos para este dia foi atingido.' }
      }
    }

    // 8. Estoque (pré-checagem amigável; a reserva real é atômica na transação). Mensagem
    // acionável: diz quantas unidades ainda cabem no dia (ou no estoque), em vez de "sem vagas".
    for (const { product, qty } of lines) {
      if (product.stockType === 'FIXED') {
        const stock = Math.max(0, product.stock ?? 0)
        if (stock < qty) {
          throw { statusCode: 409, message: stock <= 0
            ? `${product.name} está esgotado.`
            : `${product.name}: resta${stock === 1 ? '' : 'm'} só ${stock} em estoque.` }
        }
      } else {
        const cap = product.dailyCapacity ?? 0
        const ds = await this.prisma.productDailyStock.findUnique({
          where: { productId_date: { productId: product.id, date: dateStr } },
        })
        const available = Math.max(0, cap - (ds?.reserved ?? 0))
        if (qty > available) {
          throw { statusCode: 409, message: available <= 0
            ? `${product.name} está sem vagas para esse dia.`
            : `${product.name}: resta${available === 1 ? '' : 'm'} só ${available} para esse dia.` }
        }
      }
    }

    // 9. Total (recalculado no servidor) + mínimo (segue o pedido único p/ o pão).
    const productSubtotal = round2(lines.reduce((acc, l) => acc + l.product.price * l.qty, 0))
    const total = round2(productSubtotal + breadQty * avulsoUnit)
    const hasProducts = lines.length > 0
    // Pão Francês: quantidade mínima herdada do pedido único (pedidoMinimoUnico).
    const breadMin = Math.max(1, Math.floor(await this.getNumberSetting(PEDIDO_MINIMO_UNICO_KEY, 1)))
    if (breadQty > 0 && breadQty < breadMin) {
      throw { statusCode: 422, message: `O pedido mínimo de pães é ${breadMin === 1 ? '1 pão' : `${breadMin} pães`}.` }
    }
    // Mínimo em R$ da Cestinha só quando há produtos (carrinho só de pão é isento).
    if (hasProducts && total < minimo) {
      throw { statusCode: 422, message: `O pedido mínimo da Cestinha é ${fmtBRL(minimo)}.` }
    }

    // 10. Split crédito × dinheiro (servidor é autoridade; cliente só sugere).
    const maxCredits = Math.floor(total / avulsoUnit)
    const creditsApplied = Math.max(0, Math.min(input.creditsApplied, user.creditBalance ?? 0, maxCredits))
    const moneyAmount = round2(total - creditsApplied * avulsoUnit)
    if (moneyAmount > 0 && !input.paymentMethod) {
      throw { statusCode: 400, message: 'Escolha a forma de pagamento da parte em dinheiro.' }
    }
    // Política de cartão (admin): abaixo do mínimo configurado, a parte em dinheiro só via Pix.
    const cartaoMinimo = parseCartaoMinimo((await this.repo.getSetting(MARKET_CARTAO_MIN_KEY))?.value)
    if (input.paymentMethod === 'card' && isCardBelowMinimum(moneyAmount, cartaoMinimo)) {
      throw {
        statusCode: 422,
        message: `Pagamento com cartão disponível a partir de ${fmtBRL(cartaoMinimo)}. Use Pix para valores menores.`,
      }
    }

    const orderStatus = moneyAmount > 0 ? 'PENDING_PAYMENT' : 'SCHEDULED'
    const itemsSnapshot = lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      qty: l.qty,
      unitPrice: l.product.price,
    }))

    // 11. Transação: reserva estoque → cria pedido → debita crédito.
    let order: Awaited<ReturnType<typeof this.createOrderTx>>
    try {
      order = await this.createOrderTx({
        userId,
        condominiumId: user.condominiumId,
        scheduledDate,
        dateStr,
        slotId: input.slotId,
        deliveryTime: slot.time,
        status: orderStatus,
        breadQty,
        lines,
        itemsSnapshot,
        total,
        creditsApplied,
        moneyAmount,
        idempotencyKey: input.idempotencyKey,
      })
    } catch (err) {
      // Corrida de idempotência (duplo-clique simultâneo) → devolve o pedido já criado.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const dup = await this.prisma.marketOrder.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
        if (dup) return this.buildResult(dup)
      }
      throw err
    }

    // F5 — a reserva já aconteceu: avalia se algum produto cruzou o limiar de estoque. Vale
    // também para `PENDING_PAYMENT`, porque a reserva bloqueia o item para os próximos clientes
    // (se o sweep devolver o estoque depois, o próximo pedido que cruzar o limiar avisa de novo).
    await this.alertStockAfterReserve(lines, dateStr)

    // 12. 100% crédito → já confirmado; limpa a Cestinha.
    if (moneyAmount === 0) {
      // F4: confirmado agora, sem passar pelo gateway → o admin já pode contar com este pedido.
      await notifyAdminMarketOrderPlaced(this.fastify, order)
      await this.repo.upsertCart(userId, [], 0)
      return this.buildResult(order)
    }

    // 13. Parte em dinheiro → gateway. Falha síncrona ao criar → compensa (libera + estorna + cancela).
    const payments = new PaymentsService(this.fastify)
    try {
      if (input.paymentMethod === 'pix') {
        const pix = await payments.createMarketPix({ userId, amount: moneyAmount, marketOrderId: order.id })
        await this.repo.upsertCart(userId, [], 0)
        return { ...this.buildResult(order), payment: { method: 'pix', ...pix } }
      }
      const card = await payments.createMarketCard({
        userId,
        amount: moneyAmount,
        marketOrderId: order.id,
        savedCardId: input.savedCardId,
      })
      await this.repo.upsertCart(userId, [], 0)
      return { ...this.buildResult(order), payment: { method: 'card', ...card } }
    } catch (err) {
      await this.releaseOrder(order.id).catch((e) =>
        this.fastify.log.error({ e, orderId: order.id }, '[market] falha ao compensar pedido após erro de pagamento'),
      )
      throw err
    }
  }

  /**
   * F5 — relê o estoque DEPOIS da reserva e avisa os admins se algum produto cruzou o limiar.
   *
   * O "consumido" é a quantidade desta reserva, então `buildStockAlerts` sabe distinguir "caiu
   * para 4 agora" de "já estava em 4" — sem isso, toda venda seguinte repetiria o mesmo aviso.
   * Best-effort: um erro aqui não pode derrubar um checkout já efetivado.
   */
  private async alertStockAfterReserve(
    lines: { product: { id: string; name: string; stockType: string; dailyCapacity: number | null }; qty: number }[],
    dateStr: string,
  ): Promise<void> {
    try {
      const snapshots: StockSnapshot[] = []
      for (const { product, qty } of lines) {
        if (product.stockType === 'FIXED') {
          const p = await this.prisma.product.findUnique({ where: { id: product.id }, select: { stock: true } })
          if (!p) continue
          snapshots.push({
            productId: product.id,
            name: product.name,
            stockType: 'FIXED',
            availableAfter: Math.max(0, p.stock ?? 0),
            consumed: qty,
          })
        } else {
          // Sem capacidade configurada não existe limiar a cruzar (produto ilimitado no dia).
          const cap = product.dailyCapacity ?? 0
          if (cap <= 0) continue
          const ds = await this.prisma.productDailyStock.findUnique({
            where: { productId_date: { productId: product.id, date: dateStr } },
          })
          snapshots.push({
            productId: product.id,
            name: product.name,
            stockType: 'DAILY',
            availableAfter: Math.max(0, cap - (ds?.reserved ?? 0)),
            consumed: qty,
            date: dateStr,
          })
        }
      }
      await notifyAdminLowStock(this.fastify, buildStockAlerts(snapshots))
    } catch (err) {
      this.fastify.log.warn({ err }, '[market] falha ao avaliar alerta de estoque — ignorado')
    }
  }

  // Transação de criação: reserva estoque atomicamente, cria o MarketOrder e debita o crédito.
  private createOrderTx(args: {
    userId: string
    condominiumId: string
    scheduledDate: Date
    dateStr: string
    slotId: string
    deliveryTime: string
    status: string
    breadQty: number
    lines: { product: { id: string; name: string; stockType: string; stock: number | null; dailyCapacity: number | null }; qty: number }[]
    itemsSnapshot: { productId: string; name: string; qty: number; unitPrice: number }[]
    total: number
    creditsApplied: number
    moneyAmount: number
    idempotencyKey: string
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Saldo suficiente (re-checado dentro da transação).
      const u = await tx.user.findUnique({ where: { id: args.userId } })
      if (!u || (u.creditBalance ?? 0) < args.creditsApplied) {
        throw { statusCode: 400, message: 'Créditos insuficientes.' }
      }

      // Reserva atômica de estoque (decremento condicional — evita vender o último item 2×).
      for (const { product, qty } of args.lines) {
        if (product.stockType === 'FIXED') {
          const r = await tx.product.updateMany({
            where: { id: product.id, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          })
          if (r.count === 0) throw { statusCode: 409, message: `${product.name} esgotou. Revise a Cestinha.` }
        } else {
          const cap = product.dailyCapacity ?? 0
          await tx.productDailyStock.upsert({
            where: { productId_date: { productId: product.id, date: args.dateStr } },
            create: { productId: product.id, date: args.dateStr, reserved: 0 },
            update: {},
          })
          const r = await tx.productDailyStock.updateMany({
            where: { productId: product.id, date: args.dateStr, reserved: { lte: cap - qty } },
            data: { reserved: { increment: qty } },
          })
          if (r.count === 0) throw { statusCode: 409, message: `${product.name} esgotou para esse dia. Revise a Cestinha.` }
        }
      }

      // Cria o pedido.
      const created = await tx.marketOrder.create({
        data: {
          userId: args.userId,
          condominiumId: args.condominiumId,
          scheduledDate: args.scheduledDate,
          slotId: args.slotId,
          deliveryTime: args.deliveryTime,
          status: args.status as never,
          breadQty: args.breadQty,
          items: { set: args.itemsSnapshot },
          totalValue: args.total,
          creditsApplied: args.creditsApplied,
          moneyAmount: args.moneyAmount,
          idempotencyKey: args.idempotencyKey,
        },
      })

      // Debita crédito (ledger com referenceId = pedido, para estorno idempotente futuro).
      if (args.creditsApplied > 0) {
        await tx.user.update({
          where: { id: args.userId },
          data: { creditBalance: { decrement: args.creditsApplied } },
        })
        await tx.creditTransaction.create({
          data: {
            userId: args.userId,
            type: 'MARKET_PURCHASE',
            quantity: -args.creditsApplied,
            referenceId: created.id,
            description: 'Cestinha — Além do Pãozin',
          },
        })
      }

      return created
    })
  }

  /**
   * Compensação: libera estoque, devolve os créditos aplicados (MARKET_REFUND) e cancela o
   * pedido. Usada quando o gateway falha ao iniciar o pagamento e pelo sweep do cron (a parte em
   * dinheiro nunca foi cobrada nos dois casos). (Cancelamento pós-corte = Onda 6 / admin.)
   *
   * **A transição é um claim atômico e é ela que define quem "liberou" o pedido** (Onda F): o
   * `updateMany` guardado por `status: { not: CANCELLED }` é a primeira operação da transação, e
   * quem perde a corrida sai antes de tocar estoque ou crédito. O cron roda a cada minuto sem
   * trava de execução, então duas passadas podem ver o mesmo pedido preso — sem o claim, as duas
   * devolveriam estoque e crédito, e o cliente receberia dois avisos de cancelamento.
   *
   * @returns `released: false` quando outro caminho já havia cancelado (nada foi alterado aqui).
   */
  private async releaseOrder(
    orderId: string,
    reason = 'Falha ao iniciar o pagamento',
  ): Promise<{ released: boolean; refundedCredits: number }> {
    const order = await this.prisma.marketOrder.findUnique({ where: { id: orderId } })
    if (!order || order.status === 'CANCELLED') return { released: false, refundedCredits: 0 }
    const dateStr = brtDateStr(order.scheduledDate)

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.marketOrder.updateMany({
        where: { id: orderId, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      })
      // Perdeu a corrida — nada foi tocado ainda, então sair aqui não deixa efeito parcial.
      if (claim.count === 0) return { released: false, refundedCredits: 0 }

      for (const it of order.items) {
        const p = await tx.product.findUnique({ where: { id: it.productId } })
        if (!p) continue
        if (p.stockType === 'FIXED') {
          await tx.product.update({ where: { id: p.id }, data: { stock: { increment: it.qty } } })
        } else {
          await tx.productDailyStock.updateMany({
            where: { productId: p.id, date: dateStr },
            data: { reserved: { decrement: it.qty } },
          })
        }
      }
      if (order.creditsApplied > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { creditBalance: { increment: order.creditsApplied } },
        })
        await tx.creditTransaction.create({
          data: {
            userId: order.userId,
            type: 'MARKET_REFUND',
            quantity: order.creditsApplied,
            referenceId: order.id,
            description: 'Cestinha não concluída — créditos devolvidos',
          },
        })
      }
      return { released: true, refundedCredits: order.creditsApplied }
    })
  }

  /**
   * Sweep de pagamentos presos: `MarketOrder` em `PENDING_PAYMENT` além do TTL (Pix
   * expirado/abandonado ou recusado — casos que os webhooks/pull não revertem) → `releaseOrder`
   * (libera estoque + devolve os créditos aplicados + cancela). Idempotente; roda no cron.
   *
   * **F1 — avisa o cliente.** Este cancelamento é automático e invisível: o pedido desaparece do
   * app, o crédito volta ao saldo e até a Onda F ninguém dizia nada. O aviso sai **só** quando o
   * claim de `releaseOrder` foi desta passada, então reprocessar não duplica o push.
   *
   * O admin NÃO é avisado aqui, de propósito: um pedido que morreu aguardando pagamento nunca
   * entrou na operação (`CONFIRMED_MARKET_STATUSES` exclui `PENDING_PAYMENT`), logo não há fornada
   * nem separação para corrigir. É a mesma paridade do pão, onde um Pix abandonado não cria Order.
   */
  async sweepStuckPayments(ttlMinutes = 30, now: Date = new Date()): Promise<{ released: number }> {
    const cutoff = new Date(now.getTime() - ttlMinutes * 60 * 1000)
    const stuck = await this.prisma.marketOrder.findMany({
      where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
      select: { id: true, userId: true, scheduledDate: true },
    })
    let released = 0
    for (const o of stuck) {
      try {
        const r = await this.releaseOrder(o.id, 'Pagamento não concluído no prazo')
        if (!r.released) continue
        released += 1
        await notifyMarketCancelled(this.fastify, o, {
          cause: 'PAYMENT',
          refundedCredits: r.refundedCredits,
        })
      } catch (err) {
        this.fastify.log.error({ err, orderId: o.id }, '[market] sweep: falha ao liberar pedido preso')
      }
    }
    if (released > 0) this.fastify.log.info(`[market] sweep liberou ${released} Cestinha(s) presa(s) em PENDING_PAYMENT`)
    return { released }
  }

  private async getNumberSetting(key: string, fallback: number): Promise<number> {
    const s = await this.repo.getSetting(key)
    const v = s ? parseFloat(s.value) : fallback
    return Number.isFinite(v) ? v : fallback
  }

  private buildResult(order: {
    id: string
    status: string
    totalValue: number
    creditsApplied: number
    moneyAmount: number
    scheduledDate: Date
    slotId: string
    deliveryTime: string | null
    breadQty: number
  }): CheckoutResult {
    return {
      marketOrderId: order.id,
      status: order.status,
      totalValue: order.totalValue,
      creditsApplied: order.creditsApplied,
      moneyAmount: order.moneyAmount,
      scheduledDate: brtDateStr(order.scheduledDate),
      slotId: order.slotId,
      deliveryTime: order.deliveryTime,
      breadQty: order.breadQty,
    }
  }
}
