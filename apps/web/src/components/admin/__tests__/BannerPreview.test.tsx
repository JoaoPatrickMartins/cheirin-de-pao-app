// BannerPreview — o "como o cliente vê" do formulário de banner.
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BannerPreview } from '../BannerPreview'
import type { ClientBanner } from '../../../lib/banners'

const peca = (over: Partial<ClientBanner> = {}): ClientBanner => ({
  id: 'preview',
  imageUrl: null,
  alt: null,
  title: null,
  body: null,
  bgColor: null,
  ctaLabel: null,
  actionUrl: null,
  external: false,
  ...over,
})

describe('BannerPreview', () => {
  it('sem arte, explica o que falta', () => {
    render(<BannerPreview placement="POPUP" banner={peca()} />)
    expect(screen.getByText('Envie a arte para ver a peça.')).toBeInTheDocument()
  })

  it('sem título, explica o que falta na faixa', () => {
    render(<BannerPreview placement="STRIP" banner={peca()} />)
    expect(screen.getByText('Escreva o título para ver a faixa.')).toBeInTheDocument()
  })

  it('com arte, mostra o pop-up', () => {
    render(
      <BannerPreview
        placement="POPUP"
        banner={peca({ imageUrl: 'https://cdn.exemplo.com/x.jpg', alt: 'Arte', ctaLabel: 'Peça agora', actionUrl: '#' })}
      />,
    )
    expect(screen.getByRole('img', { name: 'Arte' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Peça agora' })).toBeInTheDocument()
  })

  it('com título, mostra a faixa', () => {
    render(<BannerPreview placement="STRIP" banner={peca({ title: 'Feriado dia 7' })} />)
    expect(screen.getByText('Feriado dia 7')).toBeInTheDocument()
  })

  it('mostra o banner do mercadinho', () => {
    render(
      <BannerPreview placement="MARKET" banner={peca({ imageUrl: 'https://cdn.exemplo.com/y.jpg', alt: 'Arte larga' })} />,
    )
    expect(screen.getByRole('img', { name: 'Arte larga' })).toBeInTheDocument()
  })

  // No app, imagem quebrada some para não deixar um retângulo cinza na Home. No PREVIEW, sumir é
  // a pior resposta possível: o admin fica com uma caixa vazia e nenhuma pista do que houve.
  it('avisa quando a arte não carrega, em vez de ficar em branco', () => {
    render(
      <BannerPreview placement="POPUP" banner={peca({ imageUrl: 'https://cdn.exemplo.com/quebrada.jpg', alt: 'Arte' })} />,
    )

    fireEvent.error(screen.getByRole('img', { name: 'Arte' }))

    expect(screen.getByText(/não carregou/i)).toBeInTheDocument()
  })
})
