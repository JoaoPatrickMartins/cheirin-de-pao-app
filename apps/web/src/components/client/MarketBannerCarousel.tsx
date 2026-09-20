/**
 * MarketBannerCarousel — as peças do mercadinho quando há mais de uma.
 *
 * Não existe modo "carrossel" configurável: uma peça no ar é um banner estático, duas ou mais
 * viram carrossel. O modo é consequência de quantas peças estão publicadas, então nunca dá para
 * um banner ficar marcado "No ar" no admin e invisível no app por causa de um interruptor.
 *
 * Rolagem nativa com `scroll-snap`, não cross-fade: num carrossel de imagem o dedo VAI tentar
 * arrastar, e reimplementar arraste em JS só para ignorar o que o navegador já faz bem seria
 * troca ruim. Os dots e a auto-rotação andam por cima disso, mexendo no scroll.
 *
 * A auto-rotação **pára de vez** no primeiro toque: quem assumiu o controle não quer a peça
 * trocando sozinha embaixo do dedo. Mesma regra do DeliveryBannerCarousel da Home.
 *
 * A impressão é contada **por peça, quando ela fica ativa E o carrossel está na tela** — e uma
 * vez só. Contar as cinco de saída, como a versão empilhada fazia, inflaria o denominador do CTR
 * com slides que ninguém chegou a ver.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { MarketBanner } from './MarketBanner'
import type { ClientBanner } from '../../lib/banners'

/** Tempo de cada peça antes de girar. */
const INTERVALO_MS = 5000

export function MarketBannerCarousel({
  banners,
  onClick,
  onSeen,
}: {
  banners: ClientBanner[]
  onClick: (b: ClientBanner) => void
  /** Chamado uma vez por peça, quando ela aparece de verdade. */
  onSeen: (id: string) => void
}) {
  const trilhoRef = useRef<HTMLDivElement>(null)
  const [ativo, setAtivo] = useState(0)
  const [interagiu, setInteragiu] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const [semMovimento, setSemMovimento] = useState(false)
  const contadas = useRef<Set<string>>(new Set())

  // Quem pede menos animação no sistema não recebe auto-rotação nem rolagem suave.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    setSemMovimento(mq.matches)
    const ouvir = (e: MediaQueryListEvent) => setSemMovimento(e.matches)
    mq.addEventListener?.('change', ouvir)
    return () => mq.removeEventListener?.('change', ouvir)
  }, [])

  // O carrossel está na tela? Sem isso, contaríamos impressão de uma peça que o cliente nunca
  // rolou até ver — a vitrine é longa.
  useEffect(() => {
    const el = trilhoRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisivel(true) // sem suporte, o melhor palpite é "está à vista"
      return
    }
    const io = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const irPara = useCallback(
    (i: number) => {
      const el = trilhoRef.current
      if (!el) return
      const left = i * el.clientWidth
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ left, behavior: semMovimento ? 'auto' : 'smooth' })
      } else {
        el.scrollLeft = left
      }
      // Não espera o evento de rolagem: os dots respondem no toque, sem atraso da animação.
      setAtivo(i)
    },
    [semMovimento],
  )

  // Auto-rotação. Um timeout por vez (e não um intervalo) para o relógio reiniciar a cada troca,
  // inclusive nas feitas à mão — senão um toque nos dots poderia ser seguido de um giro imediato.
  useEffect(() => {
    if (interagiu || semMovimento || banners.length < 2 || !visivel) return
    const t = setTimeout(() => irPara((ativo + 1) % banners.length), INTERVALO_MS)
    return () => clearTimeout(t)
  }, [ativo, interagiu, semMovimento, banners.length, visivel, irPara])

  // Impressão: uma vez por peça, quando ela está ativa com o carrossel à vista.
  useEffect(() => {
    if (!visivel) return
    const b = banners[ativo]
    if (!b || contadas.current.has(b.id)) return
    contadas.current.add(b.id)
    onSeen(b.id)
  }, [visivel, ativo, banners, onSeen])

  const aoRolar = () => {
    const el = trilhoRef.current
    if (!el || el.clientWidth === 0) return
    setAtivo(Math.round(el.scrollLeft / el.clientWidth))
  }

  const assumirControle = () => setInteragiu(true)

  return (
    <div
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques do Além do Pãozin"
      style={{ position: 'relative' }}
    >
      <div
        ref={trilhoRef}
        onScroll={aoRolar}
        onPointerDown={assumirControle}
        onTouchStart={assumirControle}
        style={{
          display: 'flex',
          // SEM `gap`: o índice ativo é `scrollLeft / clientWidth`, e qualquer espaço entre
          // slides faria essa conta derivar a cada peça. Como só um slide aparece por vez, o
          // espaço não teria serventia visual nenhuma.
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          // A barra de rolagem estragaria a peça; o arraste continua funcionando.
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/*
          Os slides inativos NÃO levam `aria-hidden`. Seria o padrão de carrossel se eles fossem
          inalcançáveis, mas cada peça é um <button>: esconder do leitor de tela algo que o Tab
          ainda alcança é pior do que a verbosidade de anunciar as três artes. Como a rolagem é
          nativa, elas estão de fato todas disponíveis.
        */}
        {banners.map((b) => (
          <div key={b.id} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', minWidth: 0 }}>
            <MarketBanner banner={b} onClick={onClick} />
          </div>
        ))}
      </div>

      {/*
        Os dots moram DENTRO da arte, no canto inferior direito. Embaixo, custavam ~20px de
        altura que a vitrine pagava em toda visita sem devolver nada — e num banner 3:1 essa
        faixa morta é quase um quinto da peça.
        O canto direito, e não o centro: a arte de banner tende a carregar logo e texto à
        esquerda, então é ali que sobra espaço limpo.
        A cápsula translúcida com desfoque é o que garante contraste sobre QUALQUER arte —
        pontinhos soltos somem numa foto clara e brigam com uma escura.
      */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          borderRadius: 999,
          background: 'rgba(24,14,5,0.42)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 2px 10px rgba(20,12,4,0.22)',
        }}
      >
        {banners.map((b, i) => {
          const atual = i === ativo
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                assumirControle()
                irPara(i)
              }}
              aria-label={`Ver destaque ${i + 1} de ${banners.length}`}
              aria-current={atual}
              // O padding é alvo de toque invisível: o ponto fica discreto, o dedo não.
              style={{
                display: 'grid',
                placeItems: 'center',
                padding: '7px 2px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: atual ? 16 : 5,
                  height: 5,
                  borderRadius: 999,
                  background: atual ? 'var(--color-gold)' : 'rgba(255,255,255,0.5)',
                  transition: 'width 0.32s cubic-bezier(0.22, 1, 0.36, 1), background 0.32s ease',
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
