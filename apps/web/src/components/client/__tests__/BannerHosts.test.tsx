// Os "hosts" dos banners: quando a peça aparece, o que é contado e o que NÃO é.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const tracker = vi.hoisted(() => ({ track: vi.fn(), fetch: vi.fn() }))
vi.mock('../../../lib/banners', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../lib/banners')>()
  return { ...real, trackBanner: tracker.track, fetchBanners: tracker.fetch }
})

import { BannerProvider } from '../../../contexts/BannerContext'
import { BannerPopupHost } from '../BannerPopupHost'
import { AvisoStripHost } from '../AvisoStripHost'
import { NO_BANNERS, type ClientBanner } from '../../../lib/banners'

const peca = (over: Partial<ClientBanner> = {}): ClientBanner => ({
  id: 'b1',
  imageUrl: 'https://cdn.exemplo.com/banners/x.jpg',
  alt: 'Arte',
  title: 'Feriado dia 7',
  body: 'Sem entrega nesse dia.',
  bgColor: null,
  ctaLabel: 'Peça agora',
  actionUrl: null,
  external: false,
  ...over,
})

function renderWith(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <BannerProvider>{ui}</BannerProvider>
    </MemoryRouter>,
  )
}

describe('BannerPopupHost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tracker.fetch.mockResolvedValue({ ...NO_BANNERS, popup: peca() })
  })

  // A regressão que este teste impede: contar a impressão quando a peça CHEGA, e não quando
  // aparece. O pop-up que ficou atrás do tour gastaria a frequência do dia sem ninguém ver.
  it('segura a peça e a impressão enquanto está desabilitado, e solta as duas ao habilitar', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <BannerProvider>
          <BannerPopupHost enabled={false} />
        </BannerProvider>
      </MemoryRouter>,
    )

    // Espera a peça REALMENTE chegar ao contexto antes de afirmar que nada foi contado —
    // senão o teste passaria só porque a busca ainda não tinha resolvido.
    await waitFor(() => expect(tracker.fetch).toHaveBeenCalled())
    await act(async () => {})

    expect(screen.queryByRole('img', { name: 'Arte' })).not.toBeInTheDocument()
    expect(tracker.track).not.toHaveBeenCalled()

    rerender(
      <MemoryRouter>
        <BannerProvider>
          <BannerPopupHost enabled />
        </BannerProvider>
      </MemoryRouter>,
    )

    await screen.findByRole('img', { name: 'Arte' })
    expect(tracker.track).toHaveBeenCalledWith('b1', 'seen')
  })

  it('conta a impressão quando aparece', async () => {
    renderWith(<BannerPopupHost enabled />)
    await screen.findByRole('img', { name: 'Arte' })

    expect(tracker.track).toHaveBeenCalledWith('b1', 'seen')
  })

  it('fechar no X conta dispensa e some', async () => {
    renderWith(<BannerPopupHost enabled />)
    await screen.findByRole('img', { name: 'Arte' })

    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))

    expect(tracker.track).toHaveBeenCalledWith('b1', 'dismiss')
    expect(screen.queryByRole('img', { name: 'Arte' })).not.toBeInTheDocument()
  })

  // Somar clique e dispensa faria a taxa de dispensa acusar rejeição onde houve interesse.
  it('clicar conta clique e NÃO conta dispensa', async () => {
    tracker.fetch.mockResolvedValue({ ...NO_BANNERS, popup: peca({ actionUrl: '/client/market' }) })
    renderWith(<BannerPopupHost enabled />)
    await screen.findByRole('img', { name: 'Arte' })

    fireEvent.click(screen.getByRole('button', { name: 'Peça agora' }))

    expect(tracker.track).toHaveBeenCalledWith('b1', 'click')
    expect(tracker.track).not.toHaveBeenCalledWith('b1', 'dismiss')
  })
})

describe('AvisoStripHost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tracker.fetch.mockResolvedValue({ ...NO_BANNERS, strip: peca({ id: 's1', imageUrl: null }) })
  })

  it('mostra título e texto', async () => {
    renderWith(<AvisoStripHost />)
    expect(await screen.findByText('Feriado dia 7')).toBeInTheDocument()
    expect(screen.getByText('Sem entrega nesse dia.')).toBeInTheDocument()
  })

  it('some ao dispensar', async () => {
    renderWith(<AvisoStripHost />)
    await screen.findByText('Feriado dia 7')

    fireEvent.click(screen.getByRole('button', { name: 'Dispensar aviso' }))

    expect(tracker.track).toHaveBeenCalledWith('s1', 'dismiss')
    expect(screen.queryByText('Feriado dia 7')).not.toBeInTheDocument()
  })

  it('nada aparece quando não há faixa', async () => {
    tracker.fetch.mockResolvedValue(NO_BANNERS)
    const { container } = renderWith(<AvisoStripHost />)
    expect(container.querySelector('[role="status"]')).toBeNull()
  })
})
