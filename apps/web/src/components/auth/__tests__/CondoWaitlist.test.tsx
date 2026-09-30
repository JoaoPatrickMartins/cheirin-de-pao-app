// C8 — Lista de espera: entrada pelo vazio da busca, formulário pré-preenchido, enviando, erro
// ("Seus dados continuam aqui") e sucesso ("Voltar ao início"). O código do link vai junto.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))

import { CondoWaitlist } from '../CondoWaitlist'
import { CondoSearch } from '../CondoSearch'

const initial = { condoName: 'Solar das Palmeiras', contactName: 'Luciana Prado', contact: 'luciana@email.com' }
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const sendBtn = () => screen.getByRole('button', { name: /Avisar quando chegar|Tentar de novo/ }) as HTMLButtonElement

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('CondoSearch — vazio vira a entrada da lista de espera', () => {
  it('sem resultado: card do handoff e o botão leva o termo buscado', () => {
    const onNotListed = vi.fn()
    render(<CondoSearch condos={[]} selectedId={null} onSelect={vi.fn()} onNotListed={onNotListed} />)
    fireEvent.change(screen.getByPlaceholderText('Buscar condomínio'), { target: { value: ' Solar das Palmeiras ' } })
    expect(screen.getByText('Seu condomínio ainda não é parceiro')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Meu condomínio não está aqui' }))
    expect(onNotListed).toHaveBeenCalledWith('Solar das Palmeiras')
  })

  it('sem a lista de espera (tela da conta), o vazio de antes continua', () => {
    render(<CondoSearch condos={[]} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Meu condomínio não está aqui' })).toBeNull()
    expect(screen.getByText(/Avise a gente que levamos o cheirin até aí!/)).toBeDefined()
  })
})

describe('CondoWaitlist (C8)', () => {
  it('chega pré-preenchido; só envia com a cidade', () => {
    render(<CondoWaitlist initial={initial} onBack={vi.fn()} onDone={vi.fn()} />)
    expect(field('Nome do condomínio').value).toBe('Solar das Palmeiras')
    expect(field('Seu nome').value).toBe('Luciana Prado')
    expect(field('E-mail ou celular').value).toBe('luciana@email.com')
    expect(screen.getByText('Um dos dois basta.')).toBeDefined()
    expect(sendBtn().disabled).toBe(true)
    fireEvent.change(field('Cidade'), { target: { value: 'Campinas' } })
    expect(sendBtn().disabled).toBe(false)
  })

  it('envia com o código do link e o aparelho; sucesso → "Voltar ao início"', async () => {
    localStorage.setItem('cdp_ref', JSON.stringify({ code: 'JOAO7K2F', source: 'LINK', at: Date.now() }))
    localStorage.setItem('device_id', 'dev-1')
    api.fetch.mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({ ok: true }) })
    const onDone = vi.fn()
    render(<CondoWaitlist initial={initial} onBack={vi.fn()} onDone={onDone} />)
    fireEvent.change(field('CEP (opcional)'), { target: { value: '13085-000' } })
    fireEvent.change(field('Cidade'), { target: { value: 'Campinas' } })
    fireEvent.click(sendBtn())
    await screen.findByText('Anotado!')
    expect(screen.getByText(/Avisamos quando o Cheirin chegar no Solar das Palmeiras\. Se veio por indicação, o código fica guardado\./)).toBeDefined()
    const [url, init] = api.fetch.mock.calls[0]
    expect(url).toBe('/condominiums/interest')
    expect(JSON.parse(init.body)).toEqual({
      condoName: 'Solar das Palmeiras',
      zip: '13085-000',
      city: 'Campinas',
      contactName: 'Luciana Prado',
      contact: 'luciana@email.com',
      refCode: 'JOAO7K2F',
      visitorId: 'dev-1',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao início' }))
    expect(onDone).toHaveBeenCalled()
  })

  it('erro de envio: faixa "Seus dados continuam aqui", dados mantidos e "Tentar de novo"', async () => {
    api.fetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })
    render(<CondoWaitlist initial={initial} onBack={vi.fn()} onDone={vi.fn()} />)
    fireEvent.change(field('Cidade'), { target: { value: 'Campinas' } })
    fireEvent.click(sendBtn())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Seus dados continuam aqui'))
    expect(field('Cidade').value).toBe('Campinas')
    expect(screen.getByRole('button', { name: /Tentar de novo/ })).toBeDefined()
  })

  it('campo a ajustar (400): a faixa mostra a mensagem do campo', async () => {
    api.fetch.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ error: 'Informe um e-mail ou celular válido' }) })
    render(<CondoWaitlist initial={{ ...initial, contact: 'luciana' }} onBack={vi.fn()} onDone={vi.fn()} />)
    fireEvent.change(field('Cidade'), { target: { value: 'Campinas' } })
    fireEvent.click(sendBtn())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Informe um e-mail ou celular válido'))
  })

  it('sem código do link, o sucesso não fala de indicação', async () => {
    api.fetch.mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({ ok: true }) })
    render(<CondoWaitlist initial={initial} onBack={vi.fn()} onDone={vi.fn()} />)
    fireEvent.change(field('Cidade'), { target: { value: 'Campinas' } })
    fireEvent.click(sendBtn())
    await screen.findByText('Anotado!')
    expect(screen.queryByText(/Se veio por indicação/)).toBeNull()
    expect(JSON.parse(api.fetch.mock.calls[0][1].body).refCode).toBeUndefined()
  })
})
