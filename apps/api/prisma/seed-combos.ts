import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.combo.deleteMany({})

  const combos = await prisma.combo.createMany({
    data: [
      { name: 'Combo Básico', quantity: 20, price: 29.9, tag: 'Mais popular', description: 'O essencial do dia', showEconomy: true, isActive: true },
      { name: 'Combo Médio', quantity: 40, price: 54.9, description: 'O equilíbrio da casa', showEconomy: true, isActive: true },
      { name: 'Combo Família', quantity: 60, price: 74.9, tag: 'Melhor custo-benefício', description: 'Pra mesa cheia', showEconomy: true, isActive: true },
    ],
  })

  console.log(`✅ ${combos.count} combos criados.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
