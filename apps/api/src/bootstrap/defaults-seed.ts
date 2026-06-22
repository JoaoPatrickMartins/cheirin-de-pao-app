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

  // Combo padrão — só quando não há nenhum combo (unidade < preço avulso, como manda a regra)
  const combosCount = await prisma.combo.count()
  if (combosCount === 0) {
    await prisma.combo.create({
      data: {
        name: 'Combo 10 Pãezinhos',
        quantity: 10,
        price: 9.0, // R$ 0,90/unid — abaixo do avulso (R$ 1,00)
        tag: 'Mais popular',
        isActive: true,
      },
    })
    console.log('[bootstrap] Combo padrão criado (Combo 10 Pãezinhos)')
  }
}
