import { describe, it, expect, vi } from 'vitest'

// Mock do OneSignal — importar schedules.service executa os imports de topo do módulo.
vi.mock('@onesignal/node-onesignal', () => ({
  createConfiguration: vi.fn().mockReturnValue({}),
  DefaultApi: vi.fn().mockImplementation(function () {
    return { createNotification: vi.fn().mockResolvedValue({}) }
  }),
  Notification: vi.fn().mockImplementation(function () {
    return {}
  }),
}))

import { findAgendaBlockedError, countDeliveriesPerWeekday } from '../schedules.service.js'

const NENHUM_BLOQUEADO = { seg: false, ter: false, qua: false, qui: false, sex: false, sab: false, dom: false }
const zeros = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }

describe('findAgendaBlockedError', () => {
  it('null quando nenhum dia com qty > 0 está bloqueado', () => {
    const data = { days: { manha: { ...zeros, seg: 2, ter: 3 } } }
    expect(findAgendaBlockedError(data, NENHUM_BLOQUEADO)).toBeNull()
  })

  it('erro listando os dias bloqueados com qty > 0 (multi-slot)', () => {
    const blocked = { ...NENHUM_BLOQUEADO, ter: true, qua: true }
    const data = { days: { manha: { ...zeros, seg: 2, ter: 1 }, tarde: { ...zeros, qua: 4 } } }
    const err = findAgendaBlockedError(data, blocked)
    expect(err).toContain('Ter')
    expect(err).toContain('Qua')
    expect(err).not.toContain('Seg')
  })

  it('qty 0 em dia bloqueado é permitido (folga)', () => {
    const blocked = { ...NENHUM_BLOQUEADO, ter: true }
    const data = { weeklyQty: { ...zeros, ter: 0, seg: 2 } }
    expect(findAgendaBlockedError(data, blocked)).toBeNull()
  })

  it('cobre o modo legado (weeklyQty)', () => {
    const blocked = { ...NENHUM_BLOQUEADO, sex: true }
    const data = { weeklyQty: { ...zeros, sex: 3 } }
    expect(findAgendaBlockedError(data, blocked)).toContain('Sex')
  })
})

describe('countDeliveriesPerWeekday', () => {
  it('conta 1 entrega por slot com qty > 0 no dia (multi-slot)', () => {
    const data = { days: { manha: { ...zeros, seg: 2, ter: 1 }, tarde: { ...zeros, seg: 4 } } }
    const r = countDeliveriesPerWeekday(data)
    expect(r.seg).toBe(2) // manhã + tarde
    expect(r.ter).toBe(1) // só manhã
    expect(r.qua).toBe(0)
  })

  it('modo legado conta 1 por dia com weeklyQty > 0', () => {
    const data = { weeklyQty: { ...zeros, seg: 5, dom: 1 } }
    const r = countDeliveriesPerWeekday(data)
    expect(r.seg).toBe(1)
    expect(r.dom).toBe(1)
    expect(r.ter).toBe(0)
  })
})
