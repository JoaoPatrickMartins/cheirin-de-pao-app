import { isValidBrMobile } from '../schemas'

describe('isValidBrMobile', () => {
  it('accepts a valid BR mobile with mask', () => {
    expect(isValidBrMobile('(11) 99000-1234')).toBe(true)
  })

  it('accepts a valid BR mobile as raw digits', () => {
    expect(isValidBrMobile('11990001234')).toBe(true)
  })

  it('strips the optional 55 country code prefix (13 digits)', () => {
    expect(isValidBrMobile('5511990001234')).toBe(true)
    expect(isValidBrMobile('+55 (11) 99000-1234')).toBe(true)
  })

  it('preserves DDD 55 mobiles (11 digits — não confunde com código do país)', () => {
    expect(isValidBrMobile('55999001234')).toBe(true)
  })

  it('rejects incomplete numbers', () => {
    expect(isValidBrMobile('(11) 9')).toBe(false)
    expect(isValidBrMobile('1199001234')).toBe(false) // 10 dígitos (fixo)
  })

  it('rejects an invalid DDD', () => {
    expect(isValidBrMobile('10990001234')).toBe(false)
    expect(isValidBrMobile('20990001234')).toBe(false)
  })

  it('rejects mobiles without the leading 9', () => {
    expect(isValidBrMobile('11890001234')).toBe(false)
  })

  it('rejects all-same-digit numbers', () => {
    expect(isValidBrMobile('99999999999')).toBe(false)
  })

  it('rejects empty input', () => {
    expect(isValidBrMobile('')).toBe(false)
  })
})
