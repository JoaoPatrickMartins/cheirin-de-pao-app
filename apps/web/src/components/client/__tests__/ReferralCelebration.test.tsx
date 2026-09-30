import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReferralCelebration } from '../ReferralCelebration'
import type { ReferralCelebration as Celebration } from '../../../lib/referral'

const base: Celebration = {
  variant: 'referrer',
  breads: 5,
  names: ['Maria'],
  referrerName: null,
  goal: null,
  seen: { referralIds: ['r1'], goalThresholds: [], welcome: false },
}

function renderCel(c: Partial<Celebration>, onGo = vi.fn(), onClose = vi.fn()) {
  render(<ReferralCelebration celebration={{ ...base, ...c }} onGo={onGo} onClose={onClose} />)
  return { onGo, onClose }
}

describe('ReferralCelebration (C5)', () => {
  it('diálogo acessível: aria-modal, título no aria-labelledby, foco no CTA', () => {
    renderCel({})
    const dialog = screen.getByRole('dialog', { name: 'Você ganhou 5 pãezins!' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Indicar mais' })).toHaveFocus()
  })

  it('friend → "Ver meu saldo" leva ao extrato', () => {
    const { onGo } = renderCel({ variant: 'friend', breads: 3, names: [], referrerName: 'João', seen: { referralIds: [], goalThresholds: [], welcome: true } })
    expect(screen.getByText('PRESENTE DE BOAS-VINDAS')).toBeInTheDocument()
    expect(screen.getByText('3 pãezins por ter vindo pela indicação de João. Já estão no seu saldo.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver meu saldo' }))
    expect(onGo).toHaveBeenCalledWith('/client/creditos/extrato')
  })

  it('goal → marco e próxima meta', () => {
    renderCel({ variant: 'goal', breads: 10, names: [], goal: { threshold: 5, bonus: 10, next: { threshold: 10, bonus: 25 } } })
    expect(screen.getByRole('dialog', { name: '+10 pãezins pela 5ª indicação' })).toBeInTheDocument()
    expect(screen.getByText('Cinco vizinhos com pão fresquinho na porta. Próxima meta: 10ª indicação, +25.')).toBeInTheDocument()
  })

  it('multi → soma, quantidade e nomes', () => {
    renderCel({ variant: 'multi', breads: 15, names: ['Maria', 'Pedro', 'Lúcia'], seen: { referralIds: ['a', 'b', 'c'], goalThresholds: [], welcome: false } })
    expect(screen.getByRole('dialog', { name: 'Você ganhou 15 pãezins com 3 indicações' })).toBeInTheDocument()
    expect(screen.getByText('Maria, Pedro e Lúcia receberam o primeiro pedido.')).toBeInTheDocument()
  })

  it('Esc, X e "Agora não" fecham', () => {
    const { onClose } = renderCel({})
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('trap de foco: Tab no último volta para o primeiro', () => {
    renderCel({})
    const last = screen.getByRole('button', { name: 'Agora não' })
    last.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus()
  })
})
