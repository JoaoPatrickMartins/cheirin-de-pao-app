import type { FastifyBaseLogger } from 'fastify'
import type { PrismaClient } from '@prisma/client'

/**
 * Índices garantidos em runtime, declarados aqui (fonte única).
 *
 * Mantenha em sincronia com os `@@index` do schema.prisma. Como o projeto não roda
 * `prisma db push`/`migrate`, é este passo que cria os índices fisicamente — inclusive
 * em bancos novos/vazios — no startup da API.
 */
const INDEX_SPECS: Array<{
  collection: string
  indexes: Array<{ key: Record<string, 1 | -1>; name: string }>
}> = [
  {
    collection: 'Order',
    indexes: [
      { key: { status: 1, scheduledDate: 1 }, name: 'status_1_scheduledDate_1' },
      { key: { condominiumId: 1, scheduledDate: 1 }, name: 'condominiumId_1_scheduledDate_1' },
    ],
  },
]

/**
 * Garante (cria se faltar) os índices da aplicação.
 *
 * - Idempotente: `createIndexes` é no-op quando o índice já existe com a mesma spec.
 * - Best-effort: falhas (ex.: permissão) são apenas logadas — NUNCA derrubam o boot.
 * - Roda no startup, então qualquer banco novo recebe os índices automaticamente.
 */
export async function ensureIndexes(prisma: PrismaClient, log: FastifyBaseLogger): Promise<void> {
  for (const spec of INDEX_SPECS) {
    try {
      await prisma.$runCommandRaw({ createIndexes: spec.collection, indexes: spec.indexes })
      log.info({ collection: spec.collection, count: spec.indexes.length }, '[indexes] garantidos')
    } catch (err) {
      log.warn({ collection: spec.collection, err }, '[indexes] falha ao garantir índices — ignorado')
    }
  }
}
