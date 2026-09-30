import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../../lib/apiFetch'
import { Icon } from '../../../../components/brand/Icon'
import { type Expense, fmtBRL, fmtDayShort } from './expense-types'
import { downloadXlsx } from '../../../../lib/xlsx'

/**
 * AdminContasPagar (F4) — o que vence e o que já venceu.
 *
 * Separada da lista de despesas porque responde a outra pergunta, num outro momento: a lista é
 * "quanto gastei em agosto"; esta é "o que preciso pagar hoje". Por isso ordena por vencimento
 * (não por grupo do DRE) e traz a ação de pagar em primeiro plano.
 *
 * Despesa sem `dueDate` fica **fora** de propósito: sem vencimento não há como dizer se atrasou.
 * Ela continua visível na lista do mês.
 */

interface AdminContasPagarProps {
  onBack: () => void
}

export function AdminContasPagar({ onBack }: AdminContasPagarProps) {
  const [items, setItems] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/admin/expenses/payable?daysAhead=60')
      setItems(res.ok ? ((await res.json()) as Expense[]) : [])
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pay = async (id: string, kind: Expense['sourceKind'] = 'EXPENSE') => {
    setPayingId(id)
    try {
      // Compra ao fornecedor tem endpoint próprio: ela não é um `Expense`, e mandá-la para
      // `/admin/expenses/:id/pay` daria 404.
      const url =
        kind === 'PURCHASE'
          ? `/admin/expenses/purchases/${id}/pay`
          : `/admin/expenses/${id}/pay`
      await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      await load()
    } finally {
      setPayingId(null)
    }
  }

  const overdue = items.filter((e) => e.isOverdue)
  const upcoming = items.filter((e) => !e.isOverdue)
  const overdueTotal = overdue.reduce((s, e) => s + e.amount, 0)
  const upcomingTotal = upcoming.reduce((s, e) => s + e.amount, 0)

  // Vencidas primeiro, como na tela: a ordem por vencimento é a informação, e uma planilha que a
  // perdesse viraria só uma lista de contas.
  const payableRow = (e: Expense) => [
    fmtDayShort(e.dueDate),
    e.isOverdue ? 'VENCIDA' : 'A vencer',
    e.sourceKind === 'PURCHASE' ? 'Compra ao fornecedor' : 'Despesa',
    e.categoryName,
    e.description,
    e.payee ?? e.supplierName ?? '',
    e.amount,
  ]

  const onExport =
    items.length > 0
      ? () =>
          void downloadXlsx('contas-a-pagar.xlsx', [
            {
              name: 'Contas a pagar',
              notes: [`Contas a pagar — posição em ${new Date().toLocaleDateString('pt-BR')}`],
              head: ['Vencimento', 'Situação', 'Origem', 'Categoria', 'Descrição', 'Recebedor', 'Valor'],
              rows: [...overdue.map(payableRow), ...upcoming.map(payableRow)],
              money: [6],
              footer: [
                `Vencidas: R$ ${overdueTotal.toFixed(2)} em ${overdue.length} conta(s).`,
                `A vencer (60 dias): R$ ${upcomingTotal.toFixed(2)} em ${upcoming.length} conta(s).`,
                'Despesa sem vencimento fica fora: sem a data não há como dizer se atrasou. Ela continua na lista do mês.',
                'Compra ao fornecedor entra pela data da FINALIZAÇÃO — o sistema não conhece o prazo negociado, e inventar "30 dias" esconderia atraso real.',
              ],
            },
          ])
      : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{
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
          }}
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
          Contas a pagar
        </h2>
        {onExport && (
          <button
            type="button"
            aria-label="Exportar planilha"
            onClick={onExport}
            style={{
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
            }}
          >
            <Icon name="download" size={18} color="var(--color-text)" />
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {isLoading ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', textAlign: 'center', paddingTop: 24 }}>
            Carregando…
          </p>
        ) : items.length === 0 ? (
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px dashed var(--color-border)',
              borderRadius: 18,
              padding: '28px 20px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Nada a pagar nos próximos 60 dias
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '6px 0 0' }}>
              Só entram aqui despesas com vencimento informado.
            </p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <Section
                title={`Atrasadas · ${overdue.length}`}
                total={overdueTotal}
                tone="bad"
                items={overdue}
                payingId={payingId}
                onPay={pay}
              />
            )}
            {upcoming.length > 0 && (
              <Section
                title={`A vencer · ${upcoming.length}`}
                total={upcomingTotal}
                items={upcoming}
                payingId={payingId}
                onPay={pay}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  total,
  tone,
  items,
  payingId,
  onPay,
}: {
  title: string
  total: number
  tone?: 'bad'
  items: Expense[]
  payingId: string | null
  onPay: (id: string, kind: Expense['sourceKind']) => void | Promise<void>
}) {
  const color = tone === 'bad' ? 'var(--color-bad, #C2410C)' : 'var(--color-text)'
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          margin: '0 0 8px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: tone === 'bad' ? color : 'var(--color-text-ter)',
            margin: 0,
          }}
        >
          {title}
        </p>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 800,
            color,
          }}
        >
          {fmtBRL(total)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              background: tone === 'bad' ? 'rgba(194,65,12,0.07)' : 'var(--color-surface)',
              border: `1px solid ${tone === 'bad' ? 'rgba(194,65,12,0.25)' : 'var(--color-border-2)'}`,
              borderRadius: 14,
              padding: '12px 13px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
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
                }}
              >
                Vence {fmtDayShort(e.dueDate)}
                {e.payee != null && e.payee !== '' ? ` · ${e.payee}` : ''}
                {e.supplierName != null ? ` · ${e.supplierName}` : ''}
              </p>
            </div>

            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14.5,
                fontWeight: 800,
                color: 'var(--color-text)',
                whiteSpace: 'nowrap',
              }}
            >
              {fmtBRL(e.amount)}
            </span>

            <button
              type="button"
              onClick={() => void onPay(e.id, e.sourceKind)}
              disabled={payingId === e.id}
              aria-label={`Marcar ${e.description} como paga`}
              style={{
                minHeight: 34,
                padding: '0 12px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--color-espresso)',
                color: '#FAF5EC',
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: payingId === e.id ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              {payingId === e.id ? '…' : 'Pagar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
