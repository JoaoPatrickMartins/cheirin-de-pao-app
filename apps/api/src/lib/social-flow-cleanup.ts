import type { PrismaClient } from '@prisma/client'

/**
 * Login social — apaga os fluxos (`SocialLoginFlow`) já vencidos.
 *
 * O fluxo vale 60 min e o código SEMPRE confere `expiresAt` antes de usá-lo, então isto é só
 * faxina: sem ela a coleção cresceria para sempre. Roda no cron diário (plugins/cron.ts).
 *
 * Por que não índice TTL do Mongo: o Prisma não o expressa no schema, e o `db push` do deploy
 * apaga o TTL criado fora dele (ver o comentário do model no schema.prisma).
 */
export async function cleanupExpiredSocialFlows(
  prisma: Pick<PrismaClient, 'socialLoginFlow'>,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await prisma.socialLoginFlow.deleteMany({ where: { expiresAt: { lt: now } } })
  return count
}
