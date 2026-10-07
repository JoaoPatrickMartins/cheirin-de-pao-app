// Textos legais × o que o app faz (plano-app-entregador.md, Onda 9): a foto da entrega e a da
// ocorrência valem PROOF_RETENTION_DAYS, a localização do entregador é só durante a rota e os
// recados têm opt-out. Se a regra mudar no código, este teste lembra de mudar o texto.
import { describe, it, expect } from 'vitest'
import { PROOF_RETENTION_DAYS } from '@cheirin-de-pao/shared'
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from '../legal'

const section = (title: string) => PRIVACY_SECTIONS.find((s) => s.title === title)?.paragraphs.join(' ') ?? ''

describe('textos legais do app do entregador', () => {
  it('foto da entrega: privada e apagada no prazo de retenção do app', () => {
    const text = section('Foto da entrega')
    expect(text).toContain('privada')
    expect(text).toContain(`${PROOF_RETENTION_DAYS} dias`)
    expect(section('Por quanto tempo')).toContain(`${PROOF_RETENTION_DAYS} dias`)
  })

  it('recados: modelos prontos, sem telefone e com o caminho para desligar', () => {
    const text = section('Recados do entregador')
    expect(text).toContain('não vê o seu telefone')
    expect(text).toContain('Perfil › Notificações › Recados do entregador')
  })

  it('entregador: localização só durante a rota, só a última posição, apagada ao encerrar', () => {
    const text = section('Se você é entregador')
    expect(text).toContain('"Iniciar rota"')
    expect(text).toContain('só a última posição')
    expect(text).toContain('apagamos quando a rota termina')
    expect(text).toContain(`${PROOF_RETENTION_DAYS} dias`)
  })

  it('termos citam a foto da entrega', () => {
    expect(TERMS_SECTIONS.flatMap((s) => s.paragraphs).some((p) => p.includes('fotografar o pedido'))).toBe(true)
  })
})
