import { FastifyInstance } from 'fastify'
import { MercadoPagoConfig, Customer, CustomerCard, CardToken } from 'mercadopago'
import { SavedCardsRepository } from './saved-cards.repository.js'

export class SavedCardsService {
  private repo: SavedCardsRepository
  private customerApi: Customer
  private customerCardApi: CustomerCard
  private cardTokenApi: CardToken

  constructor(private fastify: FastifyInstance, repo: SavedCardsRepository) {
    this.repo = repo
    const mpClient = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      options: { timeout: 5000 },
    })
    this.customerApi = new Customer(mpClient)
    this.customerCardApi = new CustomerCard(mpClient)
    this.cardTokenApi = new CardToken(mpClient)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  // ── listCards ─────────────────────────────────────────────────────────────
  // CARD-01: retorna apenas cartões do usuário autenticado — query sempre filtra por userId
  listCards(userId: string) {
    return this.repo.findByUser(userId)
  }

  // ── getOrCreateMpCustomer ─────────────────────────────────────────────────
  // T-12-06: idempotente — verifica mpCustomerId no DB, busca no MP antes de criar
  async getOrCreateMpCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }

    // 1. Se já temos o ID do Customer MP no banco, retorna imediatamente
    if (user.mpCustomerId) {
      return user.mpCustomerId
    }

    // 2. Busca no MP antes de criar (evita duplicatas — T-12-06)
    const email = user.email ?? `${userId}@cheirin.app`
    const searchResult = await this.customerApi.search({ options: { email } })
    const existing = searchResult?.results?.[0]
    if (existing?.id) {
      await this.prisma.user.update({ where: { id: userId }, data: { mpCustomerId: existing.id } })
      return existing.id
    }

    // 3. Cria novo Customer no MP e persiste o ID
    const created = await this.customerApi.create({ body: { email } })
    if (!created?.id) throw { error: 'Falha ao criar cliente no Mercado Pago', status: 502 }

    await this.prisma.user.update({ where: { id: userId }, data: { mpCustomerId: created.id } })
    return created.id
  }

  // ── setDefault ────────────────────────────────────────────────────────────
  // T-12-01: valida IDOR antes de operar; T-12-05: usa $transaction para atomicidade
  async setDefault(cardId: string, userId: string) {
    const card = await this.repo.findById(cardId)
    // Retorna 404 mesmo se o cartão pertence a outro usuário — não revela existência (IDOR)
    if (!card || card.userId !== userId) {
      throw { error: 'Cartão não encontrado', status: 404 }
    }
    return this.repo.setDefault(cardId, userId)
  }

  // ── removeCard ────────────────────────────────────────────────────────────
  // T-12-01: valida IDOR antes de qualquer operação; MP remove primeiro, depois Prisma
  async removeCard(cardId: string, userId: string) {
    const card = await this.repo.findById(cardId)
    if (!card || card.userId !== userId) {
      throw { error: 'Cartão não encontrado', status: 404 }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.mpCustomerId) {
      throw { error: 'Cliente sem conta no Mercado Pago', status: 400 }
    }

    // CR-03: Remove no MP ANTES do Prisma — envolvido em try/catch para evitar que erros
    // do SDK do MP (inclusive síncronos) vazem detalhes internos para o cliente.
    try {
      await this.customerCardApi.remove({
        customerId: user.mpCustomerId,
        id: card.mpCardId,
      })
    } catch {
      // Log sanitizado — nunca expor campos internos da resposta MP em logs externos
      this.fastify.log.error({ mpCardId: card.mpCardId }, 'MP card removal failed')
      throw { error: 'Não foi possível remover o cartão no Mercado Pago. Tente novamente.', status: 502 }
    }

    // WR-04: passa userId para que o repositório inclua no predicado do delete (defesa em profundidade)
    await this.repo.deleteById(cardId, userId)
  }

  // ── createCardWithSaved ───────────────────────────────────────────────────
  // CARD-06: gera CardToken a partir do cartão salvo + CVV (CVV nunca persistido — T-12-02)
  async createCardWithSaved(params: {
    savedCardId: string
    securityCode: string
    userId: string
  }): Promise<{ token: string }> {
    const { savedCardId, securityCode, userId } = params

    const savedCard = await this.repo.findById(savedCardId)
    // T-12-01: IDOR — retorna 404 mesmo se cartão existe mas pertence a outro
    if (!savedCard || savedCard.userId !== userId) {
      throw { error: 'Cartão não encontrado', status: 404 }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    // Deve ter mpCustomerId para usar cartão salvo (T-12-02: CVV apenas no CardToken.create)
    if (!user?.mpCustomerId) {
      throw { error: 'Perfil de pagamento não encontrado. Realize uma compra nova primeiro.', status: 400 }
    }

    // Gera token de uso único — security_code descartado após esta chamada (T-12-02)
    const tokenResponse = await this.cardTokenApi.create({
      body: {
        card_id: savedCard.mpCardId,
        customer_id: user.mpCustomerId,
        security_code: securityCode,
      },
    })

    if (!tokenResponse?.id) {
      throw { error: 'Falha ao gerar token do cartão', status: 502 }
    }

    // Retorna token para payments.service usar no Payment.create — CVV não vai além daqui
    return { token: tokenResponse.id }
  }

  // ── saveNewCard ───────────────────────────────────────────────────────────
  // CARD-06: salva cartão após Payment.create bem-sucedido; T-12-03: limite de 3 enforçado aqui
  async saveNewCard(params: {
    userId: string
    mpCustomerId: string
    mpCardId: string
    brand: string
    lastFour: string
    expiresAt: string
  }) {
    const { userId, mpCustomerId, mpCardId, brand, lastFour, expiresAt } = params

    // T-12-03: verifica limite ANTES de chamar MP
    const count = await this.repo.countByUser(userId)
    if (count >= 3) {
      throw { error: 'Limite de 3 cartões atingido', status: 400 }
    }

    // Primeiro cartão = padrão automaticamente
    const isDefault = count === 0

    return this.repo.create({
      userId,
      mpCardId,
      brand: brand.toLowerCase(), // MP retorna lowercase; garantimos aqui
      lastFour,
      expiresAt,
      isDefault,
    })
  }
}
