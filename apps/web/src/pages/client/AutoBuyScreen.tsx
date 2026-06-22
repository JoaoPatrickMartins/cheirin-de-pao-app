import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { BreadMark } from '../../components/brand/BreadMark'

interface Combo {
  id: string
  name: string
  quantity: number
  price: number
  isActive: boolean
}

const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function AutoBuyScreen() {
  const navigate = useNavigate()
  const [isOn, setIsOn] = useState(false)
  const [combos, setCombos] = useState<Combo[]>([])
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [combosRes, statusRes] = await Promise.all([
          apiFetch('/combos'),
          apiFetch('/users/me/auto-recharge'),
        ])
        const combosData = combosRes.ok ? ((await combosRes.json()) as Combo[]) : []
        setCombos(combosData)

        let preselected: string | null = combosData[0]?.id ?? null
        if (statusRes.ok) {
          const st = (await statusRes.json()) as { active: boolean; comboId: string | null }
          setIsOn(st.active)
          if (st.comboId && combosData.some((c) => c.id === st.comboId)) preselected = st.comboId
        }
        setSelectedComboId(preselected)
      } catch {
        // estado padrão (desligado) se falhar
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  const selectedCombo = combos.find((c) => c.id === selectedComboId)

  const handleSave = async () => {
    if (isOn && !selectedComboId) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await apiFetch('/users/me/auto-recharge', {
        method: 'PUT',
        body: JSON.stringify({ active: isOn, comboId: selectedComboId ?? undefined }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => navigate(-1), 1100)
      } else {
        const err = (await res.json()) as { error?: string }
        setError(err.error ?? 'Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const ctaLabel = saved
    ? 'Salvo!'
    : isOn
      ? selectedCombo
        ? `Ativar · ${selectedCombo.name} · ${formatBRL(selectedCombo.price)}`
        : 'Selecione um combo'
      : 'Salvar (desativada)'

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* AppBar */}
      <div
        style={{
          paddingTop: 'calc(6px + env(safe-area-inset-top))',
          padding: '6px 20px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          style={{
            minHeight: 44,
            width: 38,
            height: 38,
            borderRadius: 12,
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} color="var(--color-text)" />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          Compra automática
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 120px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Card mestre — identidade espresso (igual ao card de créditos da Home) */}
        <div
          style={{
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-soft)',
            background: 'linear-gradient(135deg, #1E1207, #2E1D0D)',
            position: 'relative',
            padding: '22px',
          }}
        >
          {/* Watermark do pão */}
          <div style={{ position: 'absolute', bottom: -54, right: -34, opacity: 0.1, pointerEvents: 'none' }}>
            <BreadMark size={200} color="#E3AC3F" />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#C7B595',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  margin: '0 0 7px',
                }}
              >
                Recarga automática
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 9px' }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: isOn ? '#E3AC3F' : 'rgba(255,255,255,0.28)',
                    boxShadow: isOn ? '0 0 0 4px rgba(227,172,63,0.18)' : 'none',
                    flexShrink: 0,
                    transition: 'background .2s, box-shadow .2s',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 24,
                    color: '#FAF5EC',
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {isOn ? 'Ativada' : 'Desativada'}
                </span>
              </div>

              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  margin: 0,
                  color: '#9A876B',
                  maxWidth: '94%',
                }}
              >
                Quando o saldo não cobrir uma entrega agendada, recarregamos sozinho no seu
                cartão padrão — sem CVV. Você nunca fica sem pãezinhos.
              </p>
            </div>
            <Toggle on={isOn} onToggle={() => setIsOn((v) => !v)} disabled={isLoading} />
          </div>
        </div>

        {/* Seleção de combo (só quando ligada) */}
        {isOn && (
          <div>
            <SectionLabel>QUAL COMBO RECARREGAR?</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {isLoading && <SkeletonRow />}
              {!isLoading &&
                combos.map((combo) => {
                  const active = selectedComboId === combo.id
                  return (
                    <button
                      key={combo.id}
                      onClick={() => setSelectedComboId(combo.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        textAlign: 'left',
                        background: 'var(--color-surface)',
                        border: active ? '2px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                        borderRadius: 'var(--radius-card)',
                        padding: '14px 16px',
                        cursor: 'pointer',
                        boxShadow: active ? 'var(--shadow-soft)' : 'none',
                        transition: 'border 120ms ease',
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            fontSize: 15,
                            color: 'var(--color-text)',
                          }}
                        >
                          {combo.name}
                        </span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)' }}>
                          {combo.quantity} pães
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--color-accent)' }}>
                          {formatBRL(combo.price)}
                        </span>
                        <Radio on={active} />
                      </span>
                    </button>
                  )
                })}
            </div>
          </div>
        )}

        {/* Nota de consentimento */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            background: 'var(--color-surface-2)',
            borderRadius: 14,
            padding: '12px 14px',
          }}
        >
          <Icon name="card" size={18} color="var(--color-text-ter)" />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-text-sec)', margin: 0 }}>
            Requer um cartão salvo (padrão). Ao ativar, você concorda com cobranças automáticas
            sem CVV nesse cartão. Você recebe um aviso a cada recarga e pode desativar quando quiser.
          </p>
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#C0392B', margin: 0 }}>{error}</p>
        )}
      </div>

      {/* CTA fixa */}
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(56px + env(safe-area-inset-bottom))',
          left: 0,
          right: 0,
          padding: '10px 20px 12px',
          background: 'var(--color-app-bg)',
          borderTop: '1px solid var(--color-border-2)',
        }}
      >
        <button
          onClick={() => void handleSave()}
          disabled={isSaving || isLoading || (isOn && !selectedComboId)}
          style={{
            width: '100%',
            minHeight: 52,
            borderRadius: 'var(--radius-btn)',
            border: 'none',
            background: saved ? 'var(--color-good)' : 'var(--color-accent)',
            color: 'var(--color-primary-btn-text)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 15,
            cursor: isSaving || isLoading || (isOn && !selectedComboId) ? 'default' : 'pointer',
            opacity: isSaving || isLoading || (isOn && !selectedComboId) ? 0.65 : 1,
            transition: 'opacity .15s, background .2s',
          }}
        >
          {isSaving ? 'Salvando…' : ctaLabel}
        </button>
      </div>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      aria-label={on ? 'desativar compra automática' : 'ativar compra automática'}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        border: 'none',
        position: 'relative',
        flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer',
        background: on ? '#E3AC3F' : 'rgba(255,255,255,0.22)',
        transition: 'background .2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 25 : 3,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'left .2s',
        }}
      />
    </button>
  )
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: on ? '6px solid var(--color-accent)' : '2px solid var(--color-border)',
        boxSizing: 'border-box',
        flexShrink: 0,
        transition: 'border .12s',
      }}
    />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.05em',
        color: 'var(--color-text-ter)',
        margin: '0 0 10px',
      }}
    >
      {children}
    </p>
  )
}

function SkeletonRow() {
  return (
    <div style={{ height: 64, borderRadius: 'var(--radius-card)', background: 'var(--color-surface-2)', opacity: 0.6 }} />
  )
}
