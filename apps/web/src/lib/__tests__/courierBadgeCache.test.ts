// Crachá v3 guardado no aparelho (Onda 11 · T-27): junta perfil e segredo, por entregador; Sair apaga.
import { describe, it, expect, beforeEach } from 'vitest'
import { clearBadgeCache, loadBadgeCache, saveBadgeCache } from '../courierBadgeCache'

beforeEach(() => localStorage.clear())

describe('courierBadgeCache', () => {
  it('perfil e segredo chegam separados e ficam juntos; cada entregador tem o seu', () => {
    const now = new Date('2026-10-05T09:00:00.000Z')
    saveBadgeCache('k1', { me: { name: 'Antônio' } as never }, now)
    saveBadgeCache('k1', { secret: 's1', offsetMs: 1500 }, now)
    expect(loadBadgeCache('k1')).toEqual({ me: { name: 'Antônio' }, secret: 's1', offsetMs: 1500, savedAt: now.toISOString() })
    expect(loadBadgeCache('k2')).toBeNull()
    expect(loadBadgeCache(null)).toBeNull()
  })

  it('crachá inativo grava secret null (o app para de gerar o QR)', () => {
    saveBadgeCache('k1', { secret: 's1' })
    saveBadgeCache('k1', { secret: null })
    expect(loadBadgeCache('k1')?.secret).toBeNull()
  })

  it('Sair apaga o crachá de todos e não mexe no resto', () => {
    localStorage.setItem('device_id', 'abc')
    saveBadgeCache('k1', { secret: 's1' })
    saveBadgeCache('k2', { secret: 's2' })
    clearBadgeCache()
    expect([loadBadgeCache('k1'), loadBadgeCache('k2')]).toEqual([null, null])
    expect(localStorage.getItem('device_id')).toBe('abc')
  })
})
