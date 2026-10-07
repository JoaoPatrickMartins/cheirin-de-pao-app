// Documentos com aceite (plano-termos-legais §6): versão vigente e quem precisa aceitar de novo.
import { describe, it, expect } from 'vitest'
import { LEGAL_DOCS, isLegalDoc, needsLegalAcceptance } from '../legal'
import { SHIFT_DECLINE_REASONS, shiftDeclineLabel } from '../courier'

describe('documentos legais', () => {
  it('nunca aceitou ou aceitou outra versão → precisa aceitar; a vigente → não', () => {
    const v = LEGAL_DOCS.COURIER_TERMS.version
    expect(needsLegalAcceptance('COURIER_TERMS', null)).toBe(true)
    expect(needsLegalAcceptance('COURIER_TERMS', '0.9')).toBe(true)
    expect(needsLegalAcceptance('COURIER_TERMS', v)).toBe(false)
    expect([isLegalDoc('COURIER_TERMS'), isLegalDoc('QUALQUER')]).toEqual([true, false])
  })

  it('motivos da recusa do turno: rótulos e chave desconhecida → null', () => {
    expect(SHIFT_DECLINE_REASONS.map((r) => r.key)).toEqual(['IMPREVISTO', 'VEICULO', 'SAUDE', 'OUTRO'])
    expect(shiftDeclineLabel('SAUDE')).toBe('Saúde')
    expect(shiftDeclineLabel(null)).toBeNull()
  })
})
