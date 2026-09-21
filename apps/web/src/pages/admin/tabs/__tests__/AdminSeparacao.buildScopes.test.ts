// buildScopes — os lotes que a seleção múltipla de condomínios manda para /separation/conclude.
//
// A regra que estes testes protegem: cada turno é aprovado separadamente. A seleção acontece
// sobre o turno EXIBIDO, então marcar um condomínio nunca pode concluir o outro turno dele —
// nem por engano, nem por um turno que o quadro trouxe junto.
import { describe, it, expect } from 'vitest'
import { buildScopes, slotDone, type ScopeCondo } from '../AdminSeparacao'

const stop = (separated: boolean) => ({ separated })

/** Condomínio com um turno por entrada: [slotId, quantas paradas já marcadas, total]. */
const condo = (id: string, slots: [string, number, number][]): ScopeCondo => ({
  condominiumId: id,
  slots: slots.map(([slotId, sep, total]) => ({
    slotId,
    orders: Array.from({ length: total }, (_, i) => stop(i < sep)),
  })),
})

describe('slotDone', () => {
  it('turno com todas as paradas marcadas está pronto', () => {
    expect(slotDone({ orders: [stop(true), stop(true)] })).toBe(true)
  })

  it('turno com parada pendente não está pronto', () => {
    expect(slotDone({ orders: [stop(true), stop(false)] })).toBe(false)
  })

  it('turno sem paradas não conta como pronto (nada a concluir)', () => {
    expect(slotDone({ orders: [] })).toBe(false)
  })
})

describe('buildScopes', () => {
  const condos = [condo('c1', [['manha', 0, 3]]), condo('c2', [['manha', 1, 2]]), condo('c3', [['manha', 0, 1]])]

  it('gera um lote por condomínio marcado', () => {
    expect(buildScopes(condos, new Set(['c1', 'c3']), 'manha')).toEqual([
      { condominiumId: 'c1', slotId: 'manha' },
      { condominiumId: 'c3', slotId: 'manha' },
    ])
  })

  it('ignora condomínio não marcado', () => {
    expect(buildScopes(condos, new Set(['c2']), 'manha')).toEqual([{ condominiumId: 'c2', slotId: 'manha' }])
  })

  it('não gera nada sem seleção', () => {
    expect(buildScopes(condos, new Set(), 'manha')).toEqual([])
  })

  it('deixa de fora o turno que já está todo separado', () => {
    const pronto = [condo('c1', [['manha', 2, 2]]), condo('c2', [['manha', 0, 2]])]
    expect(buildScopes(pronto, new Set(['c1', 'c2']), 'manha')).toEqual([
      { condominiumId: 'c2', slotId: 'manha' },
    ])
  })

  it('NUNCA atravessa turno: só o exibido entra, mesmo com o outro no mesmo card', () => {
    const doisTurnos = [
      condo('c1', [
        ['manha', 0, 2],
        ['tarde', 0, 4],
      ]),
    ]
    expect(buildScopes(doisTurnos, new Set(['c1']), 'manha')).toEqual([
      { condominiumId: 'c1', slotId: 'manha' },
    ])
    expect(buildScopes(doisTurnos, new Set(['c1']), 'tarde')).toEqual([
      { condominiumId: 'c1', slotId: 'tarde' },
    ])
  })

  it("aceita o turno vazio ('' = sem horário) como turno exibido", () => {
    expect(buildScopes([condo('c1', [['', 0, 2]])], new Set(['c1']), '')).toEqual([
      { condominiumId: 'c1', slotId: '' },
    ])
  })

  it('id marcado que não está mais no quadro é ignorado', () => {
    expect(buildScopes(condos, new Set(['c1', 'sumiu']), 'manha')).toEqual([
      { condominiumId: 'c1', slotId: 'manha' },
    ])
  })
})
