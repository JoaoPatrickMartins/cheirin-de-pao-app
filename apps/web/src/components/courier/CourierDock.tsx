import { Icon } from '../brand/Icon'
import { CRBig, CR_BODY } from './kit'

export type DockMode = 'scan' | 'start' | 'end' | 'none'

/**
 * Dock fixo no rodapé da tela do entregador (E1 do handoff): a ação do momento fica SEMPRE na área
 * do polegar, mesmo com a lista rolada (G-17).
 *
 * - `scan` (em rota): Escanear cupom + "N/M" e o teclado do "Digitar código";
 * - `start` (rota pronta): Iniciar rota · turno;
 * - `end` (tudo resolvido): Encerrar rota do turno;
 * - `none`: nada (dia encerrado, folga, sem entregas).
 */
export function CourierDock({
  mode = 'scan',
  counter,
  turno,
  onScan,
  onTypeCode,
  onStart,
  onEnd,
}: {
  mode?: DockMode
  counter: string
  /** "☀️ Manhã" — no Iniciar e no Encerrar. */
  turno?: { emoji: string; label: string }
  onScan: () => void
  onTypeCode: () => void
  onStart?: () => void
  onEnd?: () => void
}) {
  if (mode === 'none') return null
  const turnoText = turno ? `${turno.emoji ? `${turno.emoji} ` : ''}${turno.label}` : ''
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        padding: '12px 16px calc(22px + env(safe-area-inset-bottom, 0px))',
        background: 'linear-gradient(to top, var(--color-app-bg) 70%, rgba(250,245,236,0))',
        fontFamily: CR_BODY,
      }}
    >
      <div style={{ display: 'flex', gap: 10, maxWidth: 560, margin: '0 auto' }}>
        {mode === 'scan' && (
          <>
            <CRBig
              icon="camera"
              h={62}
              onClick={onScan}
              style={{ flex: 1, boxShadow: '0 10px 24px -10px rgba(30,18,7,0.6)' }}
              right={
                <span
                  aria-label={`${counter} paradas`}
                  style={{ marginLeft: 4, padding: '3px 9px', borderRadius: 99, background: 'rgba(227,172,63,0.18)', color: 'var(--color-gold)', fontSize: 13, fontWeight: 800 }}
                >
                  {counter}
                </span>
              }
            >
              Escanear cupom
            </CRBig>
            <button
              type="button"
              onClick={onTypeCode}
              aria-label="Digitar código"
              style={{
                width: 62,
                height: 62,
                borderRadius: 18,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <Icon name="keyboard" size={24} stroke={2} aria-hidden="true" />
            </button>
          </>
        )}
        {mode === 'start' && (
          <CRBig icon="play" h={62} onClick={onStart} style={{ flex: 1, boxShadow: '0 10px 24px -10px rgba(30,18,7,0.6)' }}>
            Iniciar rota{turnoText ? ` · ${turnoText}` : ''}
          </CRBig>
        )}
        {mode === 'end' && (
          <CRBig icon="flag" variant="gold" h={62} onClick={onEnd} style={{ flex: 1 }}>
            Encerrar rota{turno ? ` da ${turno.label.toLowerCase()}` : ''}
          </CRBig>
        )}
      </div>
    </div>
  )
}
