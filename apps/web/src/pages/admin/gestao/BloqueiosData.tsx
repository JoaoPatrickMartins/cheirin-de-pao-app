import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

/**
 * BloqueiosData — datas e períodos bloqueados (feriado, férias, obra na portaria).
 *
 * Complementa o bloqueio por dia da semana, que é recorrente: aqui o bloqueio é pontual. Segue o
 * `scope` da tela: sem escopo é um bloqueio GLOBAL (todos os condomínios); com escopo, só daquele
 * condomínio.
 *
 * O fluxo é em dois passos de propósito. Antes de gravar, a tela pede a PRÉVIA DE IMPACTO
 * (quantos pedidos/Cestinhas existem nas datas) e o admin escolhe entre apenas travar novos
 * pedidos ou cancelar o que existe com estorno dos pãezins. Bloquear uma data que já tem pedido
 * é decisão de negócio — não deve acontecer sem o admin ver o tamanho do estrago.
 */

interface Block {
  id: string
  condominiumId: string | null
  condominiumName: string | null
  startDate: string
  endDate: string
  reason: string | null
  isPast: boolean
}

interface Impact {
  days: number
  orders: number
  breads: number
  cestinhas: number
  cestinhaItems: number
  clients: number
  schedules: number
  refundableCredits: number
}

interface BloqueiosDataProps {
  /** null = bloqueio global; id = bloqueio daquele condomínio. */
  scope: string | null
}

/** "2026-12-25" → "25/12/2026" */
function fmtDate(s: string): string {
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`
}

/** Hoje em BRT como "YYYY-MM-DD" — piso do date picker (não dá para bloquear o passado). */
function todayBrt(): string {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(0, 10)
}

export function BloqueiosData({ scope }: BloqueiosDataProps) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Formulário
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  // Prévia de impacto (passo 2)
  const [impact, setImpact] = useState<Impact | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true)
    try {
      const qs = scope ? `?condominiumId=${scope}` : ''
      const res = await apiFetch(`/admin/settings/bloqueios-data${qs}`)
      if (res.ok) {
        const data = (await res.json()) as { blocks: Block[] }
        setBlocks(data.blocks ?? [])
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoading(false)
    }
  }, [scope])

  useEffect(() => {
    void fetchBlocks()
    // Trocar de escopo descarta um formulário pela metade — o bloqueio pertence a um escopo.
    setImpact(null)
    setStartDate('')
    setEndDate('')
    setReason('')
    setError(null)
  }, [fetchBlocks])

  /** Passo 1 → 2: pede a prévia de impacto das datas informadas. */
  const verificar = async () => {
    setError(null)
    const start = startDate
    // Data única: fim vazio = mesmo dia.
    const end = endDate || startDate
    if (!start) {
      setError('Informe a data inicial.')
      return
    }
    if (end < start) {
      setError('A data final não pode ser anterior à inicial.')
      return
    }
    setIsChecking(true)
    try {
      const params = new URLSearchParams({ startDate: start, endDate: end })
      if (scope) params.set('condominiumId', scope)
      const res = await apiFetch(`/admin/settings/bloqueios-data/impacto?${params.toString()}`)
      if (res.ok) {
        setImpact((await res.json()) as Impact)
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Não foi possível verificar o período.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsChecking(false)
    }
  }

  /** Passo 2: grava o bloqueio. `cancelExisting` cancela pedidos do período com estorno. */
  const confirmar = async (cancelExisting: boolean) => {
    setError(null)
    setIsSaving(true)
    try {
      const res = await apiFetch('/admin/settings/bloqueios-data', {
        method: 'POST',
        body: JSON.stringify({
          ...(scope ? { condominiumId: scope } : {}),
          startDate,
          endDate: endDate || startDate,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          cancelExisting,
        }),
      })
      if (res.ok) {
        setImpact(null)
        setStartDate('')
        setEndDate('')
        setReason('')
        await fetchBlocks()
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Não foi possível salvar o bloqueio.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const remover = async (id: string) => {
    setError(null)
    try {
      const res = await apiFetch(`/admin/settings/bloqueios-data/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchBlocks()
      } else {
        setError('Não foi possível remover o bloqueio.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    }
  }

  const nada = impact !== null && impact.orders === 0 && impact.cestinhas === 0

  return (
    <div>
      <p style={sectionTitle}>Datas e períodos bloqueados</p>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          color: 'var(--color-text-ter)',
          lineHeight: 1.5,
          margin: '0 0 10px',
        }}
      >
        Bloqueie uma data específica ou um período — feriado, férias, obra na portaria. Vale para
        pedido único, agenda e Cestinha, em todos os turnos.
        {scope
          ? ' Este bloqueio valerá só para o condomínio selecionado.'
          : ' Sem condomínio selecionado, o bloqueio vale para todos.'}
      </p>

      {/* Formulário — passo 1 */}
      {impact === null ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="De">
              <input
                type="date"
                value={startDate}
                min={todayBrt()}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setError(null)
                }}
                style={inputStyle}
              />
            </Field>
            <Field label="Até (opcional)">
              <input
                type="date"
                value={endDate}
                min={startDate || todayBrt()}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setError(null)
                }}
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Motivo (opcional — o cliente vê)">
            <input
              type="text"
              value={reason}
              maxLength={60}
              placeholder="Ex.: Feriado"
              onChange={(e) => setReason(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            />
          </Field>

          <button
            type="button"
            onClick={() => void verificar()}
            disabled={isChecking || !startDate}
            style={{
              ...primaryButton,
              opacity: isChecking || !startDate ? 0.5 : 1,
              cursor: isChecking || !startDate ? 'default' : 'pointer',
            }}
          >
            {isChecking ? 'Verificando...' : 'Verificar período'}
          </button>
        </div>
      ) : (
        /* Prévia de impacto — passo 2 */
        <div style={{ ...cardStyle, gap: 14 }}>
          <div>
            <p style={{ ...rowTitle, margin: 0 }}>
              {fmtDate(startDate)}
              {endDate && endDate !== startDate ? ` até ${fmtDate(endDate)}` : ''}
            </p>
            <p style={rowHint}>
              {impact.days === 1 ? '1 dia' : `${impact.days} dias`}
              {reason.trim() ? ` · ${reason.trim()}` : ''}
            </p>
          </div>

          {nada ? (
            <p style={{ ...rowHint, margin: 0 }}>
              Nenhum pedido ou Cestinha nesse período.
              {impact.schedules > 0
                ? ` ${impact.schedules} cliente(s) com agenda ativa nesses dias serão avisados.`
                : ''}
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ImpactRow label="Pedidos de pão" value={String(impact.orders)} />
                <ImpactRow label="Cestinhas" value={String(impact.cestinhas)} />
                <ImpactRow label="Pães envolvidos" value={String(impact.breads)} />
                <ImpactRow label="Clientes afetados" value={String(impact.clients)} />
                <ImpactRow label="Agendas nesses dias" value={String(impact.schedules)} />
                <ImpactRow
                  label="Pãezins a estornar"
                  value={impact.refundableCredits.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                />
              </div>
              <p style={{ ...rowHint, margin: 0, lineHeight: 1.5 }}>
                Escolha o que fazer com o que já existe nessas datas. Cancelar devolve os pãezins ao
                saldo dos clientes e o estoque dos itens da Cestinha.
              </p>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!nada && (
              <button
                type="button"
                onClick={() => void confirmar(true)}
                disabled={isSaving}
                style={{ ...primaryButton, opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? 'Salvando...' : 'Bloquear e cancelar com estorno'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void confirmar(false)}
              disabled={isSaving}
              style={{
                ...primaryButton,
                background: nada ? 'var(--color-espresso)' : 'var(--color-surface-2)',
                color: nada ? '#FAF5EC' : 'var(--color-text)',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              {nada ? (isSaving ? 'Salvando...' : 'Bloquear período') : 'Bloquear só para novos pedidos'}
            </button>
            <button
              type="button"
              onClick={() => setImpact(null)}
              disabled={isSaving}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--color-text-sec)',
                background: 'none',
                border: 'none',
                padding: '6px 0',
                cursor: 'pointer',
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-accent)',
            margin: '10px 0 0',
          }}
        >
          {error}
        </p>
      )}

      {/* Lista dos bloqueios vigentes */}
      <div style={{ marginTop: 14 }}>
        {isLoading ? (
          <p style={{ ...rowHint, margin: 0 }}>Carregando...</p>
        ) : blocks.length === 0 ? (
          <p style={{ ...rowHint, margin: 0 }}>Nenhuma data bloqueada.</p>
        ) : (
          <div style={{ ...cardStyle, gap: 0 }}>
            {blocks.map((b, idx) => (
              <div key={b.id}>
                {idx > 0 && <div style={{ height: 1, background: 'var(--color-border-2)', margin: '12px 0' }} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...rowTitle, margin: 0 }}>
                      {b.startDate === b.endDate
                        ? fmtDate(b.startDate)
                        : `${fmtDate(b.startDate)} — ${fmtDate(b.endDate)}`}
                    </p>
                    <p style={rowHint}>
                      {b.condominiumName ?? 'Todos os condomínios'}
                      {b.reason ? ` · ${b.reason}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remover bloqueio"
                    onClick={() => void remover(b.id)}
                    style={{
                      background: 'var(--color-surface-2)',
                      border: 'none',
                      borderRadius: 10,
                      width: 34,
                      height: 34,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="minus" size={16} color="var(--color-text-sec)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ subcomponentes
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--color-text-ter)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function ImpactRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ ...rowHint, margin: 0 }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ------------------------------------------------------------------ estilos
const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--color-text-sec)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  margin: '0 0 9px',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 16,
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const rowTitle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--color-text)',
  margin: 0,
}

const rowHint: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--color-text-ter)',
  margin: '2px 0 0',
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-text)',
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '9px 12px',
  minWidth: 0,
}

const primaryButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
  minHeight: 44,
  background: 'var(--color-espresso)',
  color: '#FAF5EC',
  border: 'none',
  borderRadius: 14,
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: '-0.01em',
}
