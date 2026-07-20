// Testes do fulfillment server-side do Pedido único (criação da Order na aprovação do Pix).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Mocka o OrdersService — aqui só nos interessa SE/COMO createSingleOrder é chamado.
const createSingleOrder = vi.fn()
vi.mock('../../orders/orders.service.js', () => ({
  OrdersService: class {
    constructor(_fastify: unknown) {}
    createSingleOrder = createSingleOrder
  },
}))

import { fulfillSingleOrderFromMetadata } from '../fulfill-single-order.js'

function mockFastify(): FastifyInstance {
  return { log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } } as unknown as FastifyInstance
}

const payment = { id: 'pay-1', userId: 'user-1' }

describe('fulfillSingleOrderFromMetadata', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sem intenção de pedido na metadata → não cria pedido (compra de crédito comum)', async () => {
    await fulfillSingleOrderFromMetadata(mockFastify(), payment, { userId: 'user-1' })
    expect(createSingleOrder).not.toHaveBeenCalled()
  })

  it('metadata ausente ou inválida → não cria pedido', async () => {
    await fulfillSingleOrderFromMetadata(mockFastify(), payment, undefined)
    await fulfillSingleOrderFromMetadata(mockFastify(), payment, {
      order_quantity: '0',
      order_scheduled_date: 'data-invalida',
    })
    expect(createSingleOrder).not.toHaveBeenCalled()
  })

  it('com intenção válida → cria o pedido com o paymentId (idempotência fica no service)', async () => {
    createSingleOrder.mockResolvedValueOnce({ id: 'order-1' })
    await fulfillSingleOrderFromMetadata(mockFastify(), payment, {
      order_quantity: '5',
      order_scheduled_date: '2026-07-21',
      order_delivery_time: '08:00',
    })
    expect(createSingleOrder).toHaveBeenCalledWith('user-1', {
      quantity: 5,
      scheduledDate: '2026-07-21',
      deliveryTime: '08:00',
      paymentId: 'pay-1',
    })
  })

  it('falha do service (corte vencido, saldo, etc.) é engolida — nunca lança e loga aviso', async () => {
    createSingleOrder.mockRejectedValueOnce({ statusCode: 400, message: 'Prazo encerrado' })
    const fastify = mockFastify()
    await expect(
      fulfillSingleOrderFromMetadata(fastify, payment, {
        order_quantity: '3',
        order_scheduled_date: '2026-07-21',
      }),
    ).resolves.toBeUndefined()
    expect(fastify.log.warn).toHaveBeenCalled()
  })
})
