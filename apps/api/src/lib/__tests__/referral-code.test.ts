import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { REFERRAL_CODE_ALPHABET } from '@cheirin-de-pao/shared'
import { codePrefix, ensureReferralCode, firstName, generateCode, normalizeCode, shortName } from '../referral-code.js'

/** Sorteio fixo: devolve os índices na ordem, em loop. */
const fixedPick = (...idx: number[]) => {
  let i = 0
  return () => idx[i++ % idx.length]
}

describe('referral-code', () => {
  describe('generateCode', () => {
    it('primeiro nome sem acento + 4 caracteres do alfabeto', () => {
      const code = generateCode('João Martins', fixedPick(5, 0, 1, 2))
      expect(code).toBe(`JOAO${REFERRAL_CODE_ALPHABET[5]}${REFERRAL_CODE_ALPHABET[0]}${REFERRAL_CODE_ALPHABET[1]}${REFERRAL_CODE_ALPHABET[2]}`)
      expect(code).toMatch(/^[A-Z]+[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
    })

    it('sufixo real sempre dentro do alfabeto (sem 0/O/1/I/L)', () => {
      for (let i = 0; i < 200; i++) {
        const suffix = generateCode('Ana').slice(3)
        expect(suffix).toHaveLength(4)
        for (const c of suffix) expect(REFERRAL_CODE_ALPHABET).toContain(c)
      }
    })
  })

  describe('codePrefix', () => {
    it('corta em 6 letras e tira acento', () => {
      expect(codePrefix('Fernanda Lima')).toBe('FERNAN')
      expect(codePrefix('Conceição')).toBe('CONCEI')
      expect(codePrefix('Él')).toBe('EL')
    })

    it('ignora o que não é letra no primeiro nome', () => {
      expect(codePrefix("D'Ávila Souza")).toBe('DAVILA')
      expect(codePrefix('  ana  ')).toBe('ANA')
    })

    it('sem letra aproveitável → prefixo reservado PAO', () => {
      expect(codePrefix('')).toBe('PAO')
      expect(codePrefix('123')).toBe('PAO')
      expect(codePrefix('🥖 Silva')).toBe('PAO')
      expect(codePrefix(null)).toBe('PAO')
    })
  })

  describe('normalizeCode', () => {
    it('é a normalização do shared', () => {
      expect(normalizeCode(' joao-7k2f ')).toBe('JOAO7K2F')
    })
  })

  describe('shortName / firstName', () => {
    it('primeiro nome + inicial do último sobrenome', () => {
      expect(shortName('Maria Souza')).toBe('Maria S.')
      expect(shortName('Maria da Silva')).toBe('Maria S.')
      expect(shortName('joão martins')).toBe('joão M.')
    })

    it('nome de uma palavra fica como está; vazio vira vazio', () => {
      expect(shortName('Maria')).toBe('Maria')
      expect(shortName('  ')).toBe('')
      expect(shortName(null)).toBe('')
    })

    it('firstName', () => {
      expect(firstName(' João  Martins ')).toBe('João')
      expect(firstName(undefined)).toBe('')
    })
  })

  describe('ensureReferralCode', () => {
    function makePrisma(user: { name: string; referralCode?: string | null } | null) {
      const findUnique = vi.fn().mockResolvedValue(user)
      const updateMany = vi.fn().mockResolvedValue({ count: 1 })
      const prisma = { user: { findUnique, updateMany } } as unknown as PrismaClient
      return { prisma, findUnique, updateMany }
    }

    it('cliente que já tem código: devolve sem gravar', async () => {
      const { prisma, updateMany } = makePrisma({ name: 'João', referralCode: 'JOAO7K2F' })
      await expect(ensureReferralCode(prisma, 'u1')).resolves.toBe('JOAO7K2F')
      expect(updateMany).not.toHaveBeenCalled()
    })

    it('usuário inexistente → null', async () => {
      const { prisma } = makePrisma(null)
      await expect(ensureReferralCode(prisma, 'u1')).resolves.toBeNull()
    })

    it('sem código: grava com claim (null OU ausente) e devolve o gerado', async () => {
      const { prisma, updateMany } = makePrisma({ name: 'Maria Souza', referralCode: null })
      const code = await ensureReferralCode(prisma, 'u1')
      expect(code).toMatch(/^MARIA[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
      const arg = updateMany.mock.calls[0][0]
      expect(arg.where).toEqual({ id: 'u1', OR: [{ referralCode: null }, { referralCode: { isSet: false } }] })
      expect(arg.data).toEqual({ referralCode: code })
    })

    it('colisão no índice único (P2002) → sorteia de novo', async () => {
      const { prisma, updateMany } = makePrisma({ name: 'Ana', referralCode: null })
      updateMany.mockRejectedValueOnce({ code: 'P2002' }).mockResolvedValueOnce({ count: 1 })
      await expect(ensureReferralCode(prisma, 'u1')).resolves.toMatch(/^ANA/)
      expect(updateMany).toHaveBeenCalledTimes(2)
    })

    it('colisão como erro cru do Mongo (E11000) também sorteia de novo', async () => {
      const { prisma, updateMany } = makePrisma({ name: 'Ana', referralCode: null })
      updateMany
        .mockRejectedValueOnce(new Error('E11000 duplicate key error collection: User index: referralCode_1'))
        .mockResolvedValueOnce({ count: 1 })
      await expect(ensureReferralCode(prisma, 'u1')).resolves.toMatch(/^ANA/)
    })

    it('5 colisões seguidas → desiste com erro', async () => {
      const { prisma, updateMany } = makePrisma({ name: 'Ana', referralCode: null })
      updateMany.mockRejectedValue({ code: 'P2002' })
      await expect(ensureReferralCode(prisma, 'u1')).rejects.toThrow(/código livre/)
      expect(updateMany).toHaveBeenCalledTimes(5)
    })

    it('perdeu o claim para outra requisição → devolve o código que ela gravou', async () => {
      const { prisma, findUnique, updateMany } = makePrisma({ name: 'Ana', referralCode: null })
      updateMany.mockResolvedValueOnce({ count: 0 })
      findUnique.mockResolvedValueOnce({ name: 'Ana', referralCode: null }).mockResolvedValueOnce({ referralCode: 'ANAXYZ9' })
      await expect(ensureReferralCode(prisma, 'u1')).resolves.toBe('ANAXYZ9')
      expect(updateMany).toHaveBeenCalledOnce()
    })

    it('outro erro não é engolido', async () => {
      const { prisma, updateMany } = makePrisma({ name: 'Ana', referralCode: null })
      updateMany.mockRejectedValueOnce(new Error('rede caiu'))
      await expect(ensureReferralCode(prisma, 'u1')).rejects.toThrow('rede caiu')
    })
  })
})
