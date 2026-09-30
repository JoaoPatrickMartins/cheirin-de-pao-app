import { PrismaClient, type ExpenseGroup } from '@prisma/client'
import { REFERRAL_DEFAULTS, REFERRAL_SETTING_KEYS } from '../lib/referral-config.js'

/**
 * seedDefaultsIfAbsent — garante valores padrão no banco quando o admin ainda não configurou.
 *
 * Idempotente e NÃO destrutivo:
 *  - Settings `avulsoUnit` / `avulsoLimite`: upsert com `update: {}` → cria só se ausente,
 *    preservando qualquer valor que o admin já tenha definido.
 *  - Combo padrão: criado apenas quando NÃO existe nenhum combo cadastrado.
 *
 * O admin pode editar/corrigir tudo depois (PATCH /admin/settings/avulso, CRUD /admin/combos).
 */
export async function seedDefaultsIfAbsent(prisma: PrismaClient): Promise<void> {
  // Preço do pão avulso — default R$ 1,00
  await prisma.setting.upsert({
    where: { key: 'avulsoUnit' },
    update: {},
    create: { key: 'avulsoUnit', value: '1.00' },
  })

  // Limite de pães por compra avulsa personalizada — default 20
  await prisma.setting.upsert({
    where: { key: 'avulsoLimite' },
    update: {},
    create: { key: 'avulsoLimite', value: '20' },
  })

  // Pedido mínimo do PEDIDO ÚNICO — default 1 (preserva o comportamento atual: qtd >= 1).
  await prisma.setting.upsert({
    where: { key: 'pedidoMinimoUnico' },
    update: {},
    create: { key: 'pedidoMinimoUnico', value: '1' },
  })

  // Pedido mínimo da AGENDA por dia da semana (aplica-se por turno quando a qtd do dia > 0).
  // default 1 em todos os dias — preserva o comportamento atual (qtd > 0 sempre foi >= 1).
  await prisma.setting.upsert({
    where: { key: 'pedidoMinimoAgenda' },
    update: {},
    create: {
      key: 'pedidoMinimoAgenda',
      value: JSON.stringify({ seg: 1, ter: 1, qua: 1, qui: 1, sex: 1, sab: 1, dom: 1 }),
    },
  })

  // Gancho grátis — quantidade mínima de pães num PEDIDO ÚNICO para o cliente ganhar o
  // gancho de porta gratuito (a compra de combo sempre dá direito, independente da qtd).
  // default 10 — o admin ajusta em Gestão → Gancho.
  await prisma.setting.upsert({
    where: { key: 'ganchoPedidoUnicoMin' },
    update: {},
    create: { key: 'ganchoPedidoUnicoMin', value: '10' },
  })

  // Preço de um gancho ADICIONAL (reposição por defeito/perda) — cobrado via Pix.
  // default R$ 5,00 — o admin ajusta em Gestão → Gancho.
  await prisma.setting.upsert({
    where: { key: 'ganchoPreco' },
    update: {},
    create: { key: 'ganchoPreco', value: '5.00' },
  })

  // Gancho grátis por FIDELIDADE — pedidos entregues (pedido único + Cestinha) que dão direito
  // ao gancho. default 0 = regra DESLIGADA: só passa a valer quando o admin definir o número em
  // Gestão → Gancho. O marco de vigência (ganchoRecorrenciaDesde) NÃO é semeado de propósito —
  // sua ausência é o sinal de "regra nunca foi ligada", e ele é gravado na primeira ativação.
  await prisma.setting.upsert({
    where: { key: 'ganchoRecorrenciaMin' },
    update: {},
    create: { key: 'ganchoRecorrenciaMin', value: '0' },
  })

  // Dias bloqueados para agendamento — PADRÃO da operação, default nenhum dia bloqueado.
  // true = dia sem entregas (pedido único, agenda, Cestinha e corte). Cada condomínio pode
  // sobrescrever (Condominium.blockedDaysOverride); sem override, herda este padrão.
  await prisma.setting.upsert({
    where: { key: 'diasBloqueados' },
    update: {},
    create: {
      key: 'diasBloqueados',
      value: JSON.stringify({ seg: false, ter: false, qua: false, qui: false, sex: false, sab: false, dom: false }),
    },
  })

  // Limite de pedidos por dia da semana — PADRÃO da operação, default 0 (ilimitado) em todos os
  // dias. Positivo = teto de entregas naquele dia. Quando resolvido para um condomínio, o teto
  // conta apenas as entregas DAQUELE condomínio (ver countCommittedDeliveries). Cada condomínio
  // pode sobrescrever (Condominium.dayLimitOverride); sem override, herda este padrão.
  await prisma.setting.upsert({
    where: { key: 'limitePedidosDia' },
    update: {},
    create: {
      key: 'limitePedidosDia',
      value: JSON.stringify({ seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }),
    },
  })

  // Combo padrão — só quando não há nenhum combo (unidade < preço avulso, como manda a regra)
  const combosCount = await prisma.combo.count()
  if (combosCount === 0) {
    await prisma.combo.create({
      data: {
        name: 'Combo 10 Pãezinhos',
        quantity: 10,
        price: 9.0, // R$ 0,90/unid — abaixo do avulso (R$ 1,00)
        tag: 'Mais popular',
        description: 'O essencial do dia',
        showEconomy: true, // economia calculada vs. avulso (R$ 0,90/unid < R$ 1,00)
        isActive: true,
      },
    })
    console.log('[bootstrap] Combo padrão criado (Combo 10 Pãezinhos)')
  }

  // ── Mini market "Além do Pãozin" ──────────────────────────────────────────
  // Mínimo da Cestinha (R$) — pedido do mercadinho abaixo disso fica bloqueado no checkout.
  // default R$ 15,00 — o admin ajusta em Gestão → Além do Pãozin.
  await prisma.setting.upsert({
    where: { key: 'marketMinimoCestinha' },
    update: {},
    create: { key: 'marketMinimoCestinha', value: '15.00' },
  })

  // Valor mínimo (R$) da parte EM DINHEIRO para liberar cartão de crédito na Cestinha; abaixo
  // disso só Pix. default '0' = cartão sempre liberado (regra desligada). Admin ajusta em
  // Gestão → Além do Pãozin.
  await prisma.setting.upsert({
    where: { key: 'marketCartaoMinimo' },
    update: {},
    create: { key: 'marketCartaoMinimo', value: '0' },
  })

  // Categorias padrão do mini market — criadas apenas quando NÃO há nenhuma categoria.
  // O admin pode criar/editar/excluir depois (CRUD /admin/market/categories).
  const categoriesCount = await prisma.productCategory.count()
  if (categoriesCount === 0) {
    await prisma.productCategory.createMany({
      data: [
        { name: 'Geleias & Mel', emoji: '🍯', sortOrder: 0 },
        { name: 'Bolos & Doces', emoji: '🍰', sortOrder: 1 },
        { name: 'Pão de Queijo & Salgados', emoji: '🧀', sortOrder: 2 },
        { name: 'Bebidas', emoji: '🥤', sortOrder: 3 },
        { name: 'Frios & Frescos', emoji: '🥓', sortOrder: 4 },
        { name: 'Especiais', emoji: '🎁', sortOrder: 5 },
      ],
    })
    console.log('[bootstrap] 6 categorias padrão do mini market criadas')
  }

  // Pão Francês — produto FIXO da Cestinha (o mesmo pão do pedido único, em outro fluxo).
  // Categoria "Pães" + produto marcado pelo Setting `breadProductId`. O admin configura só a
  // apresentação (foto/descrição/dias); o PREÇO vem sempre do `avulsoUnit` (o catálogo sobrescreve)
  // e o MÍNIMO segue o `pedidoMinimoUnico`. A COMPRA continua pelo `breadQty` (vira MarketOrder).
  const breadIdRow = await prisma.setting.findUnique({ where: { key: 'breadProductId' } })
  const existingBread = breadIdRow
    ? await prisma.product.findUnique({ where: { id: breadIdRow.value } })
    : null
  if (!existingBread) {
    let paesCat = await prisma.productCategory.findFirst({ where: { name: 'Pães' } })
    if (!paesCat) {
      paesCat = await prisma.productCategory.create({ data: { name: 'Pães', emoji: '🥖', sortOrder: -1 } })
      console.log('[bootstrap] categoria "Pães" criada')
    }
    const avulsoRow = await prisma.setting.findUnique({ where: { key: 'avulsoUnit' } })
    const price = avulsoRow ? parseFloat(avulsoRow.value) : 1
    const bread = await prisma.product.create({
      data: {
        name: 'Pão Francês',
        description: 'Nosso pãozinho de todo dia, quentinho na sua porta.',
        categoryId: paesCat.id,
        price: Number.isFinite(price) && price > 0 ? price : 1,
        stockType: 'DAILY',
        dailyCapacity: 1_000_000, // sempre disponível; a compra não reserva estoque (usa breadQty)
        availableDays: [] as unknown as object,
        isActive: true,
        sortOrder: -1,
      },
    })
    await prisma.setting.upsert({
      where: { key: 'breadProductId' },
      update: { value: bread.id },
      create: { key: 'breadProductId', value: bread.id },
    })
    console.log('[bootstrap] produto fixo "Pão Francês" criado')
  }
}

/**
 * Alíquotas de taxa de gateway (Fase 3 do plano-financeiro-vendas).
 *
 * Semeadas com as tabelas públicas de referência, e é o que permite a linha "taxa de gateway" do
 * DRE funcionar RETROATIVAMENTE sobre todo o histórico — sem elas o relatório nasceria com meses
 * em branco. Cada conta negocia a sua taxa, então o admin ajusta pelas Configurações.
 *
 * `update: {}` no upsert: cria só se ausente, nunca sobrescreve o que o admin já ajustou.
 */
export async function seedGatewayFeeRates(prisma: PrismaClient): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_FEE_PCT_BY_KEY)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    })
  }
}

/**
 * Config do Indique e Ganhe (§6 do plano-indique-e-ganhe) — o programa nasce DESLIGADO.
 *
 * Os valores saem de `REFERRAL_DEFAULTS`, os mesmos que a leitura defensiva usa quando a chave falta:
 * semente e fallback nunca divergem. Campanha e metas são JSON (`null` e `[]`).
 *
 * `update: {}` no upsert: cria só se ausente, nunca sobrescreve o que o admin já configurou.
 */
export async function seedReferralDefaults(prisma: PrismaClient): Promise<void> {
  const d = REFERRAL_DEFAULTS
  const values: Record<keyof typeof REFERRAL_SETTING_KEYS, string> = {
    ativa: String(d.ativa),
    recompensa: String(d.recompensa),
    bonusIndicado: String(d.bonusIndicado),
    compraMinima: String(d.compraMinima),
    limiteMensal: String(d.limiteMensal),
    prazoDias: String(d.prazoDias),
    mensagem: d.mensagem,
    campanha: JSON.stringify(d.campanha),
    metas: JSON.stringify(d.metas),
  }
  for (const [field, key] of Object.entries(REFERRAL_SETTING_KEYS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: values[field as keyof typeof values] },
    })
  }
}

/** Alíquota padrão em percentual, por chave de Setting. */
const DEFAULT_FEE_PCT_BY_KEY: Record<string, string> = {
  taxaPix: '0.99',
  taxaCartaoCredito: '4.98',
  taxaCartaoDebito: '1.99',
}

/**
 * Categorias de despesa padrão (decisão 4 do plano-financeiro-vendas).
 *
 * Semeadas porque o módulo de despesas com a lista vazia empurra o admin para criar categoria
 * antes de lançar a primeira conta — e quem está com a nota na mão desiste. O `group` é o que
 * amarra a linha do DRE, então cada semente já nasce no lugar certo da demonstração.
 *
 * `isFixed` não é enfeite: é o que torna o ponto de equilíbrio calculável (F9).
 *
 * Idempotente por `name` (@unique): rodar de novo não duplica e NÃO sobrescreve o que o admin
 * ajustou — um upsert com `update` reverteria a categoria que ele moveu de grupo a cada deploy.
 */
export async function seedExpenseCategories(prisma: PrismaClient): Promise<void> {
  const defaults: Array<{
    name: string
    group: ExpenseGroup
    isFixed: boolean
    emoji: string
    sortOrder: number
  }> = [
    // Pessoal — decisão 6: despesa comum, sem folha nem encargo calculado.
    { name: 'Entregador', group: 'PEOPLE', isFixed: false, emoji: '🛵', sortOrder: 10 },
    { name: 'Pró-labore', group: 'PEOPLE', isFixed: true, emoji: '👤', sortOrder: 11 },
    // Operação
    { name: 'Combustível', group: 'OPERATION', isFixed: false, emoji: '⛽', sortOrder: 20 },
    { name: 'Embalagem', group: 'OPERATION', isFixed: false, emoji: '📦', sortOrder: 21 },
    { name: 'Gancho de porta', group: 'OPERATION', isFixed: false, emoji: '🪝', sortOrder: 22 },
    { name: 'Manutenção', group: 'OPERATION', isFixed: false, emoji: '🔧', sortOrder: 23 },
    // Comercial
    { name: 'Marketing', group: 'SALES', isFixed: false, emoji: '📣', sortOrder: 30 },
    { name: 'Taxa de gateway', group: 'SALES', isFixed: false, emoji: '💳', sortOrder: 31 },
    // Administrativas
    { name: 'Aluguel', group: 'ADMIN', isFixed: true, emoji: '🏠', sortOrder: 40 },
    { name: 'Energia', group: 'ADMIN', isFixed: true, emoji: '💡', sortOrder: 41 },
    { name: 'Internet e telefone', group: 'ADMIN', isFixed: true, emoji: '🌐', sortOrder: 42 },
    { name: 'Software e serviços', group: 'ADMIN', isFixed: true, emoji: '🖥️', sortOrder: 43 },
    { name: 'Contador', group: 'ADMIN', isFixed: true, emoji: '📗', sortOrder: 44 },
    // Impostos — decisão 9: o sistema registra, nunca calcula.
    { name: 'DAS / Simples', group: 'TAXES', isFixed: false, emoji: '🧾', sortOrder: 50 },
    { name: 'Tarifa bancária', group: 'TAXES', isFixed: true, emoji: '🏦', sortOrder: 51 },
    { name: 'Outras', group: 'OTHER', isFixed: false, emoji: '•', sortOrder: 90 },
  ]

  const existing = await prisma.expenseCategory.findMany({ select: { name: true } })
  const have = new Set(existing.map((c) => c.name))
  const missing = defaults.filter((d) => !have.has(d.name))
  if (missing.length === 0) return

  await prisma.expenseCategory.createMany({ data: missing })
  console.log(`[bootstrap] ${missing.length} categorias de despesa semeadas`)
}
