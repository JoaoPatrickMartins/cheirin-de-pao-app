import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/**
 * Confirmação e busca por código pela SERIALIZAÇÃO: o fast-json-stringify descarta o que não está
 * no schema — o pop-up do scan depende de cada campo do resumo, inclusive os nulos, e o 409 precisa
 * levar o resumo junto.
 */
const summary = {
  kind: 'BREAD',
  orderId: 'o1',
  marketOrderIds: ['m1'],
  clientName: 'Maria Souza',
  condominiumId: 'c1',
  condominiumName: 'Residencial Jardins',
  block: '1',
  complement: null,
  apartment: '101',
  quantity: 6,
  marketItems: [{ name: 'Café 250 g', qty: 1 }],
  isFirstOrder: true,
  hasHook: false,
  hookToDeliver: null,
  status: 'DELIVERED',
  deliveredAt: '2026-10-01T08:31:00.000Z',
  failedAt: null,
  proofRequired: true,
}

const proofView = { status: 'OK', required: true, outcome: 'DELIVERED', photoAt: '2026-10-01T08:32:00.000Z', note: null }
const service = {
  markNotDelivered: vi.fn().mockResolvedValue({ ...summary, status: 'NOT_DELIVERED' }),
  uploadProof: vi.fn().mockResolvedValue(proofView),
  skipProof: vi.fn().mockResolvedValue({ ...proofView, status: 'NONE', photoAt: null, note: 'Local sem luz' }),
  confirmDelivery: vi.fn().mockResolvedValue(summary),
  confirmMarketDelivery: vi.fn().mockResolvedValue({ ...summary, kind: 'MARKET', orderId: null }),
  confirmHookStop: vi.fn().mockResolvedValue({ ...summary, kind: 'HOOK', orderId: null, hookId: 'h1', quantity: 0, marketOrderIds: [], marketItems: [] }),
  markHookNotDelivered: vi.fn().mockResolvedValue({ ...summary, kind: 'HOOK', orderId: null, hookId: 'h1', status: 'NOT_DELIVERED' }),
  lookupStopsByCode: vi.fn().mockResolvedValue([{ kind: 'BREAD', id: 'o1', summary }]),
}
vi.mock('../courier.service.js', () => ({
  CourierService: vi.fn().mockImplementation(function () {
    return service
  }),
}))

const runs = {
  start: vi.fn(),
  position: vi.fn().mockResolvedValue(undefined),
  reorder: vi.fn(),
  resetOrder: vi.fn().mockResolvedValue(null),
  summary: vi.fn(),
  end: vi.fn(),
}
vi.mock('../courier-runs.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../courier-runs.js')>()),
  CourierRunService: vi.fn().mockImplementation(function () {
    return runs
  }),
}))

const meSvc = {
  me: vi.fn(),
  acceptTerms: vi.fn(),
  badgeKey: vi.fn(),
  stats: vi.fn(),
  schedule: vi.fn(),
}
vi.mock('../courier-me.js', () => ({
  CourierMeService: vi.fn().mockImplementation(function () {
    return meSvc
  }),
}))
const opsSvc = vi.hoisted(() => ({ sendMessage: vi.fn(), report: vi.fn(), uploadReportPhoto: vi.fn(), suggestAccess: vi.fn(), hookOutcome: vi.fn() }))
vi.mock('../courier-ops.js', () => ({
  CourierOpsService: vi.fn().mockImplementation(function () {
    return opsSvc
  }),
  returnHookToQueue: vi.fn(),
}))
const earningsSvc = vi.hoisted(() => ({ earnings: vi.fn() }))
vi.mock('../courier-earnings.js', () => ({
  CourierEarningsService: vi.fn().mockImplementation(function () {
    return earningsSvc
  }),
}))
const shiftsSvc = vi.hoisted(() => ({ today: vi.fn(), accept: vi.fn(), decline: vi.fn() }))
vi.mock('../courier-shifts.js', () => ({
  CourierShiftService: vi.fn().mockImplementation(function () {
    return shiftsSvc
  }),
}))

import multipart from '@fastify/multipart'
import { courierRoute } from '../courier.route.js'

async function build() {
  const app = Fastify()
  app.decorate('prisma', {} as FastifyInstance['prisma'])
  app.decorateRequest('user', null)
  app.decorate('authenticate', async (request: { user: unknown }) => {
    request.user = { id: 'courier-01', role: 'COURIER' }
  })
  app.decorate('requireCourier', async () => {})
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } })
  await app.register(courierRoute)
  await app.ready()
  return app
}

let app: FastifyInstance | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
  vi.clearAllMocks()
})

describe('PATCH /courier/orders/:id/confirm', () => {
  it('200 devolve o resumo inteiro (inclusive os nulos) e repassa via/clientOpId', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/orders/o1/confirm', payload: { via: 'SCAN', clientOpId: 'op-12345678' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(summary)
    expect(service.confirmDelivery).toHaveBeenCalledWith('o1', 'courier-01', { via: 'SCAN', clientOpId: 'op-12345678' })
  })

  it('sem corpo (app antigo) continua funcionando', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/orders/o1/confirm' })
    expect(res.statusCode).toBe(200)
    expect(service.confirmDelivery).toHaveBeenCalledWith('o1', 'courier-01', {})
  })

  it('409 leva o resumo junto ("Já confirmada às HH:MM")', async () => {
    service.confirmDelivery.mockRejectedValueOnce({ statusCode: 409, message: 'Essa entrega já foi confirmada', summary })
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/orders/o1/confirm', payload: {} })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ error: 'Essa entrega já foi confirmada', summary })
  })

  it('via inválido → 400 sem chamar o service', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/orders/o1/confirm', payload: { via: 'TELEPATIA' } })
    expect(res.statusCode).toBe(400)
    expect(service.confirmDelivery).not.toHaveBeenCalled()
  })

  it('Cestinha: 200 com o resumo da parada só-Cestinha', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/market-orders/m1/confirm', payload: { via: 'CODE' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ kind: 'MARKET', orderId: null, apartment: '101' })
  })
})

describe('parada só de gancho', () => {
  it('confirmar: 200 com o resumo (kind HOOK e hookId vão no JSON)', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/hooks/h1/confirm', payload: { via: 'LIST', clientOpId: 'op-12345678' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ kind: 'HOOK', hookId: 'h1', orderId: null, quantity: 0 })
    expect(service.confirmHookStop).toHaveBeenCalledWith('h1', 'courier-01', { via: 'LIST', clientOpId: 'op-12345678' })
  })

  it('não entregue: repassa o motivo; 422 quando o cliente passou a ter pão no turno', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/hooks/h1/not-delivered', payload: { failureCode: 'CLIENTE_AUSENTE' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ kind: 'HOOK', status: 'NOT_DELIVERED' })
    expect(service.markHookNotDelivered).toHaveBeenCalledWith('h1', 'courier-01', expect.objectContaining({ failureCode: 'CLIENTE_AUSENTE' }))
    service.confirmHookStop.mockRejectedValueOnce({ statusCode: 422, message: 'O gancho vai junto com o pão desta parada' })
    const busy = await app.inject({ method: 'PATCH', url: '/courier/hooks/h1/confirm', payload: {} })
    expect(busy.statusCode).toBe(422)
    expect(busy.json().error).toBe('O gancho vai junto com o pão desta parada')
  })
})

describe('GET /courier/stops/lookup', () => {
  it('200 com as paradas encontradas', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/courier/stops/lookup?code=B9C0D1' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ matches: [{ kind: 'BREAD', id: 'o1', summary }] })
  })

  it('nenhuma parada → 404 com o texto da tela', async () => {
    service.lookupStopsByCode.mockResolvedValueOnce([])
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/courier/stops/lookup?code=123456' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Não achamos esse código na sua rota.')
  })

  it('formato inválido → 400', async () => {
    service.lookupStopsByCode.mockRejectedValueOnce({ statusCode: 400, message: 'Código inválido. Ele fica embaixo do QR do cupom.' })
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/courier/stops/lookup?code=XX' })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /courier/orders/:id/not-delivered', () => {
  it('200 com o resumo; repassa o motivo padronizado', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/orders/o1/not-delivered', payload: { failureCode: 'CLIENTE_AUSENTE', via: 'LIST' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('NOT_DELIVERED')
    expect(service.markNotDelivered).toHaveBeenCalledWith('o1', 'courier-01', { failureCode: 'CLIENTE_AUSENTE', via: 'LIST' })
  })

  it('"Outro" sem texto → 400 "Escreva o motivo para seguir"', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/orders/o1/not-delivered', payload: { failureCode: 'OUTRO' } })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Escreva o motivo para seguir')
    expect(service.markNotDelivered).not.toHaveBeenCalled()
  })

  it('app antigo (só reason) continua aceito', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/courier/orders/o1/not-delivered', payload: { reason: 'Cliente ausente' } })
    expect(res.statusCode).toBe(200)
  })
})

function multipartBody(boundary: string, contentType = 'image/jpeg') {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="foto.jpg"\r\nContent-Type: ${contentType}\r\n\r\n`),
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
}

describe('POST /courier/stops/:key/proof', () => {
  // O `clientOpId` da query continua aceito (o app manda), mas não chega ao service: a foto é
  // idempotente por substituição e não pode trocar o id da operação do desfecho (Onda 4).
  it('201 com o estado do comprovante; repassa arquivo e desfecho (clientOpId aceito e ignorado)', async () => {
    app = await build()
    const boundary = 'cdpboundary'
    const res = await app.inject({
      method: 'POST',
      url: '/courier/stops/o1/proof?outcome=DELIVERED&clientOpId=op-12345678',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(boundary),
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual(proofView)
    const [courierId, key, outcome, file, ...rest] = service.uploadProof.mock.calls[0]
    expect([courierId, key, outcome]).toEqual(['courier-01', 'o1', 'DELIVERED'])
    expect(rest).toEqual([])
    expect(file.mimetype).toBe('image/jpeg')
    expect(file.body.length).toBe(4)
  })

  it('desfecho inválido → 400', async () => {
    app = await build()
    const boundary = 'cdpboundary'
    const res = await app.inject({
      method: 'POST',
      url: '/courier/stops/o1/proof?outcome=TALVEZ',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(boundary),
    })
    expect(res.statusCode).toBe(400)
  })

  it('503 do armazenamento chega ao app', async () => {
    service.uploadProof.mockRejectedValueOnce({ statusCode: 503, message: 'Armazenamento de fotos indisponível.' })
    app = await build()
    const boundary = 'cdpboundary'
    const res = await app.inject({
      method: 'POST',
      url: '/courier/stops/o1/proof?outcome=DELIVERED',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(boundary),
    })
    expect(res.statusCode).toBe(503)
  })
})

describe('POST /courier/stops/:key/proof/skip', () => {
  it('exceção com motivo → 200', async () => {
    app = await build()
    const res = await app.inject({ method: 'POST', url: '/courier/stops/o1/proof/skip', payload: { outcome: 'DELIVERED', mode: 'NONE', reasonCode: 'SEM_LUZ' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().note).toBe('Local sem luz')
  })

  it('NONE sem motivo → 400', async () => {
    app = await build()
    const res = await app.inject({ method: 'POST', url: '/courier/stops/o1/proof/skip', payload: { outcome: 'DELIVERED', mode: 'NONE' } })
    expect(res.statusCode).toBe(400)
  })

  it('422 (pular sendo obrigado) chega ao app', async () => {
    service.skipProof.mockRejectedValueOnce({ statusCode: 422, message: 'A foto é obrigatória para você.' })
    app = await build()
    const res = await app.inject({ method: 'POST', url: '/courier/stops/o1/proof/skip', payload: { outcome: 'DELIVERED', mode: 'SKIPPED' } })
    expect(res.statusCode).toBe(422)
  })
})

// ── Rota do dia (Onda 5) ───────────────────────────────────────────────────────
describe('rotas do dia', () => {
  let app: FastifyInstance
  afterEach(async () => app?.close())
  const run = {
    id: 'run-1',
    slotId: 'manha',
    status: 'STARTED',
    condominiumIds: ['c1', 'c2'],
    reordered: false,
    startedAt: new Date('2026-10-02T08:12:00.000Z'),
    endedAt: null,
    startMode: 'BASE',
    plannedKm: 9.6,
    plannedMin: 70,
    lastLat: -23.5,
  }

  it('iniciar: 200 com a rota (datas em ISO) e quantos clientes foram avisados; sem posição na resposta', async () => {
    app = await build()
    runs.start.mockResolvedValueOnce({ run, notified: 11 })
    const res = await app.inject({ method: 'POST', url: '/courier/runs/start', payload: { slotId: 'manha', startMode: 'BASE' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      run: { id: 'run-1', slotId: 'manha', status: 'STARTED', condominiumIds: ['c1', 'c2'], reordered: false, startedAt: '2026-10-02T08:12:00.000Z', endedAt: null, startMode: 'BASE', plannedKm: 9.6, plannedMin: 70 },
      notified: 11,
    })
    expect(runs.start).toHaveBeenCalledWith('courier-01', { slotId: 'manha', startMode: 'BASE' })
  })

  it('iniciar com modo inválido → 400; encerrada → 409', async () => {
    app = await build()
    expect((await app.inject({ method: 'POST', url: '/courier/runs/start', payload: { slotId: 'manha', startMode: 'AUTO' } })).statusCode).toBe(400)
    runs.start.mockRejectedValueOnce({ statusCode: 409, message: 'Essa rota já foi encerrada' })
    const res = await app.inject({ method: 'POST', url: '/courier/runs/start', payload: { slotId: 'manha', startMode: 'BASE' } })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('Essa rota já foi encerrada')
  })

  it('posição → 204; fora da faixa → 400', async () => {
    app = await build()
    expect((await app.inject({ method: 'POST', url: '/courier/runs/66f1a2b3c4d5e6f7a8b9c0d1/position', payload: { lat: -23.5, lng: -46.6 } })).statusCode).toBe(204)
    expect((await app.inject({ method: 'POST', url: '/courier/runs/66f1a2b3c4d5e6f7a8b9c0d1/position', payload: { lat: 123, lng: 0 } })).statusCode).toBe(400)
  })

  it('reordenar sem permissão → 403 com a mensagem', async () => {
    app = await build()
    runs.reorder.mockRejectedValueOnce({ statusCode: 403, message: 'A operação não liberou reordenar a sua rota' })
    const res = await app.inject({ method: 'PUT', url: '/courier/runs/order', payload: { slotId: 'manha', condominiumIds: ['66f1a2b3c4d5e6f7a8b9c0d1'] } })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('não liberou')
  })

  it('encerrar com pendências → 422 com a lista', async () => {
    app = await build()
    const pending = { stops: [{ key: 'u1|manha', condominiumName: 'Aurora', clientName: 'Ana', apartment: '63', block: null }], noPhoto: [] }
    runs.end.mockRejectedValueOnce({ statusCode: 422, message: 'Resolva as pendências antes de encerrar', pending })
    const res = await app.inject({ method: 'POST', url: '/courier/runs/66f1a2b3c4d5e6f7a8b9c0d1/end' })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toEqual({ error: 'Resolva as pendências antes de encerrar', pending })
  })
})

describe('pessoas (Onda 6)', () => {
  let app: FastifyInstance
  afterEach(async () => app?.close())

  it('/courier/me serializa crachá, veículo, hoje e a próxima folga', async () => {
    app = await build()
    const me = {
      name: 'Antônio Ribeiro',
      firstName: 'Antônio',
      phone: null,
      since: '2026-03-10T12:00:00.000Z',
      photoUrl: null,
      cpfMasked: '***.456.789-**',
      vehicle: { tipo: 'MOTO', modelo: 'CG 160', placa: 'ABC1D23', combustivel: 'GASOLINA', kmPorLitro: 38 },
      rules: { fotoEntrega: true, fotoNaoEntrega: true, podeReordenar: false, podeRecados: false },
      badge: { number: '0427', validUntil: '2026-12-31', active: true, reason: 'ATIVO' },
      today: { slots: [{ slotId: 'manha', label: 'Manhã', emoji: '☀️' }], condos: ['Residencial Jardins'] },
      deliveries30: 312,
      scheduleLabel: 'Seg a sáb',
      nextTimeOff: { startDate: '2026-10-12', endDate: '2026-10-13' },
      showFuel: true,
    }
    meSvc.me.mockResolvedValueOnce(me)
    const res = await app.inject({ method: 'GET', url: '/courier/me' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(me)
  })

  it('/courier/stats repassa 7 dias; qualquer outro vira 30', async () => {
    app = await build()
    meSvc.stats.mockResolvedValue({ days: 7, deliveries: 0, failed: 0, successRate: null, breads: 0, avgRouteMin: null, perDay: [], recent: [] })
    await app.inject({ method: 'GET', url: '/courier/stats?days=7' })
    expect(meSvc.stats).toHaveBeenLastCalledWith('courier-01', 7)
    await app.inject({ method: 'GET', url: '/courier/stats' })
    expect(meSvc.stats).toHaveBeenLastCalledWith('courier-01', 30)
  })
})

describe('termo e turnos (plano-termos-legais)', () => {
  let app: FastifyInstance
  afterEach(async () => app?.close())

  it('/courier/shifts serializa os turnos; recusar repassa o motivo e o 409 leva o code', async () => {
    app = await build()
    shiftsSvc.today.mockResolvedValueOnce([{ id: 'o1', slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', status: 'OFFERED', stops: 18, offeredAt: '2026-10-02T08:00:00.000Z' }])
    expect((await app.inject({ method: 'GET', url: '/courier/shifts' })).json()).toEqual([{ id: 'o1', slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', status: 'OFFERED', stops: 18, offeredAt: '2026-10-02T08:00:00.000Z' }])
    const id = '66f1a2b3c4d5e6f7a8b9c0d1'
    shiftsSvc.decline.mockResolvedValueOnce({ id, status: 'DECLINED', released: 19 })
    const ok = await app.inject({ method: 'POST', url: `/courier/shifts/${id}/decline`, payload: { reason: 'SAUDE' } })
    expect(ok.json()).toEqual({ id, status: 'DECLINED', released: 19 })
    expect(shiftsSvc.decline).toHaveBeenCalledWith('courier-01', id, 'SAUDE')
    shiftsSvc.decline.mockRejectedValueOnce({ statusCode: 409, code: 'STARTED', message: 'A rota já começou. Para sair dela, fale com a operação.' })
    const late = await app.inject({ method: 'POST', url: `/courier/shifts/${id}/decline`, payload: {} })
    expect(late.statusCode).toBe(409)
    expect(late.json()).toEqual({ error: 'A rota já começou. Para sair dela, fale com a operação.', code: 'STARTED' })
    expect((await app.inject({ method: 'POST', url: `/courier/shifts/${id}/decline`, payload: { reason: 'PREGUICA' } })).statusCode).toBe(400)
    shiftsSvc.accept.mockResolvedValueOnce({ id, status: 'ACCEPTED' })
    expect((await app.inject({ method: 'POST', url: `/courier/shifts/${id}/accept` })).json()).toEqual({ id, status: 'ACCEPTED' })
  })

  it('/courier/terms/accept grava com IP e aparelho e devolve a versão', async () => {
    app = await build()
    meSvc.acceptTerms.mockResolvedValueOnce({ version: '1.0', acceptedAt: '2026-10-05T09:00:00.000Z' })
    const res = await app.inject({ method: 'POST', url: '/courier/terms/accept', payload: { version: '1.0' }, headers: { 'user-agent': 'Teste/1.0', 'x-device-id': 'dev-1' } })
    expect(res.json()).toEqual({ version: '1.0', acceptedAt: '2026-10-05T09:00:00.000Z' })
    expect(meSvc.acceptTerms).toHaveBeenCalledWith('courier-01', '1.0', expect.objectContaining({ userAgent: 'Teste/1.0', deviceId: 'dev-1', ip: expect.any(String) }))
  })
})

describe('crachá v3 (Onda 11)', () => {
  let app: FastifyInstance
  afterEach(async () => app?.close())

  it('/courier/badge-key devolve o segredo e a hora do servidor, sem cache', async () => {
    app = await build()
    meSvc.badgeKey.mockResolvedValueOnce({ secret: 'abc123', serverTime: '2026-10-05T09:00:00.000Z' })
    const res = await app.inject({ method: 'GET', url: '/courier/badge-key' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.json()).toEqual({ secret: 'abc123', serverTime: '2026-10-05T09:00:00.000Z' })
    expect(meSvc.badgeKey).toHaveBeenCalledWith('courier-01')
  })

  it('crachá inativo: secret null serializado', async () => {
    app = await build()
    meSvc.badgeKey.mockResolvedValueOnce({ secret: null, serverTime: '2026-10-05T09:00:00.000Z' })
    expect((await app.inject({ method: 'GET', url: '/courier/badge-key' })).json()).toEqual({ secret: null, serverTime: '2026-10-05T09:00:00.000Z' })
  })
})

describe('o que o entregador vê de km e combustível (Onda 10)', () => {
  let app: FastifyInstance
  afterEach(async () => app?.close())

  it('/courier/stats serializa fuelVisible e, ligado, km e fuel', async () => {
    app = await build()
    meSvc.stats.mockResolvedValueOnce({ days: 30, deliveries: 1, failed: 0, successRate: 1, breads: 4, avgRouteMin: 50, fuelVisible: true, km: 15.8, fuel: 1.54, perDay: [], recent: [] })
    expect((await app.inject({ method: 'GET', url: '/courier/stats' })).json()).toMatchObject({ fuelVisible: true, km: 15.8, fuel: 1.54 })
  })

  it('resumo da rota com o switch desligado: km, fuel e fuelReason vão null, o resto fica', async () => {
    app = await build()
    runs.summary.mockResolvedValueOnce({
      slotId: 'manha',
      label: 'Manhã',
      emoji: '☀️',
      time: '06:30',
      run: null,
      pending: { stops: [], noPhoto: [] },
      stats: { delivered: 3, notDelivered: 0, breads: 12, cestinhas: 0, ganchos: 0, durationMin: 72 },
      km: 9.6,
      voltaBase: true,
      fuel: { litros: 0.25, custo: 1.54, kmPorLitro: 38, preco: 6.09, combustivel: 'GASOLINA' },
      fuelReason: null,
      fuelVisible: false,
      next: null,
    })
    const body = (await app.inject({ method: 'GET', url: '/courier/runs/manha/summary' })).json()
    expect(body).toMatchObject({ fuelVisible: false, km: null, fuel: null, fuelReason: null, stats: { delivered: 3, durationMin: 72 } })
  })
})

describe('ganhos (Onda 7)', () => {
  let app: FastifyInstance
  afterEach(async () => app?.close())

  it('/courier/earnings serializa a semana estimada e o extrato', async () => {
    app = await build()
    const body = {
      pay: { modalidade: 'PER_DELIVERY', valor: 1.5, pagaCombustivel: true },
      fuelDetailVisible: true,
      current: {
        weekStart: '2026-09-28',
        weekEnd: '2026-10-04',
        entregas: 142,
        rotas: 8,
        units: 142,
        remuneration: 213,
        km: 49.3,
        fuel: 7.9,
        fuelBasis: { kmPorLitro: 38, preco: 6.09, combustivel: 'GASOLINA', reason: null },
        total: 220.9,
        openRuns: 0,
      },
      extrato: [{ weekStart: '2026-09-21', weekEnd: '2026-09-27', status: 'PAGO', remuneration: 312, fuel: 8, estimated: 323.4, final: 320, paidAt: '2026-09-29', dueDate: null }],
    }
    earningsSvc.earnings.mockResolvedValueOnce(body)
    const res = await app.inject({ method: 'GET', url: '/courier/earnings' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(body)
    expect(earningsSvc.earnings).toHaveBeenCalledWith('courier-01')
  })
})

describe('operação (Onda 8)', () => {
  let app: FastifyInstance
  afterEach(async () => app?.close())
  const oid = '66f1a2b3c4d5e6f7a8b9c0d1'

  it('recado: 409 leva o código (OPT_OUT) para a tela; modelo fora da lista → 400', async () => {
    app = await build()
    opsSvc.sendMessage.mockRejectedValueOnce({ statusCode: 409, code: 'OPT_OUT', message: 'O cliente desligou os recados do entregador.' })
    const res = await app.inject({ method: 'POST', url: '/courier/messages', payload: { stopKey: oid, template: 'NA_PORTARIA' } })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ error: 'O cliente desligou os recados do entregador.', code: 'OPT_OUT' })
    expect(opsSvc.sendMessage).toHaveBeenCalledWith('courier-01', { stopKey: oid, template: 'NA_PORTARIA' })
    expect((await app.inject({ method: 'POST', url: '/courier/messages', payload: { stopKey: oid, template: 'QUALQUER' } })).statusCode).toBe(400)
  })

  it('reportar: 201; ocorrência sem stopKey; desfecho do gancho', async () => {
    app = await build()
    opsSvc.report.mockResolvedValue({ id: 'r1', createdAt: '2026-10-02T09:00:00.000Z' })
    const r = await app.inject({ method: 'POST', url: '/courier/reports', payload: { kind: 'INCIDENT', type: 'VEICULO', text: 'Pneu furou', clientOpId: 'op-12345678' } })
    expect(r.statusCode).toBe(201)
    expect(opsSvc.report).toHaveBeenCalledWith('courier-01', { kind: 'INCIDENT', type: 'VEICULO', text: 'Pneu furou', clientOpId: 'op-12345678' })
    expect((await app.inject({ method: 'POST', url: '/courier/reports', payload: { kind: 'STOP_ISSUE', type: 'APTO_ERRADO' } })).statusCode).toBe(400)
    opsSvc.hookOutcome.mockResolvedValue({ status: 'QUEUE' })
    const h = await app.inject({ method: 'POST', url: `/courier/hooks/${oid}/outcome`, payload: { delivered: false } })
    expect(h.json()).toEqual({ status: 'QUEUE' })
    expect(opsSvc.hookOutcome).toHaveBeenCalledWith('courier-01', oid, false)
  })
})
