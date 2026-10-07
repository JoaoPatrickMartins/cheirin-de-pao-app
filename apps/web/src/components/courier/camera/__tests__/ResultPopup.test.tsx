// E4 — sucesso segue sozinho em ~3 s (ou no toque); erro nunca fecha sozinho.
import { vi, describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ResultPopup } from '../ResultPopup'
import type { StopSummary } from '../../../../lib/courierApi'

const summary: StopSummary = {
  kind: 'BREAD',
  orderId: 'o1',
  marketOrderIds: ['m1'],
  clientName: 'Maria Souza',
  condominiumId: 'c1',
  condominiumName: 'Residencial Jardins',
  block: '2',
  complement: 'Lado A',
  apartment: '101',
  quantity: 4,
  marketItems: [{ name: 'Café 250 g', qty: 1 }],
  isFirstOrder: true,
  hasHook: true,
  hookToDeliver: null,
  status: 'DELIVERED',
  deliveredAt: '2026-10-01T09:42:00.000Z', // 06:42 BRT
  failedAt: null,
  proofRequired: true,
}

afterEach(() => vi.useRealTimers())

describe('ResultPopup', () => {
  it('sucesso mostra apto/bloco em destaque, cliente, condomínio e selos; segue sozinho em 3 s', () => {
    vi.useFakeTimers()
    const onNext = vi.fn()
    render(<ResultPopup kind="ok" summary={summary} onNext={onNext} onClose={vi.fn()} />)
    expect(screen.getByRole('alertdialog', { name: 'Entrega confirmada' })).toBeDefined()
    expect(screen.getByText('Apto 101')).toBeDefined()
    expect(screen.getByText('Bloco 2 · Lado A')).toBeDefined()
    expect(screen.getByText('Maria Souza')).toBeDefined()
    expect(screen.getByText('Residencial Jardins')).toBeDefined()
    expect(screen.getByText('1ª entrega')).toBeDefined()
    expect(screen.getByText('tem gancho')).toBeDefined()
    expect(onNext).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(3000))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('parada só de gancho: "Gancho entregue", selo do gancho e segue sozinho (sem a pergunta do gancho)', () => {
    vi.useFakeTimers()
    const onNext = vi.fn()
    const hook: StopSummary = { ...summary, kind: 'HOOK', orderId: null, hookId: 'h1', marketOrderIds: [], marketItems: [], quantity: 0, hasHook: false }
    render(<ResultPopup kind="ok" summary={hook} onNext={onNext} onClose={vi.fn()} onHook={vi.fn()} />)
    expect(screen.getByRole('alertdialog', { name: 'Gancho entregue' })).toBeDefined()
    expect(screen.getByText('Gancho de porta')).toBeDefined()
    expect(screen.queryByText(/pães?/)).toBeNull()
    expect(screen.queryByText(/Deixou o gancho também/)).toBeNull()
    act(() => vi.advanceTimersByTime(3000))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('tocar no cartão adianta', () => {
    const onNext = vi.fn()
    render(<ResultPopup kind="ok" summary={summary} onNext={onNext} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('alertdialog'))
    expect(onNext).toHaveBeenCalled()
  })

  // Onda 4: sem sinal a entrega fica guardada no aparelho — segue para a foto como o sucesso.
  it('sem sinal: "Confirmada · sem sinal", avisa que foi guardada e segue sozinho em 3 s', () => {
    vi.useFakeTimers()
    const onNext = vi.fn()
    render(<ResultPopup kind="offline" summary={summary} nextHint="Foto da entrega" onNext={onNext} onClose={vi.fn()} />)
    expect(screen.getByRole('alertdialog', { name: 'Confirmada · sem sinal' })).toBeDefined()
    expect(screen.getByText('Sem sinal agora. Guardamos a entrega e enviamos sozinhos.')).toBeDefined()
    expect(screen.getByText('Apto 101')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Entendi' })).toBeNull()
    act(() => vi.advanceTimersByTime(3000))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('já confirmada: mostra o horário (BRT) e NÃO fecha sozinha', () => {
    vi.useFakeTimers()
    const onNext = vi.fn()
    const onClose = vi.fn()
    render(<ResultPopup kind="already" summary={summary} message="Essa entrega já foi confirmada" onNext={onNext} onClose={onClose} />)
    expect(screen.getByText('Essa entrega já foi confirmada às 06:42.')).toBeDefined()
    act(() => vi.advanceTimersByTime(10_000))
    expect(onNext).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('não é da sua rota: não mostra dados de cliente', () => {
    render(<ResultPopup kind="other" onNext={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/Esse cupom é de outra rota/)).toBeDefined()
    expect(screen.queryByText(/Apto/)).toBeNull()
  })

  it('não encontrado oferece "Digitar código"', () => {
    const onTypeCode = vi.fn()
    render(<ResultPopup kind="notfound" onNext={vi.fn()} onClose={vi.fn()} onTypeCode={onTypeCode} />)
    fireEvent.click(screen.getByRole('button', { name: 'Digitar código' }))
    expect(onTypeCode).toHaveBeenCalled()
  })
})
