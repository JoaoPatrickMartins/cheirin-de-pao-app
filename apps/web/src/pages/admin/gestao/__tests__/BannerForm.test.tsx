// BannerForm — o formulário muda com o formato, e não deixa enviar o que o servidor recusaria.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))
// O seletor de arte usa canvas e FileReader — fora do escopo deste teste.
vi.mock('../../../../components/admin/BannerImagePicker', () => ({
  BannerImagePicker: ({ onChange }: { onChange: (u: string | null) => void }) => (
    <button onClick={() => onChange('https://cdn.exemplo.com/banners/x.jpg')}>ENVIAR ARTE</button>
  ),
}))

import { BannerForm } from '../BannerForm'

const setup = () => render(<BannerForm onBack={vi.fn()} onSaved={vi.fn()} />)

const salvar = () => screen.getByRole('button', { name: 'Criar banner' })

describe('BannerForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
  })

  it('começa no pop-up, pedindo arte', () => {
    setup()
    expect(screen.getByText(/Arte \(4:5/)).toBeInTheDocument()
    expect(screen.queryByText('Título')).not.toBeInTheDocument()
  })

  // A faixa existe para o recado urgente: pedir arte nela mataria o propósito do formato.
  it('faixa de aviso troca arte por título e cor', () => {
    setup()
    fireEvent.click(screen.getByText('Faixa de aviso'))

    expect(screen.queryByText(/Arte \(/)).not.toBeInTheDocument()
    expect(screen.getByText('Título')).toBeInTheDocument()
    expect(screen.getByText('Cor de fundo (opcional)')).toBeInTheDocument()
  })

  it('mercadinho pede arte 3:1', () => {
    setup()
    fireEvent.click(screen.getByText('Banner do mercadinho'))
    expect(screen.getByText(/Arte \(3:1/)).toBeInTheDocument()
  })

  it('só o pop-up pergunta frequência', () => {
    setup()
    expect(screen.getByText('Frequência')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Faixa de aviso'))
    expect(screen.queryByText('Frequência')).not.toBeInTheDocument()
  })

  // Sem texto alternativo, quem usa leitor de tela recebe um banner mudo.
  it('não deixa salvar peça com arte e sem descrição da imagem', () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText('Ex.: Promo de setembro'), { target: { value: 'Promo' } })
    fireEvent.click(screen.getByText('ENVIAR ARTE'))

    expect(salvar()).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText(/Combo de pães/), { target: { value: 'Arte da promoção' } })
    expect(salvar()).toBeEnabled()
  })

  it('não deixa salvar link externo fora de https', () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText('Ex.: Promo de setembro'), { target: { value: 'Promo' } })
    fireEvent.click(screen.getByText('ENVIAR ARTE'))
    fireEvent.change(screen.getByPlaceholderText(/Combo de pães/), { target: { value: 'Arte' } })
    // Só existe um select nesta altura: o de "Ao tocar no banner".
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'EXTERNAL' } })

    fireEvent.change(screen.getByPlaceholderText('https://'), { target: { value: 'http://inseguro.com' } })
    expect(salvar()).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('https://'), { target: { value: 'https://seguro.com' } })
    expect(salvar()).toBeEnabled()
  })

  it('segmentar sem escolher condomínio trava o salvar', () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText('Ex.: Promo de setembro'), { target: { value: 'Promo' } })
    fireEvent.click(screen.getByText('ENVIAR ARTE'))
    fireEvent.change(screen.getByPlaceholderText(/Combo de pães/), { target: { value: 'Arte' } })
    expect(salvar()).toBeEnabled()

    fireEvent.click(screen.getByText('Escolher condomínios'))
    expect(salvar()).toBeDisabled()
  })

  it('trocar para faixa limpa a arte no que é enviado', async () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText('Ex.: Promo de setembro'), { target: { value: 'Aviso' } })
    fireEvent.click(screen.getByText('ENVIAR ARTE'))
    fireEvent.click(screen.getByText('Faixa de aviso'))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Feriado dia 7'), { target: { value: 'Feriado' } })

    api.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    fireEvent.click(salvar())

    const chamada = api.fetch.mock.calls.find(([path]) => path === '/admin/banners')
    expect(chamada).toBeTruthy()
    const body = JSON.parse(chamada![1].body as string)
    expect(body).toMatchObject({ placement: 'STRIP', imageUrl: null, alt: null, title: 'Feriado' })
  })
})
