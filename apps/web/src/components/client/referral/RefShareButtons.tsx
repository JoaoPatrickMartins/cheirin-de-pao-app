import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from '../../brand/Icon'
import { copyText, shareReferral, whatsappShareUrl } from '../../../lib/referral'
import { COPIED_MS } from './RefCode'
import { RF_BODY } from './RefPrimitives'

/**
 * Compartilhar: WhatsApp (principal, `wa.me` com a mensagem pronta), "Mais opções" (menu do
 * celular; sem suporte, copia a mensagem) e "Copiar link" (vira "Link copiado").
 */
export function RefShareButtons({
  message,
  link,
  onToast,
}: {
  message: string
  link: string
  onToast: (msg: string) => void
}) {
  const [linkOk, setLinkOk] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const secondary: CSSProperties = {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontWeight: 700,
    fontSize: 14,
    fontFamily: RF_BODY,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  }

  const more = async () => {
    const r = await shareReferral(message)
    if (r === 'copied') onToast('Mensagem copiada — é só colar na conversa')
    if (r === 'failed') onToast('Não deu para compartilhar. Copie o código acima.')
  }

  const copyLink = async () => {
    if (!(await copyText(link))) return
    setLinkOk(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setLinkOk(false), COPIED_MS)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <a
        href={whatsappShareUrl(message)}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          minHeight: 54,
          padding: '16px 22px',
          boxSizing: 'border-box',
          borderRadius: 16,
          background: 'var(--color-espresso)',
          color: 'var(--color-primary-btn-text)',
          fontFamily: RF_BODY,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          textDecoration: 'none',
        }}
      >
        <Icon name="chat" size={19} stroke={2.2} />
        Enviar no WhatsApp
      </a>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" style={secondary} onClick={() => void more()}>
          <Icon name="share" size={18} stroke={2.1} />
          Mais opções
        </button>
        <button
          type="button"
          aria-live="polite"
          style={{ ...secondary, color: linkOk ? 'var(--color-good)' : 'var(--color-text)' }}
          onClick={() => void copyLink()}
        >
          <Icon name={linkOk ? 'check' : 'link'} size={18} stroke={2.1} />
          {linkOk ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
    </div>
  )
}
