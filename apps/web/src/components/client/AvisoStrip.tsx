/**
 * AvisoStrip — a faixa fina de aviso no topo da Home.
 *
 * O formato sem arte existe para o recado que não merece uma peça gráfica: "Feriado dia 7, sem
 * entrega". Precisa sair no ar em dois minutos, e esperar por um designer mataria o propósito.
 *
 * Não é modal nem toast: não escurece a tela, não some sozinha e não empurra o conteúdo para
 * fora da dobra — informa e sai de cena quando o cliente quiser.
 */
import { Icon } from '../brand/Icon'
import type { ClientBanner } from '../../lib/banners'

/** Fundo padrão quando o admin não escolhe cor — o dourado suave da identidade. */
const FUNDO_PADRAO = 'var(--color-gold-soft)'

export function AvisoStrip({
  banner,
  onClick,
  onDismiss,
}: {
  banner: ClientBanner
  onClick: (b: ClientBanner) => void
  onDismiss: () => void
}) {
  const clicavel = !!banner.actionUrl

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        background: banner.bgColor || FUNDO_PADRAO,
        borderRadius: 14,
        padding: '11px 11px 11px 13px',
        // Sem margem própria: o espaçamento é o `gap` da coluna da Home.
      }}
    >
      <Icon name="alert" size={17} color="var(--color-accent)" stroke={2} aria-hidden="true" />

      <button
        type="button"
        onClick={() => clicavel && onClick(banner)}
        disabled={!clicavel}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          padding: 0,
          textAlign: 'left',
          cursor: clicavel ? 'pointer' : 'default',
        }}
      >
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-display)',
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.01em',
          }}
        >
          {banner.title}
        </span>
        {banner.body && (
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              color: 'var(--color-text-sec)',
              lineHeight: 1.45,
              marginTop: 2,
            }}
          >
            {banner.body}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dispensar aviso"
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 9,
          border: 'none',
          background: 'rgba(255,255,255,0.45)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
        }}
      >
        <Icon name="x" size={14} color="var(--color-text-sec)" stroke={2.2} />
      </button>
    </div>
  )
}
