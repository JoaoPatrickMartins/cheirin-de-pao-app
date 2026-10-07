// Kit do entregador — o que importa no contexto da madrugada: estado com ícone + texto, sheet
// acessível (Esc fecha, foco volta) e botões que não disparam desabilitados.
import { vi, describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CRBig, CRProof, CRSheet, CRSync, CRChoice, CRAvatar, CRTextarea, crMoney, crNum, crInitials } from '../kit'

describe('kit do entregador', () => {
  it('CRBig desabilitado não dispara', () => {
    const onClick = vi.fn()
    render(<CRBig onClick={onClick} disabled icon="check">Confirmar entrega</CRBig>)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('CRProof mostra o estado por extenso (nunca só cor)', () => {
    const { rerender } = render(<CRProof state="pendente" />)
    expect(screen.getByText('pendente de envio')).toBeDefined()
    rerender(<CRProof state="sem" />)
    expect(screen.getByText('sem foto')).toBeDefined()
    rerender(<CRProof state={null} />)
    expect(screen.queryByText(/foto/)).toBeNull()
  })

  it('CRSheet: dialog com título, Esc fecha e o foco volta para quem abriu', () => {
    const onClose = vi.fn()
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = render(
      <CRSheet title="Digitar código" sub="O código fica embaixo do QR do cupom." onClose={onClose}>
        <button type="button">Confirmar</button>
      </CRSheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Digitar código' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('CRSheet ocupado (busy) não fecha', () => {
    const onClose = vi.fn()
    render(
      <CRSheet title="Não consegui entregar" onClose={onClose} busy>
        <span>conteúdo</span>
      </CRSheet>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('CRSync: singular e plural, e "Enviando"', () => {
    const { rerender } = render(<CRSync kind="offline" count={1} />)
    expect(screen.getByRole('status').textContent).toContain('1 entrega guardada, sobe quando o sinal voltar')
    rerender(<CRSync kind="offline" count={2} />)
    expect(screen.getByRole('status').textContent).toContain('2 entregas guardadas, sobem')
    rerender(<CRSync kind="sending" count={3} />)
    expect(screen.getByRole('status').textContent).toContain('Enviando 3…')
  })

  it('CRChoice é um radio acessível', () => {
    const onClick = vi.fn()
    render(<CRChoice on onClick={onClick} note="Rua das Flores, 120">Base — Padaria Pão Nosso</CRChoice>)
    const radio = screen.getByRole('radio')
    expect(radio.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(radio)
    expect(onClick).toHaveBeenCalled()
  })

  it('CRAvatar: foto quando há URL, iniciais sem foto', () => {
    const { rerender } = render(<CRAvatar name="Antônio Ribeiro" />)
    expect(screen.getByText('AR')).toBeDefined()
    rerender(<CRAvatar name="Antônio Ribeiro" photoUrl="https://x/couriers/a.jpg" />)
    expect(screen.getByRole('img', { name: 'Foto de Antônio Ribeiro' })).toBeDefined()
  })

  it('CRTextarea marca o erro do campo', () => {
    render(<CRTextarea value="" onChange={() => {}} error="Escreva o motivo para seguir" />)
    const field = screen.getByRole('textbox')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Escreva o motivo para seguir')).toBeDefined()
  })

  it('formatadores', () => {
    expect(crMoney(6.6)).toBe('R$ 6,60')
    expect(crNum(9.2)).toBe('9,2')
    expect(crInitials('Antônio Ribeiro da Silva')).toBe('AR')
  })
})
