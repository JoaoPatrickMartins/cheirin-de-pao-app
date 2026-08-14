import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { CondoScopeSelector, InheritBadge } from './CondoScopeSelector'

// ------------------------------------------------------------------ tipos
interface Slot {
  slotId: string
  name: string
  label: string
  emoji: string
  time: string
  cutoffTime: string
  isActive: boolean
  /** Só na consulta por condomínio: true = horário definido localmente, false = herdado. */
  timeCustom?: boolean
  activeCustom?: boolean
}

interface AdminCortesProps {
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// ------------------------------------------------------------------ componente
export function AdminCortes({ onBack }: AdminCortesProps) {
  // null = padrão da operação. Um condomínio pode personalizar horário de entrega e ativação —
  // o horário de CORTE é sempre global (o pedido ao fornecedor assume um corte por turno).
  const [scope, setScope] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const fetchSlots = useCallback(async () => {
    setIsLoading(true)
    setSaved(false)
    setError(null)
    try {
      const qs = scope ? `?condominiumId=${scope}` : ''
      const res = await apiFetch(`/admin/settings/slots${qs}`)
      if (res.ok) {
        const data = (await res.json()) as { slots: Slot[] }
        setSlots(data.slots)
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoading(false)
    }
  }, [scope])

  useEffect(() => {
    void fetchSlots()
  }, [fetchSlots])

  const setCutoff = (slotId: string, value: string) => {
    setSaved(false)
    setSlots((prev) =>
      prev ? prev.map((s) => (s.slotId === slotId ? { ...s, cutoffTime: value } : s)) : prev,
    )
  }

  const setTime = (slotId: string, value: string) => {
    setSaved(false)
    setSlots((prev) =>
      prev ? prev.map((s) => (s.slotId === slotId ? { ...s, time: value, timeCustom: true } : s)) : prev,
    )
  }

  const toggleActive = (slotId: string) => {
    setSaved(false)
    setSlots((prev) =>
      prev
        ? prev.map((s) =>
            s.slotId === slotId ? { ...s, isActive: !s.isActive, activeCustom: true } : s,
          )
        : prev,
    )
  }

  const isCondoScope = scope !== null

  /** Faz UM turno do condomínio voltar a herdar o padrão (horário + ativação). */
  const herdarTurno = async (slotId: string) => {
    setError(null)
    setSaved(false)
    setIsSaving(true)
    try {
      const res = await apiFetch('/admin/settings/slots', {
        method: 'PATCH',
        body: JSON.stringify({
          condominiumId: scope,
          slots: [{ slotId, time: null, isActive: null }],
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { slots: Slot[] }
        setSlots(data.slots)
        setSaved(true)
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSalvar = async () => {
    if (!slots) return
    setError(null)
    // No escopo de condomínio o corte não é editável, então nem validamos.
    if (!isCondoScope) {
      const invalid = slots.find((s) => !HHMM.test(s.cutoffTime))
      if (invalid) {
        setError(`Horário de corte inválido em "${invalid.label}". Use HH:MM.`)
        return
      }
    }
    const invalidTime = slots.find((s) => !HHMM.test(s.time))
    if (invalidTime) {
      setError(`Horário de entrega inválido em "${invalidTime.label}". Use HH:MM.`)
      return
    }
    setIsSaving(true)
    try {
      const res = await apiFetch('/admin/settings/slots', {
        method: 'PATCH',
        body: JSON.stringify(
          isCondoScope
            ? {
                condominiumId: scope,
                // Por condomínio só time/isActive — cutoffTime/label/emoji são globais.
                slots: slots.map((s) => ({ slotId: s.slotId, time: s.time, isActive: s.isActive })),
              }
            : {
                slots: slots.map((s) => ({
                  slotId: s.slotId,
                  time: s.time,
                  cutoffTime: s.cutoffTime,
                  isActive: s.isActive,
                })),
              },
        ),
      })
      if (res.ok) {
        const data = (await res.json()) as { slots: Slot[] }
        setSlots(data.slots)
        setSaved(true)
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
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
          }}
        >
          Horários de corte
        </h2>
      </div>

      <div
        style={{
          overflow: 'auto',
          flex: 1,
          padding: '0 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <CondoScopeSelector value={scope} onChange={setScope} disabled={isSaving} />

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            color: 'var(--color-text-sec)',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {isCondoScope ? (
            <>
              Ajuste o horário de ENTREGA e ligue/desligue cada turno só neste condomínio. O horário
              de CORTE é o mesmo para toda a operação — ele governa a geração do pedido ao
              fornecedor, então não muda por condomínio.
            </>
          ) : (
            <>
              Após o corte de cada turno, novos pedidos para a próxima entrega daquele turno são
              bloqueados. Este é o padrão: vale para todo condomínio que não tiver horário próprio.
            </>
          )}
        </p>

        {isLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : !slots || slots.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
            Nenhum slot configurado.
          </p>
        ) : (
          <>
            {slots.map((slot) => (
              <div
                key={slot.slotId}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 16,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  opacity: slot.isActive ? 1 : 0.6,
                }}
              >
                {/* Cabeçalho do slot */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        margin: 0,
                      }}
                    >
                      {slot.emoji ? `${slot.emoji} ` : ''}
                      {slot.label}
                    </p>
                    {isCondoScope && (
                      <div style={{ marginTop: 6 }}>
                        <InheritBadge
                          custom={slot.timeCustom === true || slot.activeCustom === true}
                          onReset={
                            slot.timeCustom === true || slot.activeCustom === true
                              ? () => void herdarTurno(slot.slotId)
                              : undefined
                          }
                        />
                      </div>
                    )}
                  </div>
                  {/* Toggle ativo */}
                  <button
                    type="button"
                    onClick={() => toggleActive(slot.slotId)}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: slot.isActive ? 'var(--color-accent)' : 'var(--color-text-ter)',
                      background: 'var(--color-surface-2)',
                      border: 'none',
                      borderRadius: 10,
                      padding: '7px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    {slot.isActive ? 'Ativo' : 'Inativo'}
                  </button>
                </div>

                {/* Editor de horário de entrega */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                    }}
                  >
                    Horário de entrega
                  </span>
                  <input
                    type="time"
                    value={slot.time}
                    onChange={(e) => setTime(slot.slotId, e.target.value)}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
                      padding: '9px 12px',
                    }}
                  />
                </div>

                {/* Editor de horário de corte — read-only no escopo de condomínio (é global) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                      }}
                    >
                      Horário de corte
                    </span>
                    {isCondoScope && (
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: 'var(--color-text-ter)',
                          margin: '2px 0 0',
                        }}
                      >
                        Igual para toda a operação
                      </p>
                    )}
                  </div>
                  <input
                    type="time"
                    value={slot.cutoffTime}
                    disabled={isCondoScope}
                    onChange={(e) => setCutoff(slot.slotId, e.target.value)}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
                      padding: '9px 12px',
                      opacity: isCondoScope ? 0.55 : 1,
                    }}
                  />
                </div>
              </div>
            ))}

            {error && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-accent)',
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}

            {saved && !error && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                  margin: 0,
                }}
              >
                {isCondoScope
                  ? 'Horários salvos para este condomínio.'
                  : 'Padrão salvo e aplicado aos condomínios que não têm horário próprio.'}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleSalvar()}
              disabled={isSaving}
              style={{
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
                cursor: isSaving ? 'default' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
                letterSpacing: '-0.01em',
              }}
            >
              {isSaving ? 'Salvando...' : 'Salvar horários'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
