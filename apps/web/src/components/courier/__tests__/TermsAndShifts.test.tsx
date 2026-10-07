// Termo do Entregador Parceiro e aceitar/recusar o turno (plano-termos-legais §5/§6).
import { vi, describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TermsGate } from '../TermsGate'
import { ShiftOfferCard, DeclineShiftSheet } from '../ShiftOffer'
import { CourierTermsPage } from '../../../pages/legal/LegalPage'
import { COURIER_TERMS_SECTIONS } from '../../../content/courierTerms'
import type { ShiftOffer } from '../../../lib/courierApi'

const shift = (over: Partial<ShiftOffer> = {}): ShiftOffer => ({ id: 'o1', slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', status: 'OFFERED', stops: 18, offeredAt: '2026-10-02T08:00:00.000Z', ...over })

describe('Termo do Entregador Parceiro', () => {
  it('o texto diz que não há vínculo, sem exclusividade, e que recusar turno não tem penalidade', () => {
    const all = COURIER_TERMS_SECTIONS.flatMap((s) => [s.title, ...s.paragraphs]).join(' ')
    expect(all).toContain('não cria vínculo empregatício')
    expect(all).toContain('Não há exclusividade')
    expect(all).toContain('Recusar não gera penalidade')
    expect(all).toContain('Se você não responder, o turno fica com você')
    expect(all).toContain('Impostos e contribuições')
  })

  it('bloqueio: "Aceitar e continuar" só com "Li e aceito"; aceita e devolve o erro do servidor', async () => {
    const onAccept = vi.fn().mockResolvedValueOnce('Sem sinal agora. Para aceitar, abra o app com sinal.').mockResolvedValueOnce(null)
    const onLogout = vi.fn()
    render(<TermsGate updated={false} onAccept={onAccept} onLogout={onLogout} />)
    expect(screen.getByRole('dialog', { name: 'Termo do Entregador Parceiro' })).toBeDefined()
    expect(screen.getByText('ANTES DE COMEÇAR')).toBeDefined()
    const accept = screen.getByRole('button', { name: /Aceitar e continuar/ }) as HTMLButtonElement
    expect(accept.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Li e aceito o Termo do Entregador Parceiro' }))
    expect(accept.disabled).toBe(false)
    fireEvent.click(accept)
    expect(await screen.findByText('Sem sinal agora. Para aceitar, abra o app com sinal.')).toBeDefined()
    fireEvent.click(accept)
    await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Sair do app' }))
    expect(onLogout).toHaveBeenCalled()
  })

  it('versão nova: avisa que o termo mudou', () => {
    render(<TermsGate updated onAccept={vi.fn()} onLogout={vi.fn()} />)
    expect(screen.getByText('O TERMO MUDOU')).toBeDefined()
    expect(screen.getByText(/leia a versão nova para continuar/)).toBeDefined()
  })

  it('página pública /termos-entregador com a versão e as seções', () => {
    render(
      <MemoryRouter>
        <CourierTermsPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Termo do Entregador Parceiro' })).toBeDefined()
    expect(screen.getByText('Versão 1.0 · 05/10/2026')).toBeDefined()
    expect(screen.getByRole('heading', { name: '2. Não há vínculo de emprego' })).toBeDefined()
  })
})

describe('turno oferecido', () => {
  it('oferecido: Aceitar e Recusar; aceito: só "Recusar"', () => {
    const onAccept = vi.fn()
    const onDecline = vi.fn()
    const { unmount } = render(<ShiftOfferCard shift={shift()} onAccept={onAccept} onDecline={onDecline} />)
    expect(screen.getByText('TURNO OFERECIDO')).toBeDefined()
    expect(screen.getByText('18 paradas · entrega 06:30')).toBeDefined()
    expect(screen.getByText(/sem penalidade. Sem resposta, o turno fica com você/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Aceitar/ }))
    fireEvent.click(screen.getByRole('button', { name: /Recusar/ }))
    expect([onAccept.mock.calls.length, onDecline.mock.calls.length]).toEqual([1, 1])
    unmount()
    render(<ShiftOfferCard shift={shift({ status: 'ACCEPTED' })} onAccept={vi.fn()} onDecline={onDecline} />)
    expect(screen.getByText('☀️ Turno da manhã aceito · 18 paradas')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Aceitar/ })).toBeNull()
  })

  it('recusar: motivo opcional (tocar de novo desmarca), sem penalidade, sem sinal aponta a operação', async () => {
    const onConfirm = vi.fn().mockResolvedValueOnce('offline').mockResolvedValueOnce('A rota já começou. Para sair dela, fale com a operação.').mockResolvedValueOnce(null)
    render(<DeclineShiftSheet shift={shift()} onConfirm={onConfirm} onClose={vi.fn()} />)
    expect(screen.getByText('Recusar não tem penalidade. As entregas voltam para a operação redistribuir.')).toBeDefined()
    const saude = screen.getByRole('radio', { name: 'Saúde' })
    fireEvent.click(saude)
    fireEvent.click(saude)
    expect(saude.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('radio', { name: 'Problema no veículo' }))
    fireEvent.click(screen.getByRole('button', { name: /Recusar turno/ }))
    await waitFor(() => expect(onConfirm).toHaveBeenLastCalledWith('VEICULO'))
    expect(screen.getByRole('link', { name: 'fale com a operação' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\//)
    fireEvent.click(screen.getByRole('button', { name: /Recusar turno/ }))
    expect(await screen.findByText('A rota já começou. Para sair dela, fale com a operação.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Manter o turno' })).toBeDefined()
  })
})
