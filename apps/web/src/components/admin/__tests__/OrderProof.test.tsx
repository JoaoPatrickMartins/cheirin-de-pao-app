// A1 do plano do entregador — seção "Comprovante" no detalhe do pedido do admin: foto, sem foto
// (exceção com motivo), pulada, subindo, não entrega com a foto da porta e o visualizador.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { OrderProof, type ProofDetail } from '../OrderProof'
import { OrderDetailSheet, type LedgerRow } from '../OrderDetailSheet'

const mockApiFetch = vi.fn()
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))

const proof = (over: Partial<ProofDetail> = {}): ProofDetail => ({
  status: 'OK',
  outcome: 'DELIVERED',
  required: true,
  photoUrl: 'https://s3/signed/deliveries/abc.jpg',
  photoAt: '2026-10-01T08:31:00.000Z',
  note: null,
  confirmedVia: 'SCAN',
  expired: false,
  clientVisible: true,
  ...over,
})

const base = {
  delivered: true,
  at: '2026-10-01T08:31:00.000Z', // 05:31 BRT
  courierName: 'Antônio Ribeiro',
  failureCode: null,
  failureReason: '',
  place: 'Bloco 1 · Apto 101',
}

describe('OrderProof', () => {
  it('foto: miniatura, entregue às 05:31 por Antônio R. pelo scan, "cliente vê"', () => {
    render(<OrderProof {...base} proof={proof()} />)
    expect(screen.getByText('Entregue 05:31')).toBeDefined()
    expect(screen.getByText(/por Antônio R\. · pelo scan/)).toBeDefined()
    expect(screen.getByText('cliente vê')).toBeDefined()
  })

  it('"Ver em tela cheia" abre o visualizador com a validade de 90 dias', () => {
    render(<OrderProof {...base} proof={proof()} />)
    fireEvent.click(screen.getByRole('button', { name: /Ver em tela cheia/ }))
    const viewer = screen.getByRole('dialog', { name: 'Bloco 1 · Apto 101' })
    expect(within(viewer).getByText('Entregue às 05:31 · Antônio R.')).toBeDefined()
    expect(within(viewer).getByText('Guardada por 90 dias · até 30/12')).toBeDefined()
    expect((within(viewer).getByRole('img') as HTMLImageElement).src).toBe('https://s3/signed/deliveries/abc.jpg')
    fireEvent.click(within(viewer).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('URL vencida: a imagem falha e "Tentar de novo" pede o detalhe outra vez', () => {
    const onRefresh = vi.fn()
    render(<OrderProof {...base} proof={proof()} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: /Ver em tela cheia/ }))
    fireEvent.error(within(screen.getByRole('dialog')).getByRole('img'))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('sem foto (exceção): motivo e a regra do entregador; "só admin"', () => {
    render(<OrderProof {...base} proof={proof({ status: 'NONE', photoUrl: null, photoAt: null, note: 'Local sem luz', clientVisible: false })} />)
    expect(screen.getByText('sem foto')).toBeDefined()
    expect(screen.getByText('Local sem luz')).toBeDefined()
    expect(screen.getByText('Antônio R. tem foto obrigatória na entrega.')).toBeDefined()
    expect(screen.getByText('só admin')).toBeDefined()
  })

  it('pulada: a foto era opcional', () => {
    render(<OrderProof {...base} proof={proof({ status: 'SKIPPED', required: false, photoUrl: null, photoAt: null })} />)
    expect(screen.getByText('foto pulada')).toBeDefined()
    expect(screen.getByText('Antônio R. não tem foto obrigatória e escolheu pular.')).toBeDefined()
  })

  it('subindo: entrega recente ainda sem foto; antiga vira "não chegou"', () => {
    const now = new Date().toISOString()
    const { rerender } = render(<OrderProof {...base} at={now} proof={proof({ status: 'PENDING', photoUrl: null, photoAt: null })} />)
    expect(screen.getByText(/A foto ainda está subindo/)).toBeDefined()
    rerender(<OrderProof {...base} at="2026-09-01T08:31:00.000Z" proof={proof({ status: 'PENDING', photoUrl: null, photoAt: null })} />)
    expect(screen.getByText('A foto não chegou do celular do entregador.')).toBeDefined()
  })

  it('não entrega com a foto da porta: motivo padronizado + texto do entregador', () => {
    render(
      <OrderProof
        {...base}
        delivered={false}
        at="2026-10-01T08:47:00.000Z"
        failureCode="PORTARIA_NAO_LIBEROU"
        failureReason="Portaria não liberou — Porteiro não atendeu o interfone"
        proof={proof({ outcome: 'NOT_DELIVERED', required: false })}
      />,
    )
    expect(screen.getByText('Não entregue 05:47')).toBeDefined()
    expect(screen.getByText('Portaria não liberou')).toBeDefined()
    expect(screen.getByText('“Porteiro não atendeu o interfone”')).toBeDefined()
  })

  it('foto com mais de 90 dias: avisa que foi apagada', () => {
    render(<OrderProof {...base} proof={proof({ photoUrl: null, expired: true })} />)
    expect(screen.getByText('foto apagada')).toBeDefined()
    expect(screen.getByText(/já foi apagada/)).toBeDefined()
  })
})

const row = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  kind: 'BREAD',
  orderId: 'o1',
  marketOrderId: '',
  userId: 'u1',
  clientName: 'Maria Souza',
  condominiumId: 'c1',
  condominiumName: 'Residencial Jardins',
  block: '1',
  complement: '',
  apartment: '101',
  quantity: 4,
  slotId: 'manha',
  slotLabel: 'Manhã',
  type: 'SCHEDULED',
  status: 'NOT_DELIVERED',
  scheduledDate: '2026-10-01T15:00:00.000Z',
  courierId: 'k1',
  courierName: 'Antônio Ribeiro',
  separatedAt: '',
  deliveredAt: '',
  failedAt: '2026-10-01T08:47:00.000Z',
  failureReason: 'Cliente ausente',
  cancelReason: '',
  deliveryNote: '',
  refunded: false,
  paymentId: '',
  paymentAmount: 0,
  paymentStatus: '',
  marketItems: [],
  marketItemCount: 0,
  creditsApplied: 0,
  moneyAmount: 0,
  totalValue: 0,
  ...over,
})

describe('OrderDetailSheet — comprovante', () => {
  beforeEach(() => mockApiFetch.mockReset())

  it('o detalhe traz o comprovante e o motivo sai da lista de dados para a seção', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...row(),
          code: 'A1B2C3',
          createdAt: '2026-09-30T20:00:00.000Z',
          creditsDebited: 4,
          creditsDebitedDerived: false,
          refundedCredits: 0,
          payment: null,
          failureCode: 'CLIENTE_AUSENTE',
          proof: proof({ outcome: 'NOT_DELIVERED', status: 'SKIPPED', required: false, photoUrl: null, photoAt: null }),
        }),
    })
    render(<OrderDetailSheet row={row()} onClose={vi.fn()} onChanged={vi.fn()} />)
    expect(screen.getByText('Motivo')).toBeDefined()
    expect(await screen.findByText('Comprovante')).toBeDefined()
    expect(screen.getByText('Não entregue 05:47')).toBeDefined()
    expect(screen.getByText('foto pulada')).toBeDefined()
    expect(screen.queryByText('Motivo')).toBeNull()
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/orders/o1?kind=BREAD'))
  })

  it('pedido sem comprovante (antigo) não mostra a seção', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...row(), code: 'A1B2C3', createdAt: '', creditsDebited: 0, creditsDebitedDerived: false, refundedCredits: 0, payment: null, failureCode: null, proof: null }),
    })
    render(<OrderDetailSheet row={row()} onClose={vi.fn()} onChanged={vi.fn()} />)
    expect(await screen.findByText('Pagamento')).toBeDefined()
    expect(screen.queryByText('Comprovante')).toBeNull()
    expect(screen.getByText('Cliente ausente')).toBeDefined()
  })
})
