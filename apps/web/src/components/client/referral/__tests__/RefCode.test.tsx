import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { RefCode, RefCodeCard } from '../RefCode'
import { RefStatePill } from '../RefPrimitives'

afterEach(() => vi.useRealTimers())

describe('RefCode', () => {
  it('mostra o código em 2 grupos e soletra no aria-label', () => {
    render(<RefCode code="JOAO7K2F" />)
    const code = screen.getByRole('img', { name: 'Código J O A O 7 K 2 F' })
    expect(code).toBeInTheDocument()
    expect(screen.getByText('JOAO')).toBeInTheDocument()
    expect(screen.getByText('7K2F')).toBeInTheDocument()
  })
})

describe('RefCodeCard', () => {
  it('Copiar → "Copiado!" por 1,8 s, e copia o código', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<RefCodeCard code="JOAO7K2F" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copiar/i }))
    })
    expect(writeText).toHaveBeenCalledWith('JOAO7K2F')
    expect(screen.getByRole('button', { name: /copiado!/i })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1800)
    })
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument()
  })
})

describe('RefStatePill', () => {
  it('ícone + texto em todo estado; "Ganhou +X" na recompensada', () => {
    const { rerender } = render(<RefStatePill state="ganhou" reward={5} />)
    expect(screen.getByText('Ganhou +5')).toBeInTheDocument()
    rerender(<RefStatePill state="recusada" />)
    expect(screen.getByText('Não valeu')).toBeInTheDocument()
    rerender(<RefStatePill state="aguardando" />)
    expect(screen.getByText('Aguardando 1º pedido')).toBeInTheDocument()
  })
})
