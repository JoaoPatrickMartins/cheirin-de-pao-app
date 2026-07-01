// Fase A — telas explicativas (carrossel de 3 slides)
import { vi, describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnboardingOverlay } from '../OnboardingOverlay'

// Os 3 slides ficam no DOM ao mesmo tempo (track do carrossel); por isso a
// navegação é verificada pelos rótulos dos botões (Próximo/Começar/Voltar),
// não pela presença do texto dos slides.
describe('OnboardingOverlay (telas explicativas)', () => {
  it('inicia no 1º slide: só "Próximo", sem "Voltar"/"Começar"', () => {
    render(<OnboardingOverlay onFinish={vi.fn()} />)
    expect(screen.getByText('Peça do seu jeito')).toBeDefined()
    expect(screen.getByText('Próximo')).toBeDefined()
    expect(screen.queryByText('Voltar')).toBeNull()
    expect(screen.queryByText('Começar')).toBeNull()
  })

  it('"Próximo" avança até o último (Começar) e "Voltar" retrocede', () => {
    render(<OnboardingOverlay onFinish={vi.fn()} />)
    fireEvent.click(screen.getByText('Próximo')) // → slide 2
    expect(screen.getByText('Voltar')).toBeDefined()
    fireEvent.click(screen.getByText('Próximo')) // → slide 3
    expect(screen.getByText('Começar')).toBeDefined()
    expect(screen.queryByText('Próximo')).toBeNull()
    fireEvent.click(screen.getByText('Voltar')) // ← slide 2
    expect(screen.getByText('Próximo')).toBeDefined()
    expect(screen.queryByText('Começar')).toBeNull()
  })

  it('"Começar" no último slide chama onFinish', () => {
    const onFinish = vi.fn()
    render(<OnboardingOverlay onFinish={onFinish} />)
    fireEvent.click(screen.getByText('Próximo'))
    fireEvent.click(screen.getByText('Próximo'))
    fireEvent.click(screen.getByText('Começar'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('"Pular" chama onFinish', () => {
    const onFinish = vi.fn()
    render(<OnboardingOverlay onFinish={onFinish} />)
    fireEvent.click(screen.getByText('Pular'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
