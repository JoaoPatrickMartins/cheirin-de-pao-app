import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './brand/Icon'
import { CRIconBtn, CR_BODY } from './courier/kit'

/**
 * Foto do comprovante em tela cheia (A1 do admin · C2 do cliente). Fundo escuro, título + linha
 * de contexto no topo, "Baixar" e um rodapé livre (validade da foto, "Fale com o suporte").
 *
 * A URL é assinada e vence em minutos: se a imagem não carregar, `onExpired` pede uma nova.
 */
export function PhotoViewer({
  url,
  title,
  meta,
  footer,
  onClose,
  onExpired,
}: {
  url: string
  title: string
  meta?: string
  footer?: ReactNode
  onClose: () => void
  onExpired?: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [url])

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    boxRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#070402', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: CR_BODY }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 12px' }}>
        <CRIconBtn icon="x" tone="dark" label="Fechar" onClick={onClose} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          {meta && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{meta}</div>}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download
          aria-label="Baixar"
          style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.14)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <Icon name="download" size={20} aria-hidden="true" />
        </a>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: '10px 0' }}>
        {broken ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Icon name="cloudOff" size={30} color="rgba(255,255,255,0.7)" aria-hidden="true" />
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 10 }}>Não conseguimos abrir a foto</div>
            {onExpired && (
              <button
                type="button"
                onClick={onExpired}
                style={{ marginTop: 14, minHeight: 44, padding: '0 18px', borderRadius: 14, border: 'none', background: 'var(--color-gold)', color: 'var(--color-espresso)', fontFamily: CR_BODY, fontWeight: 800, fontSize: 14.5, cursor: 'pointer' }}
              >
                Tentar de novo
              </button>
            )}
          </div>
        ) : (
          <img
            src={url}
            alt={meta ? `${title} · ${meta}` : title}
            onError={() => setBroken(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        )}
      </div>
      {footer && <div style={{ padding: '14px 20px calc(24px + env(safe-area-inset-bottom, 0px))' }}>{footer}</div>}
    </div>
  )
}
