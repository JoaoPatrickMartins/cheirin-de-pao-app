import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../../lib/apiFetch'
import { Icon } from '../../../../components/brand/Icon'
import { EXPENSE_GROUP_LABEL, EXPENSE_GROUP_ORDER, type ExpenseGroup } from '@cheirin-de-pao/shared'
import { ExpenseForm } from './ExpenseForm'
import { QuickExpense } from './QuickExpense'
import { downloadXlsx } from '../../../../lib/xlsx'
import {
  type Expense,
  type ExpenseCategory,
  fmtBRL,
  fmtDayShort,
  currentMonthBrt,
  monthLabel,
  shiftMonth,
} from './expense-types'

/**
 * AdminDespesas — lista e gestão dos lançamentos do mês (Fase 1 do plano-financeiro-vendas).
 *
 * Abrir um mês aqui **materializa** as parcelas das recorrências ativas daquele mês (decisão 11):
 * a geração é preguiçosa, não por cron, e é este `GET /admin/expenses?month=` que a dispara.
 *
 * A tela é organizada por GRUPO do DRE, não por data. O motivo é a pergunta que ela responde: o
 * admin não abre esta lista para saber "o que aconteceu no dia 12", e sim "quanto gastei com
 * pessoal, com operação, com administrativo" — que é a leitura do DRE.
 */

interface AdminDespesasProps {
  onBack: () => void
}

type StatusFilter = 'all' | 'PENDING' | 'PAID'

export function AdminDespesas({ onBack }: AdminDespesasProps) {
  const [month, setMonth] = useState(currentMonthBrt())
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [status, setStatus] = useState<StatusFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form' | 'quick'>('list')
  const [editing, setEditing] = useState<Expense | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [expRes, catRes] = await Promise.all([
        apiFetch(`/admin/expenses?month=${month}`),
        apiFetch('/admin/expense-categories'),
      ])
      setExpenses(expRes.ok ? ((await expRes.json()) as Expense[]) : [])
      setCategories(catRes.ok ? ((await catRes.json()) as ExpenseCategory[]) : [])
    } catch {
      setExpenses([])
    } finally {
      setIsLoading(false)
    }
  }, [month])

  useEffect(() => {
    void load()
  }, [load])

  if (view === 'form') {
    return (
      <ExpenseForm
        categories={categories}
        expense={editing}
        month={month}
        onCancel={() => {
          setEditing(null)
          setView('list')
        }}
        onSaved={() => {
          setEditing(null)
          setView('list')
          void load()
        }}
      />
    )
  }

  // Cancelada fica fora dos totais e da lista por padrão: ela existe para preservar o histórico da
  // parcela de recorrência, não para ser contada como gasto.
  const visible = expenses.filter(
    (e) => e.status !== 'CANCELLED' && (status === 'all' || e.status === status),
  )

  const total = visible.reduce((s, e) => s + e.amount, 0)
  const pending = expenses
    .filter((e) => e.status === 'PENDING')
    .reduce((s, e) => s + e.amount, 0)
  const fixedTotal = visible.filter((e) => e.categoryIsFixed).reduce((s, e) => s + e.amount, 0)

  // Agrupamento por grupo do DRE, na ordem da demonstração.
  const byGroup = EXPENSE_GROUP_ORDER.map((group) => ({
    group,
    items: visible.filter((e) => e.categoryGroup === group),
  })).filter((g) => g.items.length > 0)

  // Exporta o RAZÃO do mês — lançamento a lançamento, que é o que o contador pede e o que a tela
  // (agrupada por linha do DRE) não consegue mostrar de uma vez.
  const onExport =
    visible.length > 0
      ? () =>
          void downloadXlsx(`despesas-${month}.xlsx`, [
            {
              name: 'Lançamentos',
              notes: [`Despesas — ${monthLabel(month)}`],
              head: [
                'Competência',
                'Vencimento',
                'Pagamento',
                'Grupo do DRE',
                'Categoria',
                'Tipo',
                'Descrição',
                'Recebedor',
                'Forma',
                'Condomínio',
                'Situação',
                'Valor',
              ],
              rows: visible.map((e) => [
                fmtDayShort(e.competenceDate),
                fmtDayShort(e.dueDate),
                fmtDayShort(e.paidAt),
                EXPENSE_GROUP_LABEL[e.categoryGroup] ?? e.categoryGroup,
                e.categoryName,
                e.categoryIsFixed ? 'Fixa' : 'Variável',
                e.description,
                e.payee ?? e.supplierName ?? '',
                e.paymentMethod ?? '',
                e.condominiumName ?? '',
                e.status === 'PAID' ? 'Paga' : 'A pagar',
                e.amount,
              ]),
              money: [11],
              footer: [
                `Total exibido: R$ ${total.toFixed(2)} · fixas R$ ${fixedTotal.toFixed(2)} · a pagar R$ ${pending.toFixed(2)}`,
                'Despesas CANCELADAS ficam fora: elas existem para preservar o histórico da parcela de recorrência, não como gasto.',
                status !== 'all' ? `Filtro ativo: ${status === 'PAID' ? 'só pagas' : 'só a pagar'}.` : '',
              ].filter(Boolean),
            },
            {
              name: 'Por grupo do DRE',
              head: ['Grupo', 'Lançamentos', 'Total'],
              rows: byGroup.map((g) => [
                EXPENSE_GROUP_LABEL[g.group] ?? g.group,
                g.items.length,
                g.items.reduce((s, e) => s + e.amount, 0),
              ]),
              integer: [1],
              money: [2],
            },
          ])
      : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={iconBtn}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          Despesas
        </h2>
        {onExport && (
          <button type="button" aria-label="Exportar planilha" onClick={onExport} style={iconBtn}>
            <Icon name="download" size={18} color="var(--color-text)" />
          </button>
        )}
        <button type="button" aria-label="Lançamento rápido" onClick={() => setView('quick')} style={iconBtn}>
          <Icon name="spark" size={18} color="var(--color-text)" />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Navegação de mês */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 14,
            padding: 6,
          }}
        >
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            style={iconBtn}
          >
            <Icon name="chevL" size={17} color="var(--color-text)" />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-text)',
            }}
          >
            {monthLabel(month)}
          </span>
          <button
            type="button"
            aria-label="Mês seguinte"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            style={iconBtn}
          >
            <Icon name="chevR" size={17} color="var(--color-text)" />
          </button>
        </div>

        {/* Totais */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 18,
            padding: 18,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--color-text-sec)',
              margin: '0 0 2px',
            }}
          >
            Total de despesas
          </p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            {fmtBRL(total)}
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px 14px',
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid var(--color-border-2)',
            }}
          >
            {pending > 0 && <Stat label="A pagar" value={fmtBRL(pending)} tone="warn" />}
            {/* Despesa fixa é o insumo do ponto de equilíbrio — por isso tem destaque próprio. */}
            <Stat label="Fixas" value={fmtBRL(fixedTotal)} />
            <Stat label="Variáveis" value={fmtBRL(total - fixedTotal)} />
          </div>
        </div>

        {/* Filtro de status */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(
            [
              ['all', 'Todas'],
              ['PENDING', 'A pagar'],
              ['PAID', 'Pagas'],
            ] as Array<[StatusFilter, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              style={{
                minHeight: 34,
                padding: '0 13px',
                borderRadius: 99,
                border: `1px solid ${status === key ? 'transparent' : 'var(--color-border-2)'}`,
                background: status === key ? 'var(--color-espresso)' : 'var(--color-surface)',
                color: status === key ? '#FAF5EC' : 'var(--color-text-sec)',
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', textAlign: 'center', paddingTop: 24 }}>
            Carregando…
          </p>
        ) : visible.length === 0 ? (
          <EmptyState month={month} onAdd={() => setView('quick')} />
        ) : (
          byGroup.map(({ group, items }) => (
            <GroupBlock
              key={group}
              group={group}
              items={items}
              onEdit={(e) => {
                setEditing(e)
                setView('form')
              }}
              onPaid={async (e) => {
                await apiFetch(`/admin/expenses/${e.id}/pay`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: '{}',
                })
                void load()
              }}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setView('form')
          }}
          style={{
            minHeight: 48,
            borderRadius: 999,
            border: '1.5px solid var(--color-border)',
            background: 'none',
            fontFamily: 'var(--font-body)',
            fontSize: 14.5,
            fontWeight: 700,
            color: 'var(--color-text)',
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          Nova despesa (formulário completo)
        </button>
      </div>

      {view === 'quick' && (
        <QuickExpense
          categories={categories}
          onClose={() => setView('list')}
          onSaved={() => void load()}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------------ subcomponentes

const iconBtn = {
  background: 'var(--color-surface-2)',
  border: 'none',
  width: 36,
  height: 36,
  borderRadius: 11,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
} as const

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-sec)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}{' '}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          color: tone === 'warn' ? '#8A6A00' : 'var(--color-text)',
        }}
      >
        {value}
      </span>
    </span>
  )
}

function GroupBlock({
  group,
  items,
  onEdit,
  onPaid,
}: {
  group: ExpenseGroup
  items: Expense[]
  onEdit: (e: Expense) => void
  onPaid: (e: Expense) => void | Promise<void>
}) {
  const subtotal = items.reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          margin: '4px 0 6px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-ter)',
            margin: 0,
          }}
        >
          {EXPENSE_GROUP_LABEL[group]}
        </p>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-sec)',
          }}
        >
          {fmtBRL(subtotal)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-2)',
              borderRadius: 14,
              padding: '11px 13px',
            }}
          >
            <button
              type="button"
              onClick={() => onEdit(e)}
              aria-label={`Editar ${e.description}`}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  margin: 0,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.categoryEmoji ? `${e.categoryEmoji} ` : ''}
                {e.description}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  color: 'var(--color-text-ter)',
                  margin: '1px 0 0',
                  lineHeight: 1.3,
                }}
              >
                {e.categoryName}
                {e.recurrenceId != null && ' · fixa'}
                {e.status === 'PENDING'
                  ? e.dueDate != null
                    ? ` · vence ${fmtDayShort(e.dueDate)}`
                    : ' · a pagar'
                  : ` · pago ${fmtDayShort(e.paidAt)}`}
                {e.receiptUrl != null && ' · 📎'}
              </p>
            </button>

            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text)',
                whiteSpace: 'nowrap',
              }}
            >
              {fmtBRL(e.amount)}
            </span>

            {/* Marcar como paga direto na lista: é a ação mais frequente do mês. */}
            {e.status === 'PENDING' && (
              <button
                type="button"
                aria-label={`Marcar ${e.description} como paga`}
                onClick={() => void onPaid(e)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  border: 'none',
                  background: 'var(--color-gold-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Icon name="check" size={16} color="#8A6A00" stroke={2.4} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ month, onAdd }: { month: string; onAdd: () => void }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px dashed var(--color-border)',
        borderRadius: 18,
        padding: '28px 20px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: 0,
        }}
      >
        Nenhuma despesa em {monthLabel(month).toLowerCase()}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          color: 'var(--color-text-ter)',
          margin: '6px 0 16px',
          lineHeight: 1.4,
        }}
      >
        Sem despesa lançada, o DRE mostra apenas lucro bruto — receita menos custo da mercadoria.
      </p>
      <button
        type="button"
        onClick={onAdd}
        style={{
          minHeight: 44,
          padding: '0 20px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--color-espresso)',
          color: '#FAF5EC',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Lançar a primeira
      </button>
    </div>
  )
}
