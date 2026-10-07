// A2 · turno recusado (plano-termos-legais §5): quem recusou, o que voltou para a divisão e o selo
// "recusou o turno" no card de divisão (fora da sugestão).
import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('../../../../components/admin/LiveRoutesCard', () => ({ LiveRoutesCard: () => null }))

import { AdminEntregas } from '../AdminEntregas'

const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b) })
const unit = { condominiumId: 'cA', condominiumName: 'Residencial Jardins', block: null, quantity: 10, items: 0, orderIds: ['o1'], marketOrderIds: [], blocks: [] }

describe('A2 · turno recusado', () => {
  it('mostra quem recusou (motivo, hora, paradas), quantas já estão na rua e o selo no card', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/admin/settings/slots') return ok({ slots: [{ slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', cutoffTime: '22:00' }] })
      if (url.startsWith('/admin/orders/division-suggestion'))
        return ok({
          approved: false,
          partial: { dispatchedStops: 7 },
          declined: [{ courierId: 'k1', courierName: 'Antônio Ribeiro', slotId: 'manha', at: '2026-10-02T08:20:00.000Z', reason: 'VEICULO', stops: 18 }],
          assignments: [
            { courierId: 'k2', courierName: 'Joana Pires', condominiums: [unit], total: 10, totalItems: 0, offReason: null },
            { courierId: 'k1', courierName: 'Antônio Ribeiro', condominiums: [], total: 0, totalItems: 0, offReason: 'RECUSOU' },
          ],
        })
      if (url.startsWith('/admin/orders/delivery-status')) return ok([])
      return ok({})
    })
    render(<AdminEntregas />)
    expect((await screen.findAllByText('Antônio Ribeiro')).length).toBe(2)
    expect(document.body.textContent).toContain('Antônio Ribeiro recusou o turno da manhã às 05:20 (problema no veículo) · 18 paradas.')
    expect(screen.getByText('7 paradas já estão na rua com os entregadores. Distribua só as que voltaram e aprove.')).toBeDefined()
    expect(screen.getByText('recusou o turno')).toBeDefined()
  })
})
