import { useNavigate } from 'react-router'
import { useCart } from '../../contexts/CartContext'
import { Icon } from '../brand/Icon'

/**
 * CartButton — ícone da Cestinha com contador, para a AppBar das telas do market
 * (catálogo e detalhe), onde o FloatingCart fica oculto. Abre a Cestinha.
 */
export function CartButton() {
  const navigate = useNavigate()
  const { count } = useCart()

  return (
    <button
      onClick={() => navigate('/client/market/cestinha')}
      aria-label={count > 0 ? `Cestinha (${count})` : 'Cestinha'}
      style={{
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 12,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Icon name="basket" size={20} color="var(--color-text)" stroke={2} />
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            borderRadius: 999,
            background: 'var(--color-gold)',
            color: 'var(--color-espresso)',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 800,
            display: 'grid',
            placeItems: 'center',
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}
