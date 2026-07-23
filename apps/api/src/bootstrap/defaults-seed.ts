import { PrismaClient } from '@prisma/client'

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

  // Dias bloqueados para agendamento — default nenhum dia bloqueado (preserva o comportamento
  // atual). true = dia sem entregas (pedido único, agenda e corte). O admin ajusta em Gestão.
  await prisma.setting.upsert({
    where: { key: 'diasBloqueados' },
    update: {},
    create: {
      key: 'diasBloqueados',
      value: JSON.stringify({ seg: false, ter: false, qua: false, qui: false, sex: false, sab: false, dom: false }),
    },
  })

  // Limite de pedidos por dia da semana — default 0 (ilimitado) em todos os dias, preservando o
  // comportamento atual. Positivo = teto de entregas naquele dia. O admin ajusta em Gestão.
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
}
