// C4 — código de indicação no cadastro: estados do campo, selo do link e o que vai no register.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { REFERRAL_STORAGE_KEY } from '../../../lib/referral'

const api = vi.hoisted(() => ({
  active: true,
  codes: {} as Record<string, { valid: boolean; referrerName?: string; welcomeBreads?: number } | 'pending'>,
  fetch: vi.fn(),
}))
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))

import {
  ReferralBadge,
  ReferralCodeField,
  ReferralCodeToggle,
  useSignupReferral,
  type SignupReferral,
} from '../ReferralCodeField'

let latest: SignupReferral
/** Harness que espelha o passo 1 do OnboardingScreen (selo → título → campo → Continuar). */
function Step() {
  const referral = useSignupReferral()
  latest = referral
  return (
    <div>
      {referral.linked && !referral.fieldOpen && (
        <ReferralBadge referrerName={referral.linked.referrerName} welcomeBreads={referral.linked.welcomeBreads} onChange={referral.openField} />
      )}
      <h1>Seus dados</h1>
      {referral.active && (referral.fieldOpen || !referral.linked) &&
        (referral.fieldOpen ? <ReferralCodeField referral={referral} /> : <ReferralCodeToggle onOpen={referral.openField} />)}
      <button disabled={referral.status === 'validating'}>Continuar</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  api.active = true
  api.codes = {}
  api.fetch.mockImplementation((path: string) => {
    if (path === '/referrals/config') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ active: api.active, welcomeBreads: 3 }) })
    }
    const code = decodeURIComponent(path.split('/').pop()!)
    const r = api.codes[code] ?? { valid: false }
    if (r === 'pending') return new Promise(() => {})
    return Promise.resolve({ ok: true, json: () => Promise.resolve(r) })
  })
})

describe('ReferralCodeField (C4)', () => {
  it('programa desligado → nada aparece', async () => {
    api.active = false
    render(<Step />)
    await waitFor(() => expect(api.fetch).toHaveBeenCalledWith('/referrals/config'))
    expect(screen.queryByText('Tenho um código de indicação')).toBeNull()
    expect(latest.payload()).toEqual({})
  })

  it('sem link: "Tenho um código" abre o campo; maiúsculas automáticas', async () => {
    render(<Step />)
    fireEvent.click(await screen.findByText('Tenho um código de indicação'))
    const input = screen.getByLabelText(/Código de indicação/)
    fireEvent.change(input, { target: { value: 'joao 7k2f' } })
    expect(input).toHaveValue('JOAO7K2F')
    expect(screen.getByText('Letras e números, como está na mensagem do seu amigo.')).toBeInTheDocument()
  })

  it('validando: spinner + "Conferindo o código…" e o Continuar trava só aí', async () => {
    api.codes.JOAO7K2F = 'pending'
    render(<Step />)
    fireEvent.click(await screen.findByText('Tenho um código de indicação'))
    const input = screen.getByLabelText(/Código de indicação/)
    fireEvent.change(input, { target: { value: 'JOAO7K2F' } })
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    fireEvent.blur(input)
    expect(await screen.findByText('Conferindo o código…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })

  it('válido: selo "Indicado por" com o bônus; vai no register como CODE', async () => {
    api.codes.JOAO7K2F = { valid: true, referrerName: 'João M.', welcomeBreads: 3 }
    render(<Step />)
    fireEvent.click(await screen.findByText('Tenho um código de indicação'))
    const input = screen.getByLabelText(/Código de indicação/)
    fireEvent.change(input, { target: { value: 'JOAO7K2F' } })
    fireEvent.blur(input)
    expect(await screen.findByText('Indicado por João M.')).toBeInTheDocument()
    expect(screen.getByText('Você ganha 3 pãezins quando o 1º pedido chegar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    expect(latest.payload()).toEqual({ referralCode: 'JOAO7K2F', referralSource: 'CODE' })
  })

  it('sem bônus: o selo mostra só "Indicado por…"', async () => {
    api.codes.JOAO7K2F = { valid: true, referrerName: 'João M.', welcomeBreads: 0 }
    render(<Step />)
    fireEvent.click(await screen.findByText('Tenho um código de indicação'))
    const input = screen.getByLabelText(/Código de indicação/)
    fireEvent.change(input, { target: { value: 'JOAO7K2F' } })
    fireEvent.blur(input)
    expect(await screen.findByText('Indicado por João M.')).toBeInTheDocument()
    expect(screen.queryByText(/Você ganha/)).toBeNull()
  })

  it('inválido: aviso suave, Continuar livre, e o código não vai no register', async () => {
    render(<Step />)
    fireEvent.click(await screen.findByText('Tenho um código de indicação'))
    const input = screen.getByLabelText(/Código de indicação/)
    fireEvent.change(input, { target: { value: 'JOAO7K2X' } })
    fireEvent.blur(input)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não achamos esse código')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
    expect(latest.payload()).toEqual({})
  })

  it('veio pelo link: selo acima do título com "Trocar"; vai como LINK', async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code: 'JOAO7K2F', source: 'LINK', at: Date.now() }))
    api.codes.JOAO7K2F = { valid: true, referrerName: 'João M.', welcomeBreads: 3 }
    render(<Step />)
    const badge = await screen.findByText('Indicado por João M.')
    expect(badge.compareDocumentPosition(screen.getByRole('heading', { name: 'Seus dados' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Tenho um código de indicação')).toBeNull()
    expect(latest.payload()).toEqual({ referralCode: 'JOAO7K2F', referralSource: 'LINK' })

    // "Trocar" abre o campo já com o código conferido
    fireEvent.click(screen.getByRole('button', { name: 'Trocar' }))
    expect(screen.getByLabelText(/Código de indicação/)).toHaveValue('JOAO7K2F')
    expect(latest.payload()).toEqual({ referralCode: 'JOAO7K2F', referralSource: 'LINK' })
  })

  it('link com código que não confere (ex.: dono bloqueado) → sem selo, campo digitável', async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code: 'BLOQ9999', source: 'LINK', at: Date.now() }))
    render(<Step />)
    expect(await screen.findByText('Tenho um código de indicação')).toBeInTheDocument()
    expect(screen.queryByText(/Indicado por/)).toBeNull()
    expect(latest.payload()).toEqual({})
  })
})
