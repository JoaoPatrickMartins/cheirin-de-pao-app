// OrdersService unit tests — Wave 0 stub (Fase 4)
// Requirements: SCHED-07 (pedido avulso)
import { describe, it } from 'vitest'

describe('OrdersService', () => {
  it.todo('createSingleOrder reserva créditos e cria Order com type SINGLE e status SCHEDULED')
  it.todo('createSingleOrder lança erro 400 quando saldo insuficiente')
  it.todo('createSingleOrder rejeita scheduledDate no passado')
})
