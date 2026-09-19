import { useEffect, useState } from 'react'
import { Icon } from '../brand/Icon'
import { hhmm, humanDuration, type ProductAvailability } from '../../lib/product-availability'

// Presets de pausa. São o caminho de 2 toques para o momento de pânico ("acabou o lote agora") —
// por isso a folha abre direto da linha da lista, sem entrar no produto.
const PRESETS = [15, 30, 60] as const

interface PauseProductSheetProps {
  open: boolean
  productName: string
  /** Estado atual — decide entre pausar e religar, e explica sobreposição com o horário. */
  availability?: ProductAvailability
  busy?: boolean
  /** `minutes` ausente = pausa sem prazo ("até eu religar"). */
  onPause: (payload: { minutes?: number; reason?: string }) => void
  onResume: () => void
  onCancel: () => void
}

/**
 * PauseProductSheet — pausa de VITRINE de um produto (bloqueia agora, para qualquer data).
 *
 * Não confundir com a janela de horário do produto, que é corte por ciclo de entrega e mora no
 * formulário. As duas convivem: quando a pausa com prazo vence, a janela volta a mandar — e a
 * folha diz isso em vez de fingir que religar resolve.
 */
export function PauseProductSheet({
  open,
  productName,
  availability,
  busy = false,
  onPause,
  onResume,
  onCancel,
}: PauseProductSheetProps) {
  const [minutes, setMinutes] = useState<number | null>(30)
  const [custom, setCustom] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [reason, setReason] = useState('')

  // Reabrir a folha não pode herdar a escolha da vez anterior.
  useEffect(() => {
    if (open) {
      setMinutes(30)
      setCustom('')
      setCustomMode(false)
      setReason('')
    }
  }, [open])

  if (!open) return null

  const isPaused = availability?.state === 'pausado'
  const pausedByClock = isPaused && availability?.reason === 'horario'

  const effectiveMinutes = customMode ? Number(custom) : minutes
  const validCustom = !customMode || (Number.isFinite(effectiveMinutes) && (effectiveMinutes ?? 0) >= 1 && (effectiveMinutes ?? 0) <= 1440)
  const backAt =
    effectiveMinutes != null && validCustom && effectiveMinutes > 0
      ? new Date(Date.now() + effectiveMinutes * 60_000)
      : null

  const submit = () => {
    if (customMode && !validCustom) return
    onPause({
      minutes: effectiveMinutes ?? undefined,
      reason: reason.trim() ? reason.trim() : undefined,
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
        padding: '0 0 env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          padding: '22px 20px 30px',
          width: '100%',
          maxWidth: 480,
          maxHeight: '86dvh',
          overflowY: 'auto',
        }}
      >
        <h2
          id="pause-sheet-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: '0 0 4px',
            letterSpacing: '-0.02em',
          }}
        >
          {isPaused ? 'Produto pausado' : `Pausar “${productName}”`}
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: '0 0 16px', lineHeight: 1.45 }}>
          {isPaused
            ? 'Para o cliente ele aparece como “Esgotado” — nunca como pausado.'
            : 'O cliente vê “Esgotado” e o card continua na vitrine.'}
        </p>

        {isPaused ? (
          <PausedState availability={availability} productName={productName} />
        ) : (
          <>
            {/* Duração */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PRESETS.map((m) => (
                <Chip
                  key={m}
                  active={!customMode && minutes === m}
                  onClick={() => {
                    setCustomMode(false)
                    setMinutes(m)
                  }}
                >
                  {m === 60 ? '1 h' : `${m} min`}
                </Chip>
              ))}
              <Chip active={customMode} onClick={() => setCustomMode(true)}>
                Personalizado
              </Chip>
              <Chip
                active={!customMode && minutes === null}
                onClick={() => {
                  setCustomMode(false)
                  setMinutes(null)
                }}
              >
                Até eu religar
              </Chip>
            </div>

            {customMode && (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--color-surface-alt, #FBF6EC)',
                    border: `1.5px solid ${validCustom ? 'var(--color-border)' : 'var(--color-accent)'}`,
                    borderRadius: 14,
                    padding: '11px 14px',
                  }}
                >
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={custom}
                    autoFocus
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="90"
                    aria-label="Minutos de pausa"
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontFamily: 'var(--font-body)',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>minutos</span>
                </div>
                {!validCustom && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-accent)', margin: '6px 2px 0' }}>
                    Entre 1 e 1440 minutos. Para mais que um dia, use “Até eu religar”.
                  </p>
                )}
              </div>
            )}

            {/* Prévia da volta */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                background: 'var(--color-espresso)',
                borderRadius: 12,
                padding: '11px 13px',
                marginTop: 12,
              }}
            >
              <Icon name="clock" size={16} color="var(--color-gold, #E3AC3F)" stroke={2} aria-hidden="true" />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: '#F4E8D2', margin: 0 }}>
                {backAt
                  ? `Volta sozinho às ${hhmm(backAt.toISOString())}`
                  : 'Fica pausado até você religar'}
              </p>
            </div>

            {pausedByClock && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-sec)', margin: '10px 2px 0', lineHeight: 1.45 }}>
                Este produto já está fora do prazo do próximo pedido
                {availability?.until ? ` (volta às ${hhmm(availability.until)})` : ''}. A pausa vale
                para quando ele reabrir.
              </p>
            )}

            {/* Motivo */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7 }}>
                Motivo (opcional)
              </div>
              <div
                style={{
                  background: 'var(--color-surface-alt, #FBF6EC)',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 14,
                  padding: '11px 14px',
                }}
              >
                <input
                  value={reason}
                  maxLength={120}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex.: acabou o lote da manhã"
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    color: 'var(--color-text)',
                  }}
                />
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '6px 2px 0' }}>
                Só a equipe vê. O cliente nunca recebe o motivo.
              </p>
            </div>
          </>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCancel} disabled={busy} style={secondaryBtn(busy)}>
            {isPaused ? 'Fechar' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={isPaused ? onResume : submit}
            disabled={busy || (!isPaused && customMode && !validCustom)}
            style={primaryBtn(busy || (!isPaused && customMode && !validCustom))}
          >
            {busy ? '...' : isPaused ? 'Despausar agora' : 'Pausar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Resumo do que está segurando o produto agora — e o que religar de fato resolve. */
function PausedState({
  availability,
  productName,
}: {
  availability?: ProductAvailability
  productName: string
}) {
  const reason = availability?.reason
  const until = availability?.until

  const line =
    reason === 'temporaria' && until
      ? `“${productName}” volta sozinho às ${hhmm(until)} (em ${humanDuration(Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 60_000)))}).`
      : reason === 'horario'
        ? `“${productName}” está fora do prazo do próximo pedido${until ? ` e volta às ${hhmm(until)}` : ''}. Isso vem da janela de horário do produto — despausar não muda essa regra.`
        : `“${productName}” está pausado sem prazo. Só volta quando você religar.`

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        background: 'var(--color-gold-soft, #F3DDA6)',
        borderRadius: 14,
        padding: '12px 14px',
      }}
    >
      <Icon name="clock" size={17} color="#6b4e12" stroke={2} aria-hidden="true" />
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: '#6b4e12', margin: 0, lineHeight: 1.45 }}>
        {line}
      </p>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 38,
        padding: '0 14px',
        borderRadius: 999,
        border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
        background: active ? 'var(--color-surface)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-sec)',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function secondaryBtn(busy: boolean): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    border: '1.5px solid var(--color-border)',
    background: 'transparent',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--color-text)',
    cursor: busy ? 'default' : 'pointer',
  }
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    border: 'none',
    background: 'var(--color-espresso)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    fontWeight: 700,
    color: '#FAF5EC',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}
