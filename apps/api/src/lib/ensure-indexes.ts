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
  indexes: Array<{
    key: Record<string, 1 | -1>
    name: string
    unique?: boolean
    partialFilterExpression?: Record<string, { $exists: boolean }>
  }>
}> = [
  {
    collection: 'Order',
    indexes: [
      { key: { status: 1, scheduledDate: 1 }, name: 'status_1_scheduledDate_1' },
      { key: { condominiumId: 1, scheduledDate: 1 }, name: 'condominiumId_1_scheduledDate_1' },
      // Um pagamento financia no máximo UM pedido único. Índice único PARCIAL (só quando
      // paymentId existe — pedidos pagos via saldo têm paymentId nulo) que barra a duplicata
      // na corrida entre frontend (na tela) e servidor (webhook/pull). Best-effort: se houver
      // duplicatas legadas, a criação do índice falha e é apenas logada (ver ensureIndexes).
      {
        key: { paymentId: 1 },
        name: 'paymentId_1',
        unique: true,
        partialFilterExpression: { paymentId: { $exists: true } },
      },
    ],
  },
  {
    collection: 'MaterializedCycle',
    indexes: [
      {
        key: { condominiumId: 1, slotId: 1, deliveryDate: 1 },
        name: 'condominiumId_1_slotId_1_deliveryDate_1',
        unique: true,
      },
    ],
  },
  {
    collection: 'AnalyticsEvent',
    indexes: [
      { key: { type: 1, createdAt: 1 }, name: 'type_1_createdAt_1' },
      { key: { visitorId: 1, createdAt: 1 }, name: 'visitorId_1_createdAt_1' },
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
