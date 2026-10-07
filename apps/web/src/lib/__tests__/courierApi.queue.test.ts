// Envio de uma operação guardada (Onda 4): o mesmo clientOpId e o horário real em toda tentativa,
// e cada resposta do servidor vira feito / tentar de novo / descartar.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../apiFetch', () => ({ apiFetch: mockApiFetch }))

import { sendQueuedOp } from '../courierApi'
import type { QueuedOp } from '../courierQueue'

const base = { courierId: 'k1', stopKey: 'o1', occurredAt: '2026-10-02T09:10:00.000Z', createdAt: 1, attempts: 2 }
const confirmOp: QueuedOp = { ...base, id: 'op-confirm-1', kind: 'confirm', target: { kind: 'BREAD', id: 'o1' }, via: 'SCAN' }
const failOp: QueuedOp = { ...base, id: 'op-fail-1', kind: 'notDelivered', target: { kind: 'MARKET', id: 'm1' }, failureCode: 'OUTRO', reason: 'portão travado', via: 'LIST' }
const proofOp: QueuedOp = { ...base, id: 'op-proof-1', kind: 'proof', key: 'o1', outcome: 'DELIVERED', photo: { data: new Uint8Array([1]).buffer, type: 'image/jpeg' } }
const skipOp: QueuedOp = { ...base, id: 'op-skip-1', kind: 'proofSkip', key: 'o1', outcome: 'DELIVERED', mode: 'SKIPPED' }

const res = (status: number, body: unknown = {}) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })
const summary = (status: string) => ({ summary: { status }, error: 'x' })

beforeEach(() => mockApiFetch.mockReset())
afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})

describe('sendQueuedOp', () => {
  it('confirmação: mesmo clientOpId e o horário real da ação', async () => {
    mockApiFetch.mockReturnValue(res(200, { status: 'DELIVERED' }))
    expect(await sendQueuedOp(confirmOp)).toEqual({ kind: 'done' })
    const [url, opts] = mockApiFetch.mock.calls[0]
    expect(url).toBe('/courier/orders/o1/confirm')
    expect(JSON.parse(opts.body)).toEqual({ via: 'SCAN', clientOpId: 'op-confirm-1', occurredAt: '2026-10-02T09:10:00.000Z' })
  })

  it('409 do MESMO desfecho conta como feito; de outro desfecho, descarta como já resolvida', async () => {
    mockApiFetch.mockReturnValueOnce(res(409, summary('DELIVERED')))
    expect(await sendQueuedOp(confirmOp)).toEqual({ kind: 'done' })
    mockApiFetch.mockReturnValueOnce(res(409, summary('NOT_DELIVERED')))
    expect(await sendQueuedOp(confirmOp)).toEqual({ kind: 'discard', reason: 'resolved' })
    mockApiFetch.mockReturnValueOnce(res(409, summary('NOT_DELIVERED')))
    expect(await sendQueuedOp(failOp)).toEqual({ kind: 'done' })
  })

  it('não entrega da Cestinha vai para a rota dela com o motivo', async () => {
    mockApiFetch.mockReturnValue(res(200, { status: 'NOT_DELIVERED' }))
    await sendQueuedOp(failOp)
    const [url, opts] = mockApiFetch.mock.calls[0]
    expect(url).toBe('/courier/market-orders/m1/not-delivered')
    expect(JSON.parse(opts.body)).toMatchObject({ failureCode: 'OUTRO', reason: 'portão travado', clientOpId: 'op-fail-1', occurredAt: base.occurredAt })
  })

  it('parada só de gancho: confirmação e não entrega guardadas vão para a rota do gancho', async () => {
    mockApiFetch.mockReturnValue(res(200, { status: 'DELIVERED' }))
    expect(await sendQueuedOp({ ...confirmOp, target: { kind: 'HOOK', id: 'h1' } })).toEqual({ kind: 'done' })
    expect(mockApiFetch.mock.calls[0][0]).toBe('/courier/hooks/h1/confirm')
    expect(JSON.parse(mockApiFetch.mock.calls[0][1].body)).toMatchObject({ clientOpId: 'op-confirm-1', occurredAt: base.occurredAt })
    await sendQueuedOp({ ...failOp, target: { kind: 'HOOK', id: 'h1' } })
    expect(mockApiFetch.mock.calls[1][0]).toBe('/courier/hooks/h1/not-delivered')
  })

  it('outra rota / não existe / inválido → descarta; 5xx e 401 → tenta de novo', async () => {
    for (const [status, out] of [
      [403, { kind: 'discard', reason: 'invalid' }],
      [404, { kind: 'discard', reason: 'invalid' }],
      [400, { kind: 'discard', reason: 'invalid' }],
      [500, { kind: 'retry', network: false }],
      [401, { kind: 'retry', network: false }],
    ] as const) {
      mockApiFetch.mockReturnValueOnce(res(status))
      expect(await sendQueuedOp(confirmOp)).toEqual(out)
    }
  })

  it('sem sinal: falha de conexão ou aparelho offline (nem tenta) → tenta de novo depois', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await sendQueuedOp(confirmOp)).toEqual({ kind: 'retry', network: true })
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    expect(await sendQueuedOp(proofOp)).toEqual({ kind: 'retry', network: true })
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
  })

  it('foto: multipart com o id da operação; 503 (sem armazenamento) descarta como indisponível', async () => {
    mockApiFetch.mockReturnValueOnce(res(201, { status: 'OK' }))
    expect(await sendQueuedOp(proofOp)).toEqual({ kind: 'done' })
    const [url, opts] = mockApiFetch.mock.calls[0]
    expect(url).toBe('/courier/stops/o1/proof?outcome=DELIVERED&clientOpId=op-proof-1')
    expect(opts.body).toBeInstanceOf(FormData)
    mockApiFetch.mockReturnValueOnce(res(503))
    expect(await sendQueuedOp(proofOp)).toEqual({ kind: 'discard', reason: 'unavailable' })
    mockApiFetch.mockReturnValueOnce(res(404))
    expect(await sendQueuedOp(proofOp)).toEqual({ kind: 'discard', reason: 'invalid' })
  })

  it('pular: 422 (foto obrigatória) descarta; 502 tenta de novo', async () => {
    mockApiFetch.mockReturnValueOnce(res(422))
    expect(await sendQueuedOp(skipOp)).toEqual({ kind: 'discard', reason: 'invalid' })
    mockApiFetch.mockReturnValueOnce(res(502))
    expect(await sendQueuedOp(skipOp)).toEqual({ kind: 'retry', network: false })
    expect(JSON.parse(mockApiFetch.mock.calls[0][1].body)).toEqual({ outcome: 'DELIVERED', mode: 'SKIPPED' })
  })
})

describe('sendQueuedOp — operação (Onda 8)', () => {
  const msgOp: QueuedOp = { ...base, id: 'op-msg-1', kind: 'message', key: 'o1', template: 'NA_PORTARIA' }
  const hookOp: QueuedOp = { ...base, id: 'op-hook-1', kind: 'hookOutcome', hookId: 'h1', delivered: false }
  const incOp: QueuedOp = { ...base, id: 'op-inc-1', stopKey: 'incident:op-inc-1', kind: 'report', report: { kind: 'INCIDENT', type: 'VEICULO', text: 'Pneu furou' }, photo: { data: new Uint8Array([1]).buffer, type: 'image/jpeg' } }

  it('recado: mesmo clientOpId; 409 (já enviado / cliente desligou) descarta', async () => {
    mockApiFetch.mockReturnValueOnce(res(200, { sentAt: 'x' }))
    expect(await sendQueuedOp(msgOp)).toEqual({ kind: 'done' })
    expect(mockApiFetch.mock.calls[0][0]).toBe('/courier/messages')
    expect(JSON.parse(mockApiFetch.mock.calls[0][1].body)).toEqual({ stopKey: 'o1', template: 'NA_PORTARIA', clientOpId: 'op-msg-1' })
    mockApiFetch.mockReturnValueOnce(res(409, { code: 'ALREADY', error: 'x' }))
    expect(await sendQueuedOp(msgOp)).toEqual({ kind: 'discard', reason: 'invalid' })
    mockApiFetch.mockReturnValueOnce(res(500))
    expect(await sendQueuedOp(msgOp)).toEqual({ kind: 'retry', network: false })
  })

  it('ocorrência com foto: sobe a foto e manda a chave; sem armazenamento (503) vai sem a foto', async () => {
    mockApiFetch.mockReturnValueOnce(res(201, { photoKey: 'reports/abc.jpg' })).mockReturnValueOnce(res(201, { id: 'r1' }))
    expect(await sendQueuedOp(incOp)).toEqual({ kind: 'done' })
    expect(mockApiFetch.mock.calls[0][0]).toBe('/courier/reports/photo')
    expect(JSON.parse(mockApiFetch.mock.calls[1][1].body)).toEqual({ kind: 'INCIDENT', type: 'VEICULO', text: 'Pneu furou', photoKey: 'reports/abc.jpg', clientOpId: 'op-inc-1' })
    mockApiFetch.mockReset()
    mockApiFetch.mockReturnValueOnce(res(503, { error: 'sem S3' })).mockReturnValueOnce(res(201, { id: 'r1' }))
    expect(await sendQueuedOp(incOp)).toEqual({ kind: 'done' })
    expect(JSON.parse(mockApiFetch.mock.calls[1][1].body)).not.toHaveProperty('photoKey')
  })

  it('gancho: sem sinal fica para depois', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    expect(await sendQueuedOp(hookOp)).toEqual({ kind: 'retry', network: true })
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    mockApiFetch.mockReturnValueOnce(res(200, { status: 'QUEUE' }))
    expect(await sendQueuedOp(hookOp)).toEqual({ kind: 'done' })
    expect(mockApiFetch.mock.calls[0]).toEqual(['/courier/hooks/h1/outcome', expect.objectContaining({ method: 'POST', body: JSON.stringify({ delivered: false }) })])
  })
})
