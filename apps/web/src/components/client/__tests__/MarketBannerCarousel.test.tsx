// MarketBannerCarousel — slide ativo, auto-rotação e a contagem de impressão por peça.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MarketBannerCarousel } from '../MarketBannerCarousel'
import type { ClientBanner } from '../../../lib/banners'

const peca = (id: string): ClientBanner => ({
  id,
  imageUrl: `https://cdn.exemplo.com/${id}.jpg`,
  alt: `Arte ${id}`,
  title: null,
  body: null,
  bgColor: null,
  ctaLabel: null,
  actionUrl: null,
  external: false,
})

const TRES = [peca('a'), peca('b'), peca('c')]

/**
 * jsdom não faz layout nem rolagem: `clientWidth` é 0 e `scrollTo` não existe. Estes dois stubs
 * dão ao carrossel o mínimo para se comportar — largura fixa e uma rolagem que só anota o valor.
 */
function prepararTrilho(largura = 300) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: largura })
  HTMLElement.prototype.scrollTo = function (this: HTMLElement, arg?: ScrollToOptions | number) {
    this.scrollLeft = typeof arg === 'object' ? (arg.left ?? 0) : (arg ?? 0)
    fireEvent.scroll(this)
  } as HTMLElement['scrollTo']
}

// O IntersectionObserver decide se a peça está à vista; aqui ele responde "sim" na hora.
class IOFake {
  constructor(private cb: (e: { isIntersecting: boolean }[]) => void) {}
  observe() {
    this.cb([{ isIntersecting: true }])
  }
  disconnect() {}
}

describe('MarketBannerCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    prepararTrilho()
    vi.stubGlobal('IntersectionObserver', IOFake)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('mostra todas as peças e um ponto para cada', () => {
    render(<MarketBannerCarousel banners={TRES} onClick={vi.fn()} onSeen={vi.fn()} />)

    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Ver destaque 1 de 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver destaque 3 de 3' })).toBeInTheDocument()
  })

  // A regressão que este teste impede: contar as cinco peças de saída, como a versão empilhada
  // fazia. Slides que ninguém viu inflariam o denominador do CTR.
  it('conta impressão só da peça ativa', () => {
    const onSeen = vi.fn()
    render(<MarketBannerCarousel banners={TRES} onClick={vi.fn()} onSeen={onSeen} />)

    expect(onSeen).toHaveBeenCalledTimes(1)
    expect(onSeen).toHaveBeenCalledWith('a')
  })

  it('conta a próxima peça quando ela vira ativa', () => {
    const onSeen = vi.fn()
    render(<MarketBannerCarousel banners={TRES} onClick={vi.fn()} onSeen={onSeen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ver destaque 2 de 3' }))

    expect(onSeen).toHaveBeenCalledWith('b')
    expect(onSeen).toHaveBeenCalledTimes(2)
  })

  it('não conta a mesma peça duas vezes ao voltar para ela', () => {
    const onSeen = vi.fn()
    render(<MarketBannerCarousel banners={TRES} onClick={vi.fn()} onSeen={onSeen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ver destaque 2 de 3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver destaque 1 de 3' }))

    expect(onSeen.mock.calls.map(([id]) => id)).toEqual(['a', 'b'])
  })

  it('gira sozinho a cada 5s e dá a volta no fim', () => {
    render(<MarketBannerCarousel banners={TRES} onClick={vi.fn()} onSeen={vi.fn()} />)
    const ponto = (i: number) => screen.getByRole('button', { name: `Ver destaque ${i} de 3` })

    expect(ponto(1)).toHaveAttribute('aria-current', 'true')

    act(() => void vi.advanceTimersByTime(5000))
    expect(ponto(2)).toHaveAttribute('aria-current', 'true')

    act(() => void vi.advanceTimersByTime(5000))
    expect(ponto(3)).toHaveAttribute('aria-current', 'true')

    act(() => void vi.advanceTimersByTime(5000))
    expect(ponto(1)).toHaveAttribute('aria-current', 'true')
  })

  // Quem assumiu o controle não quer a peça trocando sozinha embaixo do dedo.
  it('pára de girar depois do primeiro toque', () => {
    render(<MarketBannerCarousel banners={TRES} onClick={vi.fn()} onSeen={vi.fn()} />)
    const trilho = screen.getAllByRole('img')[0].closest('div[style*="overflow"]')!

    fireEvent.touchStart(trilho)
    act(() => void vi.advanceTimersByTime(20000))

    expect(screen.getByRole('button', { name: 'Ver destaque 1 de 3' })).toHaveAttribute('aria-current', 'true')
  })

  it('arrastar até o próximo slide troca o ponto ativo', () => {
    render(<MarketBannerCarousel banners={TRES} onClick={vi.fn()} onSeen={vi.fn()} />)
    const trilho = screen.getAllByRole('img')[0].closest('div[style*="overflow"]') as HTMLElement

    trilho.scrollLeft = 600 // dois slides de 300px
    fireEvent.scroll(trilho)

    expect(screen.getByRole('button', { name: 'Ver destaque 3 de 3' })).toHaveAttribute('aria-current', 'true')
  })

  it('clicar na peça dispara a ação', () => {
    const onClick = vi.fn()
    render(<MarketBannerCarousel banners={TRES} onClick={onClick} onSeen={vi.fn()} />)

    fireEvent.click(screen.getByRole('img', { name: 'Arte a' }).closest('button')!)
    expect(onClick).not.toHaveBeenCalled() // peça sem actionUrl não navega

    const comAcao = [{ ...peca('z'), actionUrl: '/client/market' }, peca('y')]
    render(<MarketBannerCarousel banners={comAcao} onClick={onClick} onSeen={vi.fn()} />)
    fireEvent.click(screen.getByRole('img', { name: 'Arte z' }).closest('button')!)
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'z' }))
  })
})
