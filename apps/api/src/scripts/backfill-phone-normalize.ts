// backfill-phone-normalize.ts — normaliza User.phone para apenas dígitos.
//
// Idempotente. Roda com: npm run migrate:phone
//
// Motivo: telefones foram armazenados como digitados (com máscara/espaços), o que
// quebrava a busca por dígitos no admin e a consistência do login OTP. A partir
// de agora PhoneSchema normaliza na escrita/leitura; este script alinha o legado.
//
// Conflitos: se dois usuários normalizarem para o mesmo número (violação do
// índice único `phone`), o conflito é logado e o registro é mantido como está.

import { PrismaClient } from '@prisma/client'
import { normalizePhone } from '@cheirin-de-pao/shared'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true, name: true },
  })

  let updated = 0
  let unchanged = 0
  let conflicts = 0

  for (const u of users) {
    const raw = u.phone!
    const normalized = normalizePhone(raw)
    if (normalized === raw) {
      unchanged++
      continue
    }
    try {
      await prisma.user.update({ where: { id: u.id }, data: { phone: normalized } })
      updated++
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'P2002') {
        conflicts++
        console.warn(`  CONFLITO — "${u.name}" (${u.id}): "${raw}" → "${normalized}" colide com outro telefone existente. Mantido como está.`)
      } else {
        throw err
      }
    }
  }

  console.log('Backfill de telefone concluído:')
  console.log(`  ${updated} normalizados, ${unchanged} já normalizados, ${conflicts} conflitos (mantidos).`)
}

main()
  .catch((err) => {
    console.error('Falha no backfill de telefone:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
