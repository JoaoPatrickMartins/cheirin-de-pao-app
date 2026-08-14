import type { FastifyBaseLogger } from 'fastify'
import type { PrismaClient } from '@prisma/client'

/**
 * Índices que o Prisma NÃO sabe expressar no schema — só eles moram aqui.
 *
 * Desde o commit 22ce12e o deploy roda `prisma db push` (ansible/playbook.yml), então quem cria
 * os índices do schema é ele: todo `@@index`/`@@unique` chega ao Atlas com o nome do Prisma
 * (`Model_campos_idx`). Duplicar um deles aqui recria a corrida que quebrou o deploy em 14/08/2026:
 * este passo é fire-and-forget no boot (server.ts) e o playbook só espera o container existir, então
 * o `createIndexes` podia vencer o `db push` e criar o mesmo índice com o nome legado do Mongo
 * (`campo_1_campo_1`) — o push então batia em `Error 85 (IndexOptionsConflict)`.
 *
 * REGRA: índice que o schema.prisma consegue declarar vai NO SCHEMA, nunca aqui.
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
]

/**
 * Garante (cria se faltar) os índices da aplicação.
 *
 * - Idempotente: `createIndexes` é no-op quando o índice já existe com a mesma spec.
 * - Best-effort: falhas (ex.: permissão) são apenas logadas — NUNCA derrubam o boot.
 * - Roda no startup, então qualquer banco novo (dev/local, que não recebe o `db push` do deploy)
 *   também ganha estes índices.
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
