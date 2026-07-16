/**
 * CutoffPopup — aviso flutuante e NÃO-bloqueante de horário de corte ("Eita, foi por pouquin!").
 *
 * Diferente de um modal: não tem backdrop escuro e não trava a tela — é um card suave que
 * desliza do topo, informa e pode ser dispensado no X. Usado na agenda para avisar, sem
 * interromper, que só a entrega já travada não sai (o resto da semana segue valendo).
 * Segue a identidade do app: superfície, borda dourada, ícone de relógio.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../brand/Icon'

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function CutoffPopup({
  open,
  title = 'Eita, foi por pouquin!',
  children,
  onClose,
  autoCloseMs = 7000,
}: {
  open: boolean
  title?: string
  children: ReactNode
  onClose: () => void
  /** Fecha sozinho após N ms mesmo sem o usuário tocar no X. 0/undefined desativa. */
  autoCloseMs?: number
}) {
  // Guarda o onClose mais recente sem reiniciar o timer a cada render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open || !autoCloseMs) return
    const t = setTimeout(() => onCloseRef.current(), autoCloseMs)
    return () => clearTimeout(t)
  }, [open, autoCloseMs])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top) + 14px)',
            left: 16,
            right: 16,
            margin: '0 auto',
            maxWidth: 420,
            zIndex: 200,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-accent)',
            borderRadius: 16,
            padding: '13px 12px 13px 14px',
            boxShadow: '0 10px 30px rgba(30,18,7,0.18)',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              background: 'var(--color-gold-soft)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <Icon name="clock" size={19} color="var(--color-accent)" />
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 500,
                color: 'var(--color-text-sec)',
                lineHeight: 1.45,
              }}
            >
              {children}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar aviso"
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 9,
              border: 'none',
              background: 'var(--color-surface-2)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              marginTop: -2,
            }}
          >
            <Icon name="x" size={15} color="var(--color-text-ter)" stroke={2.2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
