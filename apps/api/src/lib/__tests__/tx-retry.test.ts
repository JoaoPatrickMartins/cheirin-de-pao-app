import { describe, it, expect, vi } from 'vitest'
import { isWriteConflict, withWriteConflictRetry } from '../tx-retry.js'

describe('tx-retry', () => {
  it('isWriteConflict reconhece só o P2034', () => {
    expect(isWriteConflict({ code: 'P2034' })).toBe(true)
    expect(isWriteConflict({ code: 'P2002' })).toBe(false)
    expect(isWriteConflict(new Error('x'))).toBe(false)
    expect(isWriteConflict(null)).toBe(false)
  })

  it('devolve o resultado da primeira tentativa que passa', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(withWriteConflictRetry(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('P2034 → repete a transação inteira', async () => {
    const fn = vi.fn().mockRejectedValueOnce({ code: 'P2034' }).mockResolvedValueOnce('ok')
    await expect(withWriteConflictRetry(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('P2034 em todas as tentativas → o erro da última sobe', async () => {
    const fn = vi.fn().mockRejectedValue({ code: 'P2034' })
    await expect(withWriteConflictRetry(fn, 3)).rejects.toMatchObject({ code: 'P2034' })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('erro que não é conflito de escrita não é repetido', async () => {
    const fn = vi.fn().mockRejectedValue({ code: 'P2025' })
    await expect(withWriteConflictRetry(fn)).rejects.toMatchObject({ code: 'P2025' })
    expect(fn).toHaveBeenCalledOnce()
  })
})
