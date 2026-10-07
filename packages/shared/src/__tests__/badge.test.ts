// Crachá v3 (Onda 11 · T-25): janela de 30 s, QR e código do HMAC. Os valores esperados foram
// calculados por outra implementação (Python: hmac + base64.b32encode), não por esta.
import { describe, it, expect } from 'vitest'
import { BADGE_CODE_ALPHABET, badgeCryptoAvailable, badgeToken, badgeWindow } from '../badge'

const SECRET = 'segredo-de-teste-123'
const COURIER = '66f1a2b3c4d5e6f7a8b9c0d1'

describe('crachá · janela de 30 s', () => {
  it('janela = floor(unix / 30) e os segundos que faltam (1..30)', () => {
    expect(badgeWindow(1_780_370_340_000)).toEqual({ window: 59_345_678, secondsLeft: 30 })
    expect(badgeWindow(1_780_370_369_999)).toEqual({ window: 59_345_678, secondsLeft: 1 })
    expect(badgeWindow(1_780_370_370_000)).toEqual({ window: 59_345_679, secondsLeft: 30 })
  })
})

describe('crachá · QR e código', () => {
  it('confere com a referência: tag base32 de 10 e código de 4 sem caracteres ambíguos', async () => {
    expect(badgeCryptoAvailable()).toBe(true)
    expect(await badgeToken(SECRET, COURIER, 59_345_678)).toEqual({ payload: `cdp:b1:${COURIER}:59345678:WNCBRXHJKQ`, tag: 'WNCBRXHJKQ', code: 'SYUU' })
    expect(await badgeToken(SECRET, COURIER, 59_345_679)).toMatchObject({ tag: '5IRH2IKBQ3', code: 'GN5N' })
  })

  it('outro entregador ou outro segredo dá outro código', async () => {
    const a = await badgeToken(SECRET, COURIER, 59_345_678)
    expect((await badgeToken(SECRET, '66f1a2b3c4d5e6f7a8b9c0d2', 59_345_678))?.tag).not.toBe(a?.tag)
    expect((await badgeToken('outro-segredo', COURIER, 59_345_678))?.tag).not.toBe(a?.tag)
  })

  it('o alfabeto do código não tem 0/O/1/I/L; sem segredo não gera', async () => {
    expect(BADGE_CODE_ALPHABET).not.toMatch(/[01OIL]/)
    for (let w = 0; w < 40; w++) expect((await badgeToken(SECRET, COURIER, w))!.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
    expect(await badgeToken('', COURIER, 1)).toBeNull()
  })
})
