import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileMenuRow } from '../ProfileMenuRow'

describe('ProfileMenuRow', () => {
  it('padrão: quadrado do ícone neutro e selo verde (sem mudança para as linhas antigas)', () => {
    const { container } = render(<ProfileMenuRow icon="repeat" label="Compra automática" badge="Ativada" onClick={() => {}} />)
    const square = container.querySelector('button > div') as HTMLElement
    expect(square.style.background).toBe('var(--color-surface-2)')
    expect(screen.getByText('Ativada').style.color).toBe('var(--color-good)')
  })

  it('tone="gold" + selo dourado com ícone (Indique e Ganhe, C2)', () => {
    const { container } = render(
      <ProfileMenuRow icon="gift" tone="gold" label="Indique e ganhe" badge="Semana em dobro" badgeTone="gold" badgeIcon="spark" onClick={() => {}} />,
    )
    const square = container.querySelector('button > div') as HTMLElement
    expect(square.style.background).toBe('var(--color-gold-soft)')
    const badge = screen.getByText('Semana em dobro')
    expect(badge.style.color).toBe('var(--color-accent)')
    expect(badge.querySelector('svg')).not.toBeNull()
  })
})
