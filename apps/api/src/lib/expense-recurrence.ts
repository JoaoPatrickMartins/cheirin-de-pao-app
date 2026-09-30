/**
 * expense-recurrence — materialização PREGUIÇOSA das parcelas de despesa fixa (decisão 11).
 *
 * A parcela do mês nasce quando alguém abre aquele mês no módulo de despesas, não num cron.
 * Dois motivos:
 *
 *   1. `plugins/cron.ts` já carrega 3 jobs críticos (corte, projeção, notificações). Um cron
 *      mensal que falhasse em silêncio deixaria o mês sem as despesas fixas — e o DRE mostraria
 *      lucro inflado sem nenhum sinal de que algo faltou.
 *   2. A parcela só precisa existir quando alguém vai olhar. Materializar sob demanda não tem
 *      janela de inconsistência.
 *
 * A idempotência é do BANCO, não da aplicação: `@@unique([recurrenceId, recurrenceMonth])`. Duas
 * requisições simultâneas abrindo o mesmo mês não geram aluguel duplicado — a segunda colide com
 * o índice (P2002) e a colisão é tratada como sucesso, porque significa que a parcela já existe.
 *
 * O valor nasce EDITÁVEL: conta de luz varia todo mês. Uma parcela imutável obrigaria o admin a
 * cancelar e relançar, e o relatório perderia o vínculo com a recorrência.
 */
import type { PrismaClient } from '@prisma/client'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000

/** Instante UTC de 00:00 BRT do dia (y, mês 0-based, d). */
function brtMidnightUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d) + BRT_OFFSET_MS)
}

export interface MaterializeResult {
  /** Parcelas criadas nesta chamada. */
  created: number
  /** Recorrências que já tinham a parcela do mês (colisão com o índice único ou pré-existentes). */
  skipped: number
}

/**
 * Garante que as parcelas do mês existam para todas as recorrências ativas e vigentes.
 *
 * @param month "YYYY-MM" (BRT)
 * @param createdById admin que abriu o mês — fica como autor do lançamento, para auditoria
 */
export async function materializeRecurrences(
  prisma: PrismaClient,
  month: string,
  createdById: string,
): Promise<MaterializeResult> {
  if (!MONTH_RE.test(month)) {
    throw new RangeError('month deve estar no formato YYYY-MM')
  }
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1

  // Primeiro instante do mês e do mês seguinte, em BRT — a vigência é comparada por mês, não por
  // dia, então uma recorrência que começa em 20/08 vale para agosto inteiro.
  const monthStart = brtMidnightUtc(y, m, 1)
  const nextMonthStart = brtMidnightUtc(y, m + 1, 1)

  const recurrences = await prisma.expenseRecurrence.findMany({
    where: {
      isActive: true,
      // Começou antes do fim deste mês.
      startsAt: { lt: nextMonthStart },
    },
    select: {
      id: true,
      categoryId: true,
      description: true,
      amount: true,
      dayOfMonth: true,
      supplierId: true,
      payee: true,
      condominiumId: true,
      endsAt: true,
    },
  })
  if (recurrences.length === 0) return { created: 0, skipped: 0 }

  // `endsAt` é filtrado em CÓDIGO, não no `where`.
  //
  // `endsAt: null` significa "sem fim", e no Mongo documento criado sem a chave não é encontrado
  // por `where: { endsAt: null }` — a armadilha que o projeto já documentou em
  // `Condominium.*Override`. Resolver aqui, com `?? null`, funciona para documento antigo e novo.
  const vigentes = recurrences.filter((r) => {
    const endsAt = r.endsAt ?? null
    return endsAt == null || endsAt >= monthStart
  })

  let created = 0
  let skipped = 0

  for (const r of vigentes) {
    // `dayOfMonth` é 1..28 por validação, então nunca transborda para o mês seguinte.
    const dueDate = brtMidnightUtc(y, m, r.dayOfMonth)
    try {
      await prisma.expense.create({
        data: {
          categoryId: r.categoryId,
          description: r.description,
          amount: r.amount,
          // Competência é o mês da parcela; vencimento é o dia configurado.
          competenceDate: monthStart,
          dueDate,
          status: 'PENDING',
          supplierId: r.supplierId,
          payee: r.payee,
          condominiumId: r.condominiumId,
          recurrenceId: r.id,
          recurrenceMonth: month,
          createdById,
        },
      })
      created++
    } catch (err) {
      // P2002 = colisão no índice único (recurrenceId, recurrenceMonth). É o caminho ESPERADO na
      // segunda abertura do mês e em requisições concorrentes: a parcela já existe, então a
      // operação já está satisfeita. Qualquer outro erro sobe.
      if (isUniqueViolation(err)) {
        skipped++
        continue
      }
      throw err
    }
  }

  return { created, skipped }
}

/** Colisão de índice único do Prisma (P2002), sem depender do tipo de erro do runtime. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  )
}
