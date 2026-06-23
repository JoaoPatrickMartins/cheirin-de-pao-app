import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
interface Slot {
  slotId: string
  name: string
  label: string
  emoji: string
  time: string
  cutoffTime: string
  isActive: boolean
}

interface AdminCortesProps {
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// ------------------------------------------------------------------ componente
export function AdminCortes({ onBack }: AdminCortesProps) {
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const res = await apiFetch('/admin/settings/slots')
        if (res.ok) {
          const data = (await res.json()) as { slots: Slot[] }
          setSlots(data.slots)
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchSlots()
  }, [])

  const setCutoff = (slotId: string, value: string) => {
    setSaved(false)
    setSlots((prev) =>
      prev ? prev.map((s) => (s.slotId === slotId ? { ...s, cutoffTime: value } : s)) : prev,
    )
  }

  const setTime = (slotId: string, value: string) => {
    setSaved(false)
    setSlots((prev) =>
      prev ? prev.map((s) => (s.slotId === slotId ? { ...s, time: value } : s)) : prev,
    )
  }

  const toggleActive = (slotId: string) => {
    setSaved(false)
    setSlots((prev) =>
      prev ? prev.map((s) => (s.slotId === slotId ? { ...s, isActive: !s.isActive } : s)) : prev,
    )
  }

  const handleSalvar = async () => {
    if (!slots) return
    setError(null)
    const invalid = slots.find((s) => !HHMM.test(s.cutoffTime))
    if (invalid) {
      setError(`Horário de corte inválido em "${invalid.label}". Use HH:MM.`)
      return
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
        body: JSON.stringify({
          slots: slots.map((s) => ({
            slotId: s.slotId,
            time: s.time,
            cutoffTime: s.cutoffTime,
            isActive: s.isActive,
          })),
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
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            color: 'var(--color-text-sec)',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Após o corte de cada turno, novos pedidos para a próxima entrega daquele turno são
          bloqueados. Você pode ajustar o horário de entrega e o horário de corte de cada turno.
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

                {/* Editor de horário de corte */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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
                  <input
                    type="time"
                    value={slot.cutoffTime}
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
                Horários salvos e aplicados a todos os condomínios.
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
