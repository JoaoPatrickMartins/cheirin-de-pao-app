// A5 com a rota padrão (plano-rota-padrao): o GET traz o resumo do card; o PATCH recalcula o km
// guardado da rota padrão só quando a base ou a volta mudam.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const routeConfig = vi.hoisted(() => ({ getRouteConfig: vi.fn(), setRouteConfig: vi.fn() }))
vi.mock('../../../lib/route-config.js', () => routeConfig)
const defaultRoute = vi.hoisted(() => ({ defaultRouteSummary: vi.fn(), refreshDefaultRouteMetrics: vi.fn() }))
vi.mock('../../../lib/default-route.js', () => defaultRoute)

import { AdminSettingsService } from '../admin-settings.service.js'

const cfg = {
  base: { endereco: 'Padaria', lat: -23.5, lng: -46.6 },
  voltaBase: true,
  minPorPorta: 1,
  precoGasolina: 6.09,
  precoEtanol: null,
  precoGnv: null,
  precoAtualizadoEm: null,
  fotoClienteVisivel: true,
  entregadorVeCombNumeros: false,
  entregadorVeCombFimRota: false,
  entregadorVeCombGanhos: false,
}
const summary = { count: 3, km: 7.4, durationMin: 31, savedAt: '2026-10-06T12:00:00.000Z', toReview: 0, outside: 0 }
const service = () => new AdminSettingsService({ prisma: {}, log: { warn: vi.fn() } } as never)
const { precoAtualizadoEm: _p, ...body } = cfg

beforeEach(() => {
  vi.clearAllMocks()
  routeConfig.getRouteConfig.mockResolvedValue(cfg)
  defaultRoute.defaultRouteSummary.mockResolvedValue(summary)
})

describe('A5 · rota padrão', () => {
  it('GET traz o resumo do card', async () => {
    expect(await service().getRouteSettings()).toMatchObject({ voltaBase: true, rotaPadrao: summary })
  })

  it('PATCH sem mudar base nem volta: não recalcula', async () => {
    routeConfig.setRouteConfig.mockResolvedValue({ ...cfg, precoGasolina: 6.29 })
    await service().setRouteSettings({ ...body, precoGasolina: 6.29 } as never)
    expect(defaultRoute.refreshDefaultRouteMetrics).not.toHaveBeenCalled()
  })

  it('PATCH mudando a base ou a volta: recalcula e devolve o resumo novo', async () => {
    routeConfig.setRouteConfig.mockResolvedValue({ ...cfg, base: { endereco: 'Outra', lat: -23.6, lng: -46.7 } })
    const res = await service().setRouteSettings(body as never)
    expect(defaultRoute.refreshDefaultRouteMetrics).toHaveBeenCalledTimes(1)
    expect(res.rotaPadrao).toEqual(summary)

    routeConfig.setRouteConfig.mockResolvedValue({ ...cfg, voltaBase: false })
    await service().setRouteSettings({ ...body, voltaBase: false } as never)
    expect(defaultRoute.refreshDefaultRouteMetrics).toHaveBeenCalledTimes(2)
  })
})
