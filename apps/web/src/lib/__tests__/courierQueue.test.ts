// Fila offline do entregador (Onda 4, T-7) — sobre um IndexedDB de verdade (fake-indexeddb):
// sobrevive a fechar o app, ordem de envio, sem sinal × erro do servidor × recusa definitiva.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  clearOps,
  enqueueOp,
  flushOps,
  listOps,
  loadRoute,
  pendingStops,
  photoForQueue,
  resetCourierQueue,
  saveRoute,
  type QueuedOp,
  type SendOutcome,
} from '../courierQueue'

let order = 0
const confirm = (stopKey: string, over: Partial<QueuedOp> = {}): QueuedOp =>
  ({
    id: `op-${stopKey}-confirm`,
    courierId: 'k1',
    stopKey,
    occurredAt: '2026-10-02T09:10:00.000Z',
    createdAt: ++order,
    attempts: 0,
    kind: 'confirm',
    target: { kind: 'BREAD', id: stopKey },
    via: 'SCAN',
    ...over,
  }) as QueuedOp
const proof = (stopKey: string): QueuedOp => ({
  id: `op-${stopKey}-proof`,
  courierId: 'k1',
  stopKey,
  occurredAt: '2026-10-02T09:10:30.000Z',
  createdAt: ++order,
  attempts: 0,
  kind: 'proof',
  key: stopKey,
  outcome: 'DELIVERED',
  photo: { data: new Uint8Array([1, 2, 3]).buffer, type: 'image/jpeg' },
})

beforeEach(() => {
  // Um IndexedDB novo por teste.
  ;(globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  resetCourierQueue()
})

describe('armazenamento', () => {
  it('guarda no IndexedDB: a fila sobrevive a fechar e abrir o app', async () => {
    await enqueueOp(confirm('a'))
    await enqueueOp(proof('a'))
    resetCourierQueue() // "fecha o app": a próxima leitura reabre o banco
    const ops = await listOps('k1')
    expect(ops.map((o) => o.id)).toEqual(['op-a-confirm', 'op-a-proof'])
    const photo = ops[1] as Extract<QueuedOp, { kind: 'proof' }>
    expect(new Uint8Array(photo.photo.data)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('cada entregador vê só o que é dele; sair limpa só o dele', async () => {
    await enqueueOp(confirm('a'))
    await enqueueOp(confirm('b', { courierId: 'k2', id: 'op-b' }))
    expect((await listOps('k1')).map((o) => o.stopKey)).toEqual(['a'])
    await clearOps('k1')
    expect(await listOps('k1')).toEqual([])
    expect(await listOps('k2')).toHaveLength(1)
  })

  it('ordem de criação, não de inserção', async () => {
    await enqueueOp(confirm('b', { createdAt: 20 }))
    await enqueueOp(confirm('a', { createdAt: 10 }))
    expect((await listOps('k1')).map((o) => o.stopKey)).toEqual(['a', 'b'])
  })

  it('a foto vira bytes para guardar (Blob no IndexedDB já teve bug no Safari)', async () => {
    const p = await photoForQueue(new Blob([new Uint8Array([9, 8])], { type: 'image/jpeg' }))
    expect(p.type).toBe('image/jpeg')
    expect(new Uint8Array(p.data)).toEqual(new Uint8Array([9, 8]))
  })

  it('a faixa conta paradas, não operações', () => {
    expect(pendingStops([confirm('a'), proof('a'), confirm('b')]).size).toBe(2)
  })
})

describe('flushOps', () => {
  it('envia em ordem e tira da fila o que subiu', async () => {
    await enqueueOp(confirm('a'))
    await enqueueOp(proof('a'))
    const sent: string[] = []
    const onResult = vi.fn()
    const r = await flushOps('k1', async (op) => (sent.push(op.id), { kind: 'done' }), onResult)
    expect(r.offline).toBe(false)
    expect(sent).toEqual(['op-a-confirm', 'op-a-proof'])
    expect(await listOps('k1')).toEqual([])
    expect(onResult).toHaveBeenCalledTimes(2)
  })

  it('sem sinal: para tudo, mantém a fila e conta a tentativa', async () => {
    await enqueueOp(confirm('a'))
    await enqueueOp(confirm('b'))
    const send = vi.fn(async (): Promise<SendOutcome> => ({ kind: 'retry', network: true }))
    const r = await flushOps('k1', send)
    expect(r.offline).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    const ops = await listOps('k1')
    expect(ops.map((o) => [o.stopKey, o.attempts])).toEqual([
      ['a', 1],
      ['b', 0],
    ])
  })

  it('erro do servidor (5xx): só aquela parada espera — a foto dela também; as outras seguem', async () => {
    await enqueueOp(confirm('a'))
    await enqueueOp(proof('a'))
    await enqueueOp(confirm('b'))
    const sent: string[] = []
    const r = await flushOps('k1', async (op) => {
      sent.push(op.id)
      return op.stopKey === 'a' ? { kind: 'retry', network: false } : { kind: 'done' }
    })
    expect(r.offline).toBe(false)
    expect(sent).toEqual(['op-a-confirm', 'op-b-confirm'])
    expect((await listOps('k1')).map((o) => o.id)).toEqual(['op-a-confirm', 'op-a-proof'])
  })

  it('desfecho recusado/já resolvido: descarta e leva junto a foto da mesma parada', async () => {
    await enqueueOp(confirm('a'))
    await enqueueOp(proof('a'))
    await enqueueOp(confirm('b'))
    const onResult = vi.fn()
    const send = vi.fn(async (op: QueuedOp): Promise<SendOutcome> => (op.stopKey === 'a' ? { kind: 'discard', reason: 'resolved' } : { kind: 'done' }))
    await flushOps('k1', send, onResult)
    expect(send.mock.calls.map(([op]) => op.id)).toEqual(['op-a-confirm', 'op-b-confirm'])
    expect(await listOps('k1')).toEqual([])
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ id: 'op-a-proof' }), { kind: 'discard', reason: 'resolved' })
  })

  it('foto recusada não derruba o desfecho já enviado', async () => {
    await enqueueOp(confirm('a'))
    await enqueueOp(proof('a'))
    const send = vi.fn(async (op: QueuedOp): Promise<SendOutcome> => (op.kind === 'proof' ? { kind: 'discard', reason: 'unavailable' } : { kind: 'done' }))
    const onResult = vi.fn()
    await flushOps('k1', send, onResult)
    expect(onResult).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'confirm' }), { kind: 'done' })
    expect(onResult).toHaveBeenNthCalledWith(2, expect.objectContaining({ kind: 'proof' }), { kind: 'discard', reason: 'unavailable' })
  })
})

describe('operação (Onda 8)', () => {
  const message = (stopKey: string): QueuedOp => ({ id: `op-${stopKey}-msg`, courierId: 'k1', stopKey, occurredAt: '2026-10-02T09:11:00.000Z', createdAt: ++order, attempts: 0, kind: 'message', key: stopKey, template: 'NA_PORTARIA' })
  const incident: QueuedOp = { id: 'op-inc', courierId: 'k1', stopKey: 'incident:op-inc', occurredAt: '2026-10-02T09:12:00.000Z', createdAt: ++order, attempts: 0, kind: 'report', report: { kind: 'INCIDENT', type: 'VEICULO', text: 'Pneu' } }

  it('recado e ocorrência não contam como entrega guardada', () => {
    expect(pendingStops([confirm('a'), message('a'), message('b'), incident]).size).toBe(1)
  })

  it('desfecho recusado leva a foto, mas o recado da mesma parada segue', async () => {
    await enqueueOp(confirm('a'))
    await enqueueOp(message('a'))
    await enqueueOp(proof('a'))
    const send = vi.fn(async (op: QueuedOp): Promise<SendOutcome> => (op.kind === 'confirm' ? { kind: 'discard', reason: 'resolved' } : { kind: 'done' }))
    await flushOps('k1', send)
    expect(send.mock.calls.map(([op]) => op.id)).toEqual(['op-a-confirm', 'op-a-msg'])
    expect(await listOps('k1')).toEqual([])
  })
})

describe('rota guardada', () => {
  const now = new Date('2026-10-02T09:00:00.000Z') // 06:00 BRT

  it('abre a rota de hoje do mesmo entregador', async () => {
    await saveRoute('k1', { totalStops: 3 }, now)
    expect(await loadRoute('k1', new Date('2026-10-02T12:00:00.000Z'))).toEqual({ data: { totalStops: 3 }, savedAt: now.toISOString() })
  })

  it('rota de ontem ou de outro entregador não vale', async () => {
    await saveRoute('k1', { totalStops: 3 }, now)
    expect(await loadRoute('k2', now)).toBeNull()
    expect(await loadRoute('k1', new Date('2026-10-03T09:00:00.000Z'))).toBeNull()
  })
})

describe('sem IndexedDB', () => {
  it('cai para a memória e continua funcionando com o app aberto', async () => {
    ;(globalThis as { indexedDB?: IDBFactory }).indexedDB = undefined
    resetCourierQueue()
    await enqueueOp(confirm('a'))
    expect(await listOps('k1')).toHaveLength(1)
  })
})
