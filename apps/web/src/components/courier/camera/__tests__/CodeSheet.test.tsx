// E3 — campo só com os caracteres do cupom (O vira 0), 4 ou 6 caracteres, estados de erro.
import { vi, describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CodeSheet } from '../CodeSheet'

const type = (v: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value: v } })

describe('CodeSheet', () => {
  it('normaliza o que foi digitado: maiúsculas, O→0, só 0-9/A-F, até 6', () => {
    render(<CodeSheet onSubmit={vi.fn()} onClose={vi.fn()} />)
    type('#b9 c-o d1zz')
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('B9C0D1')
  })

  it('o botão só libera com 4 (cupom antigo) ou 6 caracteres', () => {
    render(<CodeSheet onSubmit={vi.fn()} onClose={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Confirmar entrega' }) as HTMLButtonElement
    type('B9C')
    expect(btn.disabled).toBe(true)
    type('B9C0')
    expect(btn.disabled).toBe(false)
    expect(screen.getByText(/Cupom antigo tem 4 caracteres/)).toBeDefined()
    type('B9C0D')
    expect(btn.disabled).toBe(true)
  })

  it('não encontrado mostra o aviso da tela', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ kind: 'notfound' })
    render(<CodeSheet onSubmit={onSubmit} onClose={vi.fn()} />)
    type('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(screen.getByText(/Não achamos esse código na sua rota/)).toBeDefined())
    expect(onSubmit).toHaveBeenCalledWith('123456', undefined)
  })

  it('já confirmada mostra o horário e a parada', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      kind: 'already',
      summary: { apartment: '204', block: '1', clientName: 'Pedro Alves', status: 'DELIVERED', deliveredAt: '2026-10-01T09:42:00.000Z', failedAt: null },
    })
    render(<CodeSheet onSubmit={onSubmit} onClose={vi.fn()} />)
    type('ABCDEF')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(screen.getByText('Essa entrega já foi confirmada às 06:42.')).toBeDefined())
    expect(screen.getByText(/Apto 204 · Bloco 1 · Pedro Alves/)).toBeDefined()
  })

  it('código ambíguo lista as paradas; escolher reenvia com a parada', async () => {
    const match = { kind: 'BREAD', id: 'o9', summary: { apartment: '12', block: null, clientName: 'Ana', condominiumName: 'Aurora' } }
    const onSubmit = vi.fn().mockResolvedValueOnce({ kind: 'choices', matches: [match, { ...match, id: 'o8', summary: { ...match.summary, apartment: '13' } }] }).mockResolvedValue({ kind: 'ok' })
    render(<CodeSheet onSubmit={onSubmit} onClose={vi.fn()} />)
    type('C0D1')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    const choice = await screen.findByRole('radio', { name: /Apto 12/ })
    fireEvent.click(choice)
    await waitFor(() => expect(onSubmit).toHaveBeenLastCalledWith('C0D1', match))
  })
})
