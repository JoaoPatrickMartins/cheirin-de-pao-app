import { useLocation, useNavigate } from 'react-router'
import { useCart } from '../../contexts/CartContext'
import { Icon } from '../brand/Icon'
import { formatBRL } from '../../lib/market'

// Só nas telas de navegação SEM barra de ação fixa própria (evita colisão com CTAs fixos
// de Combos/Agenda/Pedido único/Cartões etc., e com a própria área do market). O acesso à
// Cestinha nessas outras telas se dá pelo CartButton (AppBar do market) ou pelo add-on C8.
const SHOW_ON = new Set([
  '/client',
  '/client/home',
  '/client/pedidos',
  '/client/perfil',
  '/client/notificacoes',
])

/**
 * FloatingCart — botão flutuante da Cestinha, acima da tab bar. Aparece quando há itens
 * no carrinho, apenas nas telas de navegação sem rodapé de ação fixo.
 */
export function FloatingCart() {
  const navigate = useNavigate()
  const location = useLocation()
  const { count, subtotal } = useCart()

  if (!SHOW_ON.has(location.pathname)) return null
  if (count <= 0) return null

  return (
    <button
      onClick={() => navigate('/client/market/cestinha')}
      aria-label={`Abrir Cestinha — ${count} ${count === 1 ? 'item' : 'itens'}, ${formatBRL(subtotal)}`}
      style={{
        // Pílula compacta ancorada à direita, acima da tab bar (design).
        position: 'fixed',
        right: 16,
        bottom: 'calc(56px + env(safe-area-inset-bottom) + 12px)',
        zIndex: 45,
        height: 48,
        borderRadius: 16,
        border: 'none',
        background: 'var(--color-espresso)',
        boxShadow: 'var(--shadow-strong)',
        color: '#FBF3E4',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 18px 0 15px',
      }}
    >
      <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        <Icon name="basket" size={22} color="var(--color-gold)" stroke={2} />
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: -10,
            minWidth: 17,
            height: 17,
            padding: '0 4px',
            borderRadius: 999,
            background: 'var(--color-gold)',
            color: 'var(--color-espresso)',
            fontFamily: 'var(--font-body)',
            fontSize: 10.5,
            fontWeight: 800,
            display: 'grid',
            placeItems: 'center',
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
        {formatBRL(subtotal)}
      </span>
    </button>
  )
}
