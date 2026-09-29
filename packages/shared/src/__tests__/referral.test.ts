import { describe, it, expect } from 'vitest'
import {
  DEFAULT_REFERRAL_MESSAGE,
  REFERRAL_CODE_ALPHABET,
  ReferralCampaignSchema,
  ReferralGoalsSchema,
  breadsLabel,
  normalizeReferralCode,
  referralMessageBonusWarning,
  referralMessageHasCodeOrLink,
  renderReferralMessage,
  splitReferralCode,
} from '../referral'

const vars = { code: 'JOAO7K2F', link: 'https://app.cheirindepao.com.br/?ref=JOAO7K2F', name: 'João', welcomeBreads: 3 }

describe('normalizeReferralCode', () => {
  it('maiúsculas, sem espaços e sem hífens', () => {
    expect(normalizeReferralCode(' joao 7k2f ')).toBe('JOAO7K2F')
    expect(normalizeReferralCode('JOAO-7K2F')).toBe('JOAO7K2F')
    expect(normalizeReferralCode('Joao\t7K2F')).toBe('JOAO7K2F')
  })

  it('vazio/nulo vira string vazia', () => {
    expect(normalizeReferralCode(null)).toBe('')
    expect(normalizeReferralCode(undefined)).toBe('')
  })
})

describe('REFERRAL_CODE_ALPHABET', () => {
  it('não tem os caracteres ambíguos 0/O/1/I/L', () => {
    for (const c of ['0', 'O', '1', 'I', 'L']) expect(REFERRAL_CODE_ALPHABET).not.toContain(c)
    expect(REFERRAL_CODE_ALPHABET).toHaveLength(31)
  })
})

describe('splitReferralCode', () => {
  it('separa o sufixo de 4 caracteres (os 2 grupos da tela)', () => {
    expect(splitReferralCode('JOAO7K2F')).toEqual({ prefix: 'JOAO', suffix: '7K2F' })
    expect(splitReferralCode('LI7K2F')).toEqual({ prefix: 'LI', suffix: '7K2F' })
  })

  it('código curto demais fica todo no sufixo', () => {
    expect(splitReferralCode('7K2')).toEqual({ prefix: '', suffix: '7K2' })
  })
})

describe('renderReferralMessage (= refMsg do handoff)', () => {
  it('substitui as quatro variáveis na mensagem padrão', () => {
    expect(renderReferralMessage(DEFAULT_REFERRAL_MESSAGE, vars)).toBe(
      'Oi! Recebo pão fresquinho na porta com o Cheirin de Pão 🥖 Cadastra com o meu código JOAO7K2F ' +
        'e ganha 3 pãezins no primeiro pedido: https://app.cheirindepao.com.br/?ref=JOAO7K2F',
    )
  })

  it('sem bônus do amigo (Y = 0) remove o trecho do bônus da mensagem padrão', () => {
    expect(renderReferralMessage(DEFAULT_REFERRAL_MESSAGE, { ...vars, welcomeBreads: 0 })).toBe(
      'Oi! Recebo pão fresquinho na porta com o Cheirin de Pão 🥖 Cadastra com o meu código JOAO7K2F: ' +
        'https://app.cheirindepao.com.br/?ref=JOAO7K2F',
    )
  })

  it('mensagem personalizada: substitui todas as ocorrências, inclusive {nome}', () => {
    const msg = renderReferralMessage('{nome} te indicou! Use {codigo} ou {codigo} em {link}', vars)
    expect(msg).toBe('João te indicou! Use JOAO7K2F ou JOAO7K2F em https://app.cheirindepao.com.br/?ref=JOAO7K2F')
  })

  it('mensagem personalizada com {bonus} e Y = 0 mostra o 0 (é o caso do aviso bonusWarn)', () => {
    expect(renderReferralMessage('Ganhe {bonus} com {codigo}', { ...vars, welcomeBreads: 0 })).toBe(
      'Ganhe 0 com JOAO7K2F',
    )
  })

  it('não interpreta padrões especiais do replace ($&) no nome', () => {
    expect(renderReferralMessage('Oi, {nome}! {codigo}', { ...vars, name: 'A$&B' })).toBe('Oi, A$&B! JOAO7K2F')
  })
})

describe('validações da mensagem', () => {
  it('precisa de {codigo} ou {link}', () => {
    expect(referralMessageHasCodeOrLink('Use {codigo}')).toBe(true)
    expect(referralMessageHasCodeOrLink('Entre em {link}')).toBe(true)
    expect(referralMessageHasCodeOrLink('Oi {nome}, ganhe {bonus}')).toBe(false)
  })

  it('bonusWarn: só com Y = 0 e {bonus} fora do trecho padrão', () => {
    expect(referralMessageBonusWarning(DEFAULT_REFERRAL_MESSAGE, 0)).toBe(false)
    expect(referralMessageBonusWarning('Ganhe {bonus} com {codigo}', 0)).toBe(true)
    expect(referralMessageBonusWarning('Ganhe {bonus} com {codigo}', 3)).toBe(false)
  })
})

describe('breadsLabel (= paez do handoff)', () => {
  it('singular e plural', () => {
    expect(breadsLabel(1)).toBe('1 pãozin')
    expect(breadsLabel(5)).toBe('5 pãezins')
    expect(breadsLabel(0)).toBe('0 pãezins')
  })
})

describe('ReferralCampaignSchema', () => {
  const ok = { rotulo: 'Semana em dobro', multiplicador: 2, inicio: '2026-10-05', fim: '2026-10-11' }

  it('aceita campanha válida (início = fim também vale)', () => {
    expect(ReferralCampaignSchema.safeParse(ok).success).toBe(true)
    expect(ReferralCampaignSchema.safeParse({ ...ok, fim: ok.inicio }).success).toBe(true)
  })

  it('recusa multiplicador fora de 2..5, fim antes do início e data fora do formato', () => {
    expect(ReferralCampaignSchema.safeParse({ ...ok, multiplicador: 1 }).success).toBe(false)
    expect(ReferralCampaignSchema.safeParse({ ...ok, multiplicador: 6 }).success).toBe(false)
    expect(ReferralCampaignSchema.safeParse({ ...ok, fim: '2026-10-04' }).success).toBe(false)
    expect(ReferralCampaignSchema.safeParse({ ...ok, inicio: '05/10' }).success).toBe(false)
    expect(ReferralCampaignSchema.safeParse({ ...ok, rotulo: '  ' }).success).toBe(false)
  })
})

describe('ReferralGoalsSchema', () => {
  it('até 5 metas, quantidades distintas, dentro das faixas', () => {
    expect(ReferralGoalsSchema.safeParse([{ quantidade: 5, bonus: 10 }, { quantidade: 10, bonus: 25 }]).success).toBe(true)
    expect(ReferralGoalsSchema.safeParse([{ quantidade: 5, bonus: 10 }, { quantidade: 5, bonus: 20 }]).success).toBe(false)
    expect(ReferralGoalsSchema.safeParse([{ quantidade: 0, bonus: 10 }]).success).toBe(false)
    expect(ReferralGoalsSchema.safeParse([{ quantidade: 5, bonus: 51 }]).success).toBe(false)
    const six = [1, 2, 3, 4, 5, 6].map((q) => ({ quantidade: q, bonus: 1 }))
    expect(ReferralGoalsSchema.safeParse(six).success).toBe(false)
  })
})
