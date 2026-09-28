import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import {
  ReportAppBar,
  ReportScroll,
  ReportCard,
  SectionTitle,
  LoadingText,
  ErrorText,
  fmtBRL,
  fmtPct,
} from './RelShared'
import { downloadXlsx } from '../../../lib/xlsx'
import { currentMonthBrt, monthLabel, shiftMonth } from './despesas/expense-types'

/**
 * FinMetas — realizado × meta do mês (F11 · Fase 7).
 *
 * O sistema sabia o que aconteceu e nunca o que **deveria** ter acontecido. Sem meta, um mês ruim
 * só é reconhecido depois de fechado.
 *
 * A tela é construída em torno de uma decisão: **no mês em curso, a régua é o "esperado até
 * aqui"**, não a meta cheia. Comparar 10 dias de realizado com a meta do mês inteiro devolve
 * sempre "30% da meta" e não diz nada — enquanto "no ritmo atual, fecha 12% abaixo" é acionável.
 */

interface BudgetLine {
  id: string | null
  kind: 'REVENUE' | 'EXPENSE'
  categoryId: string | null
  label: string
  target: number
  actual: number
  expectedToDate: number
  variance: number
  attainment: number | null
  isGood: boolean
  paceStatus: 'on_track' | 'at_risk' | 'no_target'
  projected: number | null
}

interface BudgetReport {
  month: string
  elapsed: number
  isPartial: boolean
  revenue: BudgetLine
  expenseTotal: BudgetLine
  expenseByCategory: BudgetLine[]
  categoriesWithoutTarget: Array<{ categoryId: string; name: string; actual: number }>
  caveats: string[]
}

export function FinMetas({ onBack }: { onBack: () => void }) {
  const [month, setMonth] = useState(currentMonthBrt())
  const [data, setData] = useState<BudgetReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<{ kind: 'REVENUE' | 'EXPENSE'; categoryId: string | null; label: string; target: number } | null>(null)
  const [draft, setDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch(`/admin/financial/budget?month=${month}`)
      setData(res.ok ? ((await res.json()) as BudgetReport) : null)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [month])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!editing) return
    const amount = Number(draft.replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 0) return
    setIsSaving(true)
    try {
      await apiFetch('/admin/financial/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, kind: editing.kind, categoryId: editing.categoryId, amount }),
      })
      setEditing(null)
      setDraft('')
      await load()
    } finally {
      setIsSaving(false)
    }
  }

  const removeTarget = async (id: string) => {
    await apiFetch(`/admin/financial/budget/${id}`, { method: 'DELETE' })
    await load()
  }

  const openEditor = (line: { kind: 'REVENUE' | 'EXPENSE'; categoryId: string | null; label: string; target: number }) => {
    setEditing(line)
    setDraft(line.target > 0 ? String(line.target) : '')
  }

  const onExport = data
    ? () =>
        void downloadXlsx(`metas-${month}.xlsx`, [
          {
            name: 'Realizado x meta',
            notes: [`Metas — ${monthLabel(month)}`],
            head: ['Linha', 'Tipo', 'Meta', 'Realizado', 'Esperado até aqui', 'Desvio', '% da meta', 'Projeção'],
            rows: [
              ['Receita do mês', 'Receita', data.revenue.target, data.revenue.actual, data.revenue.expectedToDate, data.revenue.variance, data.revenue.attainment, data.revenue.projected],
              ['Despesa total', 'Despesa', data.expenseTotal.target, data.expenseTotal.actual, data.expenseTotal.expectedToDate, data.expenseTotal.variance, data.expenseTotal.attainment, data.expenseTotal.projected],
              ...data.expenseByCategory.map((l) => [
                l.label,
                'Despesa',
                l.target,
                l.actual,
                l.expectedToDate,
                l.variance,
                l.attainment,
                l.projected,
              ]),
            ],
            money: [2, 3, 4, 5, 7],
            percent: [6],
            footer: data.caveats,
          },
          {
            name: 'Sem meta',
            head: ['Categoria', 'Gasto no mês'],
            rows: data.categoriesWithoutTarget.map((c) => [c.name, c.actual]),
            money: [1],
            footer: ['Categorias que gastaram no mês e ainda não têm meta definida.'],
          },
        ])
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Metas do mês" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        {/* Navegação de mês, no mesmo molde da lista de despesas. */}
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
          <MonthBtn aria-label="Mês anterior" onClick={() => setMonth((m) => shiftMonth(m, -1))} icon="chevL" />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
            {monthLabel(month)}
          </span>
          <MonthBtn aria-label="Mês seguinte" onClick={() => setMonth((m) => shiftMonth(m, 1))} icon="chevR" />
        </div>

        {isLoading ? (
          <LoadingText />
        ) : data ? (
          <>
            {data.isPartial && (
              <div
                style={{
                  background: 'var(--color-gold-soft)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 14,
                  padding: '11px 13px',
                }}
              >
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: '#6B5200', margin: 0, lineHeight: 1.4 }}>
                  Mês em curso — {Math.round(data.elapsed * 100)}% decorrido. A régua é o{' '}
                  <strong>esperado até aqui</strong>, não a meta cheia.
                </p>
              </div>
            )}

            <SectionTitle>Receita</SectionTitle>
            <TargetCard line={data.revenue} elapsed={data.elapsed} isPartial={data.isPartial} onEdit={openEditor} onRemove={removeTarget} />

            <SectionTitle>Despesa total</SectionTitle>
            <TargetCard line={data.expenseTotal} elapsed={data.elapsed} isPartial={data.isPartial} onEdit={openEditor} onRemove={removeTarget} />

            {data.expenseByCategory.length > 0 && (
              <>
                <SectionTitle>Metas por categoria</SectionTitle>
                {data.expenseByCategory.map((l) => (
                  <TargetCard
                    key={l.categoryId ?? 'total'}
                    line={l}
                    elapsed={data.elapsed}
                    isPartial={data.isPartial}
                    onEdit={openEditor}
                    onRemove={removeTarget}
                    compact
                  />
                ))}
              </>
            )}

            {data.categoriesWithoutTarget.length > 0 && (
              <>
                <SectionTitle>Ainda sem meta</SectionTitle>
                <ReportCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {data.categoriesWithoutTarget.map((c) => (
                      <div key={c.categoryId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                            {fmtBRL(c.actual)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditor({ kind: 'EXPENSE', categoryId: c.categoryId, label: c.name, target: 0 })}
                            style={{
                              minHeight: 30,
                              padding: '0 11px',
                              borderRadius: 99,
                              border: '1px solid var(--color-border-2)',
                              background: 'var(--color-surface-2)',
                              fontFamily: 'var(--font-body)',
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--color-text-sec)',
                              cursor: 'pointer',
                            }}
                          >
                            definir meta
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Ordenadas pelo maior gasto: é a ordem em que vale a pena definir meta. */}
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '11px 0 0', lineHeight: 1.4 }}>
                    Ordenadas pelo maior gasto — a ordem em que definir uma meta muda mais o
                    resultado.
                  </p>
                </ReportCard>
              </>
            )}

            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {data.caveats.map((c) => (
                  <p key={c} style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.4 }}>
                    {c}
                  </p>
                ))}
              </div>
            </ReportCard>
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>

      {/* Editor de meta — folha simples, no molde do resto do admin. */}
      {editing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,12,4,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 50,
          }}
          onClick={() => setEditing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)',
              borderRadius: '22px 22px 0 0',
              padding: 20,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Meta · {editing.label}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '-8px 0 0' }}>
              {monthLabel(month)} · {editing.kind === 'REVENUE' ? 'receita' : 'despesa'}
            </p>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="0,00"
              style={{
                minHeight: 52,
                padding: '0 14px',
                borderRadius: 14,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface-alt, #FBF6EC)',
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--color-text)',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              {editing.target > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft('0')
                  }}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 14,
                    border: '1px solid var(--color-border-2)',
                    background: 'var(--color-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--color-text-sec)',
                    cursor: 'pointer',
                  }}
                >
                  Zerar
                </button>
              )}
              <button
                type="button"
                onClick={() => void save()}
                disabled={isSaving || draft === ''}
                style={{
                  flex: 2,
                  minHeight: 48,
                  borderRadius: 14,
                  border: 'none',
                  background: 'var(--color-espresso)',
                  color: '#FAF5EC',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: isSaving || draft === '' ? 'default' : 'pointer',
                  opacity: isSaving || draft === '' ? 0.5 : 1,
                }}
              >
                {isSaving ? 'Salvando...' : 'Salvar meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ subcomponentes

function MonthBtn({ onClick, icon, ...rest }: { onClick: () => void; icon: 'chevL' | 'chevR'; 'aria-label': string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
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
      <Icon name={icon} size={17} color="var(--color-text)" />
    </button>
  )
}

/**
 * Cartão de uma meta.
 *
 * A barra tem DUAS marcas: o realizado (preenchimento) e o esperado até aqui (traço vertical). É a
 * leitura inteira num relance — se o preenchimento passou do traço, está no ritmo.
 */
function TargetCard({
  line,
  elapsed,
  isPartial,
  onEdit,
  onRemove,
  compact,
}: {
  line: BudgetLine
  elapsed: number
  isPartial: boolean
  onEdit: (l: { kind: 'REVENUE' | 'EXPENSE'; categoryId: string | null; label: string; target: number }) => void
  onRemove: (id: string) => void
  compact?: boolean
}) {
  const hasTarget = line.target > 0
  const fill = hasTarget ? Math.min((line.actual / line.target) * 100, 100) : 0
  const markAt = Math.min(elapsed * 100, 100)
  const tone = !hasTarget
    ? 'var(--color-border-2)'
    : line.paceStatus === 'on_track'
      ? 'var(--color-good)'
      : 'var(--color-warn)'

  return (
    <ReportCard>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: hasTarget ? 11 : 0 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: compact ? 13 : 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {line.label}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
            {hasTarget ? `meta ${fmtBRL(line.target)}` : 'sem meta definida'}
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 15 : 17, fontWeight: 800, color: 'var(--color-text)' }}>
            {fmtBRL(line.actual)}
          </span>
          <button
            type="button"
            aria-label="Editar meta"
            onClick={() => onEdit({ kind: line.kind, categoryId: line.categoryId, label: line.label, target: line.target })}
            style={{
              background: 'var(--color-surface-2)',
              border: 'none',
              width: 32,
              height: 32,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icon name="edit" size={15} color="var(--color-text-sec)" />
          </button>
          {line.id && (
            <button
              type="button"
              aria-label="Remover meta"
              onClick={() => void onRemove(line.id as string)}
              style={{
                background: 'var(--color-surface-2)',
                border: 'none',
                width: 32,
                height: 32,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Icon name="trash" size={15} color="var(--color-text-ter)" />
            </button>
          )}
        </span>
      </div>

      {hasTarget && (
        <>
          <div style={{ position: 'relative', height: 10, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden', marginBottom: 9 }}>
            <div style={{ height: '100%', width: `${fill}%`, background: tone, borderRadius: 99, transition: 'width 0.3s ease' }} />
            {/* O traço do "esperado até aqui" só faz sentido no mês em curso. */}
            {isPartial && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: `${markAt}%`,
                  top: -2,
                  width: 2,
                  height: 14,
                  background: 'var(--color-text)',
                  opacity: 0.55,
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px' }}>
            <Hint label={isPartial ? 'Esperado até aqui' : 'Meta'} value={fmtBRL(line.expectedToDate)} />
            {line.attainment != null && <Hint label="Da meta" value={fmtPct(line.attainment)} />}
            <Hint
              label={line.variance >= 0 ? 'Acima' : 'Abaixo'}
              value={fmtBRL(Math.abs(line.variance))}
              tone={line.isGood ? 'var(--color-good)' : 'var(--color-warn)'}
            />
            {line.projected != null && <Hint label="Projeção de fechamento" value={fmtBRL(line.projected)} />}
          </div>
        </>
      )}
    </ReportCard>
  )
}

function Hint({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>
      {label} <strong style={{ color: tone ?? 'var(--color-text-sec)', fontWeight: 700 }}>{value}</strong>
    </span>
  )
}
