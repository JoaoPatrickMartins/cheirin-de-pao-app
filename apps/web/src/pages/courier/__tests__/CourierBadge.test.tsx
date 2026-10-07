// E15 · Crachá digital v3 "Cordão" (Onda 11 · handoff .projeto/design_handoff_cracha_v3): frente e
// verso, QR e código que mudam a cada 30 s (gerados no aparelho), sem foto, desativado e vencido.
import { vi, describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { badgeToken, badgeWindow } from '@cheirin-de-pao/shared'
import { CourierBadge } from '../CourierBadge'
import { meBody } from './peopleFixtures'

const SECRET = 'segredo-de-teste'
const props = (over: Partial<Parameters<typeof CourierBadge>[0]> = {}) => ({ me: meBody(), courierId: 'k1', secret: SECRET, onClose: vi.fn(), ...over })
const codeOf = async (ms: number) => (await badgeToken(SECRET, 'k1', badgeWindow(ms).window))!.code

afterEach(() => vi.useRealTimers())

describe('E15 · Crachá v3 · ativo', () => {
  it('frente: nome, "desde" com a validade, CPF, veículo, Ativo, relógio, QR e código "0427 · XXXX"', async () => {
    render(<CourierBadge {...props()} />)
    const badge = screen.getByRole('dialog', { name: 'Crachá digital' })
    expect(within(badge).getByText('Antônio Ribeiro')).toBeDefined()
    expect(within(badge).getByText('Entregador parceiro · desde mar/2026 · válido até 31/12/2026')).toBeDefined()
    expect(within(badge).getByText('***.456.789-**')).toBeDefined()
    expect(within(badge).getByText('Moto · ABC1D23')).toBeDefined()
    expect(within(badge).getByTestId('badge-status').textContent).toBe('Ativo')
    expect(within(badge).getByTestId('badge-clock').textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(await within(badge).findByRole('button', { name: 'Virar o crachá e ampliar o QR' })).toBeDefined()
    const code = within(badge).getByTestId('badge-code').textContent
    expect(code).toMatch(/^0427 · [23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
    expect(within(badge).getAllByRole('img', { name: 'QR de validação do crachá' })[0].getAttribute('data-payload')).toMatch(/^cdp:b1:k1:\d+:[A-Z2-7]{10}$/)
    expect(within(badge).getByText(/novo código em \d+ s/)).toBeDefined()
    expect(within(badge).getByText('Toque no QR para virar o crachá')).toBeDefined()
  })

  it('tocar no QR vira para o verso (QR grande + código) e tocar de novo volta', async () => {
    render(<CourierBadge {...props()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Virar o crachá e ampliar o QR' }))
    expect(screen.getByText('Toque no QR para voltar à frente')).toBeDefined()
    expect(screen.getByText('ou digite o código')).toBeDefined()
    expect(screen.getByText('Entregador · Cheirin de Pão')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para a frente do crachá' }))
    expect(screen.getByText('Toque no QR para virar o crachá')).toBeDefined()
  })

  it('o código troca quando passa a janela de 30 s (gerado no aparelho, sem rede)', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const t0 = 1_780_370_340_000 + 27_000 // 3 s antes da virada da janela
    vi.setSystemTime(t0)
    render(<CourierBadge {...props()} />)
    const first = await codeOf(t0)
    await waitFor(() => expect(screen.getByTestId('badge-code').textContent).toBe(`0427 · ${first}`))
    expect(screen.getByText('novo código em 3 s')).toBeDefined()
    await act(async () => {
      vi.advanceTimersByTime(3_000)
    })
    const second = await codeOf(t0 + 3_000)
    expect(second).not.toBe(first)
    await waitFor(() => expect(screen.getByTestId('badge-code').textContent).toBe(`0427 · ${second}`))
    expect(screen.getByText('novo código em 30 s')).toBeDefined()
  })

  it('relógio corrigido pela hora do servidor (offset)', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-10-05T09:00:00.000Z')) // 06:00:00 BRT no aparelho
    render(<CourierBadge {...props({ offsetMs: 90_000 })} />)
    expect(screen.getByTestId('badge-clock').textContent).toBe('06:01:30')
  })
})

describe('E15 · Crachá v3 · estados', () => {
  it('sem foto: iniciais e "Peça sua foto à operação"; com foto, a foto e sem o aviso', () => {
    const { unmount } = render(<CourierBadge {...props()} />)
    expect(screen.getAllByText('AR').length).toBeGreaterThan(0)
    expect(screen.getByText('Peça sua foto à operação')).toBeDefined()
    unmount()
    render(<CourierBadge {...props({ me: meBody({ photoUrl: 'https://cdn/x.jpg' }) })} />)
    expect(screen.getByRole('img', { name: 'Foto de Antônio Ribeiro' })).toBeDefined()
    expect(screen.queryByText('Peça sua foto à operação')).toBeNull()
  })

  it('desativado: Inativo, sem QR, "Sem validade" e "Falar com a operação"', () => {
    render(<CourierBadge {...props({ me: meBody({ badge: { number: '0427', validUntil: '2026-12-31', active: false, reason: 'DESATIVADO' } }) })} />)
    expect(screen.getByTestId('badge-status').textContent).toBe('Inativo')
    expect(screen.getByText('QR indisponível')).toBeDefined()
    expect(screen.getByText('Seu cadastro está desativado')).toBeDefined()
    expect(screen.getByTestId('badge-clock').textContent).toBe('Sem validade')
    expect(screen.queryByRole('button', { name: 'Virar o crachá e ampliar o QR' })).toBeNull()
    expect(screen.queryByText(/Toque no QR/)).toBeNull()
    expect(screen.getByText('O crachá volta quando a operação reativar seu cadastro.')).toBeDefined()
    expect(screen.getByRole('link', { name: /Falar com a operação/ }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\//)
  })

  it('vencido (H-10): Vencido, "Seu crachá venceu em 30/09/2026" e o aviso de renovação', () => {
    render(<CourierBadge {...props({ me: meBody({ badge: { number: '0427', validUntil: '2026-09-30', active: false, reason: 'VENCIDO' } }) })} />)
    expect(screen.getByTestId('badge-status').textContent).toBe('Vencido')
    expect(screen.getByText('Seu crachá venceu em 30/09/2026')).toBeDefined()
    expect(screen.getByText('A validade do seu crachá passou. A operação renova no seu cadastro.')).toBeDefined()
    expect(screen.queryByTestId('badge-code')).toBeNull()
  })

  it('veículo: bicicleta sem placa; sem veículo, a coluna some; sem validade, só o "desde"', () => {
    const { unmount } = render(<CourierBadge {...props({ me: meBody({ vehicle: { tipo: 'BIKE', placa: 'XYZ' } }) })} />)
    expect(screen.getByText('Bicicleta')).toBeDefined()
    unmount()
    render(<CourierBadge {...props({ me: meBody({ vehicle: null, badge: { number: '0427', validUntil: null, active: true, reason: 'ATIVO' } }) })} />)
    expect(screen.queryByText('VEÍCULO')).toBeNull()
    expect(screen.getByText('Entregador parceiro · desde mar/2026')).toBeDefined()
  })

  it('sem o segredo neste aparelho (nunca abriu com sinal): explica, sem QR', () => {
    render(<CourierBadge {...props({ secret: null })} />)
    expect(screen.getByText('Abra o app com sinal uma vez para gerar o QR.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Virar o crachá e ampliar o QR' })).toBeNull()
  })

  it('fechar', () => {
    const p = props()
    render(<CourierBadge {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(p.onClose).toHaveBeenCalled()
  })
})
