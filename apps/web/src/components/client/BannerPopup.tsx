/**
 * BannerPopup — o pop-up de abertura: arte, botão opcional e X.
 *
 * Puramente apresentacional: recebe a peça pronta e devolve os dois gestos (clicar, fechar). Quem
 * decide SE ele aparece é o ClientLayout, e quem decide QUANDO ele volta é o servidor. Isso é o
 * que permite o admin renderizar este mesmo componente no preview, com dados locais.
 *
 * Três cuidados que não são enfeite:
 *   - imagem que falha some a peça inteira (`onError`), em vez de deixar um retângulo cinza;
 *   - Esc e toque no fundo fecham — o X não é a única saída;
 *   - o X fica FORA do card, com alvo de 44px, para não competir com o CTA (padrão do McDonald's,
 *     do iFood e cia., e a razão é a mesma: dedo grande, arte colada na borda).
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../brand/Icon'
import type { ClientBanner } from '../../lib/banners'

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function BannerPopup({
  banner,
  onClick,
  onClose,
  onImageError,
  inline = false,
}: {
  banner: ClientBanner
  onClick: (b: ClientBanner) => void
  onClose: () => void
  /**
   * A arte não carregou. No app ninguém escuta (sumir em silêncio é o certo); o preview do admin
   * escuta para poder EXPLICAR, em vez de mostrar uma caixa vazia.
   */
  onImageError?: () => void
  /**
   * Prende a peça ao container em vez da viewport. Serve ao preview do admin, que mostra o
   * pop-up dentro de uma moldura de celular — é o que permite o admin conferir a arte no
   * componente REAL, e não numa maquete que pode divergir dele.
   */
  inline?: boolean
}) {
  const [imagemQuebrada, setImagemQuebrada] = useState(false)
  // O modal só se revela com a arte pronta. Sem isso ele monta como um card branco e vazio e a
  // imagem chega depois — em rede lenta é meio segundo de caixa vazia, e com arte quebrada vira
  // o "aparece e some na hora".
  const [artePronta, setArtePronta] = useState(false)

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  // Sem arte não há pop-up: melhor nada do que uma caixa vazia sobre a Home.
  if (!banner.imageUrl || imagemQuebrada) return null

  const clicavel = !!banner.actionUrl

  /**
   * Largura do card — o que define o tamanho da peça, já que a arte é sempre 4:5.
   *
   * Fora do preview, o teto é 420px — acima da largura útil de qualquer celular comum, então na
   * prática a peça ocupa a tela inteira menos o respiro de 14px de cada lado. É o máximo antes de
   * a arte encostar na borda.
   *
   * A segunda trava é por ALTURA: o que sobra de tela vezes 0,8 (o inverso do 4:5). Sem ela, um
   * celular curto cortaria o rodapé da arte junto com o botão de fechar — maior e pior.
   *
   * No preview do admin a conta não serve: `dvh` mede a janela inteira, não a caixinha do
   * formulário. Lá vale uma largura fixa menor, que cabe na moldura sem cortar nada.
   */
  const larguraCard = inline ? 260 : 'min(420px, calc((100dvh - 170px) * 0.8))'

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={banner.alt ?? 'Aviso'}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: artePronta ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: inline ? 'absolute' : 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: inline ? 1 : 100,
          // Invisível não pode continuar clicável: um fundo transparente que engole o toque
          // deixaria a Home inerte enquanto a arte não chega.
          pointerEvents: artePronta ? 'auto' : 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          // O respiro que sobra entre a arte e a borda da tela.
          padding: 14,
        }}
      >
        <motion.div
          // O clique no card não pode fechar junto com o clique no fundo.
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
          style={{ position: 'relative', width: '100%', maxWidth: larguraCard }}
        >
          <button
            type="button"
            onClick={() => clicavel && onClick(banner)}
            aria-label={banner.alt ?? undefined}
            disabled={!clicavel}
            style={{
              display: 'block',
              width: '100%',
              padding: 0,
              border: 'none',
              borderRadius: 20,
              overflow: 'hidden',
              background: 'var(--color-surface)',
              cursor: clicavel ? 'pointer' : 'default',
              boxShadow: '0 18px 44px rgba(30,18,7,0.3)',
            }}
          >
            <img
              src={banner.imageUrl}
              alt={banner.alt ?? ''}
              onLoad={() => setArtePronta(true)}
              onError={() => {
                setImagemQuebrada(true)
                onImageError?.()
              }}
              style={{ display: 'block', width: '100%', aspectRatio: '4 / 5', objectFit: 'cover' }}
            />
          </button>

          {/* CTA flutuando sobre a base da arte — some quando a peça é só aviso. */}
          {clicavel && banner.ctaLabel && (
            <button
              type="button"
              onClick={() => onClick(banner)}
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -18,
                transform: 'translateX(-50%)',
                minHeight: 44,
                padding: '0 26px',
                borderRadius: 999,
                border: 'none',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                fontSize: 14.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: '0 8px 22px rgba(30,18,7,0.28)',
              }}
            >
              {banner.ctaLabel}
            </button>
          )}
        </motion.div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar aviso"
          style={{
            marginTop: 14,
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.16)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="x" size={20} color="#FFFFFF" stroke={2.2} />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
