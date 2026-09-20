// BannerPopup — os gestos do pop-up de abertura e o que acontece quando a arte falha.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BannerPopup } from '../BannerPopup'
import type { ClientBanner } from '../../../lib/banners'

const banner = (over: Partial<ClientBanner> = {}): ClientBanner => ({
  id: 'b1',
  imageUrl: 'https://cdn.exemplo.com/banners/x.jpg',
  alt: 'Promoção de pães',
  title: null,
  body: null,
  bgColor: null,
  ctaLabel: 'Peça agora',
  actionUrl: '/client/market',
  external: false,
  ...over,
})

describe('BannerPopup', () => {
  it('mostra a arte e o botão', () => {
    render(<BannerPopup banner={banner()} onClick={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('img', { name: 'Promoção de pães' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Peça agora' })).toBeInTheDocument()
  })

  it('fecha no X', () => {
    const onClose = vi.fn()
    render(<BannerPopup banner={banner()} onClick={vi.fn()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(onClose).toHaveBeenCalled()
  })

  // O X não pode ser a única saída: numa arte que ocupa a tela inteira, o dedo tende ao fundo.
  it('fecha no Esc e no toque fora do card', () => {
    const onClose = vi.fn()
    const { container } = render(<BannerPopup banner={banner()} onClick={vi.fn()} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(container.querySelector('[role="dialog"]')!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('clicar na arte dispara a ação', () => {
    const onClick = vi.fn()
    render(<BannerPopup banner={banner()} onClick={onClick} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Promoção de pães' }))
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }))
  })

  it('peça sem ação não vira botão clicável nem mostra CTA', () => {
    const onClick = vi.fn()
    render(<BannerPopup banner={banner({ actionUrl: null })} onClick={onClick} onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Peça agora' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Promoção de pães' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  // A regressão que este teste impede: o modal montar antes da arte. Com URL quebrada isso vira
  // o "aparece e some na hora"; com rede lenta, meio segundo de card branco e vazio.
  it('fica invisível e inerte até a arte carregar', () => {
    const { container } = render(<BannerPopup banner={banner()} onClick={vi.fn()} onClose={vi.fn()} />)
    const overlay = container.querySelector('[role="dialog"]') as HTMLElement

    expect(overlay.style.pointerEvents).toBe('none')

    fireEvent.load(screen.getByRole('img', { name: 'Promoção de pães' }))
    expect(overlay.style.pointerEvents).toBe('auto')
  })

  // Melhor nada do que um retângulo cinza sobre a Home.
  it('some inteiro quando a imagem falha', () => {
    const { container } = render(<BannerPopup banner={banner()} onClick={vi.fn()} onClose={vi.fn()} />)

    fireEvent.error(screen.getByRole('img', { name: 'Promoção de pães' }))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('não renderiza peça sem arte', () => {
    const { container } = render(
      <BannerPopup banner={banner({ imageUrl: null })} onClick={vi.fn()} onClose={vi.fn()} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
