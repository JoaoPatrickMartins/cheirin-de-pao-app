// verify-onboarding.ts — prova o ciclo REAL do onboarding contra o MongoDB Atlas.
//
// Exercita o código de produção (ClientProfileService → repository → Prisma → Mongo)
// com um usuário CLIENT descartável, provando que a conclusão PERSISTE de verdade
// (a falha anterior era a escrita silenciosamente não gravar).
//
// Roda com: npx tsx src/scripts/verify-onboarding.ts
// Não deixa lixo: cria e remove o usuário de teste ao final.

import { PrismaClient } from '@prisma/client'
import { ClientProfileService } from '../modules/client-profile/client-profile.service.js'

const prisma = new PrismaClient()
// O service só usa fastify.prisma — stub mínimo suficiente.
const service = new ClientProfileService({ prisma } as unknown as import('fastify').FastifyInstance)

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`❌ FALHOU: ${msg}`)
  console.log(`✅ ${msg}`)
}

async function main() {
  const stamp = Date.now()
  const user = await prisma.user.create({
    data: {
      name: 'Onboarding Verify',
      cpf: `zzztest${stamp}`,
      phone: `zzztest-phone-${stamp}`,
      email: `zzztest-${stamp}@verify.local`,
      role: 'CLIENT',
    },
    select: { id: true },
  })
  console.log(`Usuário de teste criado: ${user.id}`)

  try {
    // 1. Estado inicial: nunca concluiu → completed=false
    const s0 = await service.getOnboardingStatus(user.id)
    assert('completed' in s0 && s0.completed === false, 'status inicial completed=false')

    // 2. Conclui → grava
    const c1 = await service.completeOnboarding(user.id)
    assert('completed' in c1 && c1.completed === true, 'completeOnboarding retorna completed=true')

    // 3. PROVA DE PERSISTÊNCIA: lê direto do banco (bypass do service)
    const fromDb = await prisma.user.findUnique({
      where: { id: user.id },
      select: { onboardingCompletedAt: true },
    })
    assert(fromDb?.onboardingCompletedAt != null, 'onboardingCompletedAt PERSISTIU no MongoDB (leitura direta)')

    // 4. Releitura via service → completed=true
    const s1 = await service.getOnboardingStatus(user.id)
    assert('completed' in s1 && s1.completed === true, 'status após conclusão completed=true')

    // 5. Idempotência: 2ª conclusão preserva a data original
    const firstDate = (c1 as { onboardingCompletedAt: string }).onboardingCompletedAt
    const c2 = await service.completeOnboarding(user.id)
    assert(
      (c2 as { onboardingCompletedAt: string }).onboardingCompletedAt === firstDate,
      'idempotente: 2ª conclusão mantém a data original',
    )

    console.log('\n🎉 Ciclo de onboarding VERIFICADO contra o Atlas — a conclusão persiste.')
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
    console.log(`Usuário de teste removido: ${user.id}`)
    await prisma.$disconnect()
  }
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
