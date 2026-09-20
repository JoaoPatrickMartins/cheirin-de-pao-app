/**
 * MarketBanner — peça larga (3:1) dentro da vitrine do "Além do Pãozin".
 *
 * Diferente do pop-up e da faixa, esta é CONTEÚDO DE PÁGINA: não interrompe, não se dispensa e
 * não se "gasta" (o servidor nem consulta frequência para ela). Por isso também não tem X.
 *
 * `loading="lazy"` porque a peça vive abaixo da dobra da vitrine: carregá-la junto com o catálogo
 * atrasaria os produtos, que são o motivo de o cliente estar ali.
 */
import { useState } from 'react'
import type { ClientBanner } from '../../lib/banners'

export function MarketBanner({
  banner,
  onClick,
  onImageError,
}: {
  banner: ClientBanner
  onClick: (b: ClientBanner) => void
  /** A arte não carregou — só o preview do admin escuta, para poder explicar. */
  onImageError?: () => void
}) {
  const [imagemQuebrada, setImagemQuebrada] = useState(false)
  if (!banner.imageUrl || imagemQuebrada) return null

  const clicavel = !!banner.actionUrl

  return (
    <button
      type="button"
      onClick={() => clicavel && onClick(banner)}
      disabled={!clicavel}
      aria-label={banner.alt ?? undefined}
      style={{
        display: 'block',
        width: '100%',
        padding: 0,
        // Sem margem própria: quem empilha define o espaçamento. Dentro do carrossel uma margem
        // aqui empurraria os dots para fora da arte.
        border: 'none',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--color-surface-2)',
        cursor: clicavel ? 'pointer' : 'default',
        // Fio de contorno por dentro, além da sombra: numa arte clara a peça se dissolveria no
        // creme do fundo sem ele. `inset` para não ocupar layout nem brigar com o raio da borda.
        boxShadow: 'var(--shadow-soft), inset 0 0 0 1px rgba(30,18,7,0.06)',
      }}
    >
      <img
        src={banner.imageUrl}
        alt={banner.alt ?? ''}
        loading="lazy"
        onError={() => {
          setImagemQuebrada(true)
          onImageError?.()
        }}
        style={{ display: 'block', width: '100%', aspectRatio: '3 / 1', objectFit: 'cover' }}
      />
    </button>
  )
}
