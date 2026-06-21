import { FastifyInstance } from 'fastify'
import { SavedCardsRepository } from './saved-cards.repository.js'
import { StripeService } from '../payments/stripe.service.js'

const CARD_LIMIT = 3

/**
 * Gestão de cartões salvos via Stripe.
 *
 * Fluxo de cadastro (substitui o token do MP):
 *  1. front pede um SetupIntent (createSetupIntent)
 *  2. front confirma com Stripe Elements (cartão coletado no navegador → SAQ-A);
 *     o PaymentMethod (pm_...) é anexado ao Customer com usage off_session
 *  3. front chama addCard(paymentMethodId) e nós persistimos o SavedCard
 *
 * Cobrança posterior é sem CVV (off_session) — ver payments.service.
 */
export class SavedCardsService {
  private repo: SavedCardsRepository
  private stripe: StripeService

  constructor(private fastify: FastifyInstance, repo: SavedCardsRepository) {
    this.repo = repo
    this.stripe = new StripeService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  // ── listCards ───────────────────────────────────────────────────────────────
  // CARD-01: retorna apenas cartões do usuário autenticado
  listCards(userId: string) {
    return this.repo.findByUser(userId)
  }

  // ── createSetupIntent ─────────────────────────────────────────────────────
  // Inicia o cadastro de cartão. Valida o limite antes de tocar no Stripe.
  async createSetupIntent(userId: string): Promise<{ clientSecret: string; customerId: string }> {
    const count = await this.repo.countByUser(userId)
    if (count >= CARD_LIMIT) {
      throw { error: 'Limite de 3 cartões atingido', status: 400 }
    }
    return this.stripe.createSetupIntent(userId)
  }

  // ── addCard ───────────────────────────────────────────────────────────────
  // CARD-07: persiste o cartão após o SetupIntent ser confirmado no front (Elements).
  // Recebe o paymentMethodId (pm_...) já anexado ao Customer.
  async addCard(params: { userId: string; paymentMethodId: string }) {
    const { userId, paymentMethodId } = params

    // T-12-03: valida limite antes
    const count = await this.repo.countByUser(userId)
    if (count >= CARD_LIMIT) {
      throw { error: 'Limite de 3 cartões atingido', status: 400 }
    }

    const customerId = await this.stripe.getOrCreateCustomer(userId)

    // Verifica que o PaymentMethod pertence ao customer deste usuário (anti-IDOR)
    let pm
    try {
      pm = await this.stripe.getPaymentMethod(paymentMethodId)
    } catch {
      this.fastify.log.error({ userId }, 'Stripe getPaymentMethod failed')
      throw { error: 'Não foi possível validar o cartão. Tente novamente.', status: 502 }
    }
    if (pm.customer !== customerId || pm.type !== 'card' || !pm.card) {
      throw { error: 'Cartão não encontrado', status: 404 }
    }

    // Dedup: se já persistido (reenvio), devolve o existente
    const existing = await this.repo.findByStripePaymentMethodId(paymentMethodId)
    if (existing) return existing

    // CR-01: recontagem pós-validação para evitar race no limite de 3
    const currentCount = await this.repo.countByUser(userId)
    if (currentCount >= CARD_LIMIT) {
      try {
        await this.stripe.detachPaymentMethod(paymentMethodId)
      } catch {
        this.fastify.log.error({ paymentMethodId }, 'Stripe detach failed after concurrent limit exceeded')
      }
      throw { error: 'Limite de 3 cartões atingido', status: 400 }
    }

    const isDefault = currentCount === 0
    const created = await this.repo.create({
      userId,
      stripePaymentMethodId: pm.id,
      brand: (pm.card.brand ?? '').toLowerCase(),
      lastFour: pm.card.last4 ?? '',
      expiresAt: `${pm.card.exp_year}-${String(pm.card.exp_month).padStart(2, '0')}`,
      isDefault,
    })

    // Primeiro cartão também vira o default do Customer no Stripe (usado no off_session)
    if (isDefault) {
      try {
        await this.stripe.setDefaultPaymentMethod(customerId, pm.id)
      } catch {
        this.fastify.log.warn({ paymentMethodId }, 'Stripe setDefault failed (não crítico)')
      }
    }

    // Consentimento p/ cobrança sem CVV (off_session): salvar o cartão via SetupIntent
    // usage=off_session é o momento do consentimento. Registra a 1ª vez.
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { offSessionConsentAt: true } })
    if (!user?.offSessionConsentAt) {
      await this.prisma.user.update({ where: { id: userId }, data: { offSessionConsentAt: new Date() } })
    }

    return created
  }

  // ── setDefault ──────────────────────────────────────────────────────────────
  // T-12-01: valida IDOR; T-12-05: atômico no banco; reflete no Customer do Stripe
  async setDefault(cardId: string, userId: string) {
    const card = await this.repo.findById(cardId)
    if (!card || card.userId !== userId) {
      throw { error: 'Cartão não encontrado', status: 404 }
    }
    const res = await this.repo.setDefault(cardId, userId)
    if (card.stripePaymentMethodId) {
      try {
        const customerId = await this.stripe.getOrCreateCustomer(userId)
        await this.stripe.setDefaultPaymentMethod(customerId, card.stripePaymentMethodId)
      } catch {
        this.fastify.log.warn({ cardId }, 'Stripe setDefault failed (não crítico)')
      }
    }
    return res
  }

  // ── removeCard ────────────────────────────────────────────────────────────
  // T-12-01: valida IDOR; faz detach no Stripe antes de apagar localmente.
  // Se o cartão removido alimenta a recarga automática, desativa-a (segurança).
  async removeCard(cardId: string, userId: string) {
    const card = await this.repo.findById(cardId)
    if (!card || card.userId !== userId) {
      throw { error: 'Cartão não encontrado', status: 404 }
    }

    if (card.stripePaymentMethodId) {
      try {
        await this.stripe.detachPaymentMethod(card.stripePaymentMethodId)
      } catch (err) {
        // Se já não existe no Stripe, segue para apagar o registro local (sem órfão)
        const code = (err as { statusCode?: number })?.statusCode
        if (code !== 404) {
          this.fastify.log.error({ cardId }, 'Stripe detach failed')
          throw { error: 'Não foi possível remover o cartão. Tente novamente.', status: 502 }
        }
      }
    }

    await this.repo.deleteById(cardId, userId)

    // Se este era o cartão padrão e a recarga automática estava ativa, desativa-a
    // para não falhar silenciosamente no corte (consentimento vinculado ao cartão).
    if (card.isDefault) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } })
      const ar = user?.autoRecharge as { active?: boolean } | null
      if (ar?.active) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { autoRecharge: { ...ar, active: false } },
        })
      }
    }
  }
}
