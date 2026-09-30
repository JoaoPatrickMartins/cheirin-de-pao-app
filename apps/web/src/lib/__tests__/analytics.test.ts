// Funil do Indique e Ganhe (V-21): o acesso pelo link manda o `ref` junto; sem link, nada muda.
import { vi, describe, it, expect, beforeEach } from 'vitest'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../apiFetch', () => ({ apiFetch: api.fetch }))

import { trackAccess } from '../analytics'

const body = () => JSON.parse(api.fetch.mock.calls[0][1].body)

beforeEach(() => {
  vi.clearAllMocks()
  api.fetch.mockResolvedValue({ ok: true })
})

describe('trackAccess', () => {
  it('com o código da carga, o evento leva o ref', () => {
    trackAccess('JOAO7K2F')
    expect(api.fetch.mock.calls[0][0]).toBe('/analytics/event')
    expect(body()).toMatchObject({ type: 'access', ref: 'JOAO7K2F' })
  })

  it('sem código, o evento é o de sempre (sem a chave ref)', () => {
    trackAccess(null)
    expect(body()).not.toHaveProperty('ref')
    expect(body().type).toBe('access')
  })
})
