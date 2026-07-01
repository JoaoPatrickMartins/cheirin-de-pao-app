// nextCutoff — regressão do banner "Horários de corte" mostrando "Encerrado" em todos os dias.
// Bug: a versão antiga comparava só a HORA-DO-DIA do corte contra o relógio atual, ignorando a
// DATA de entrega. Assim, depois que o relógio passava do último horário de corte (ex.: 22:01),
// QUALQUER dia futuro aparecia como "Encerrado". O fix compara instantes absolutos.
import { describe, it, expect } from 'vitest'
import { nextCutoff } from '../AdminPedido'

// Turnos típicos: Manhã (entrega 06:30, corte 22:01 da véspera) e Tarde (entrega 15:30, corte 10:00 do dia).
const manha = (deliveryDate: string, cutoffAt?: string) => ({
  slotId: 'manha',
  label: 'Manhã',
  time: '06:30',
  cutoffTime: '22:01',
  deliveryDate,
  cutoffAt,
})
const tarde = (deliveryDate: string, cutoffAt?: string) => ({
  slotId: 'tarde',
  label: 'Tarde',
  time: '15:30',
  cutoffTime: '10:00',
  deliveryDate,
  cutoffAt,
})

describe('nextCutoff', () => {
  it('mantém um dia FUTURO aberto mesmo após o relógio passar dos horários de corte de hoje', () => {
    // Agora: 27/jun 22:30 BRT (= 28/jun 01:30 UTC). A versão antiga marcaria encerrado porque
    // 22:30 > 22:01 e > 10:00 no relógio. Mas a entrega é 29/jun — os cortes ainda estão à frente.
    const now = new Date('2026-06-28T01:30:00.000Z')
    const slots = [
      manha('2026-06-29', '2026-06-29T01:01:00.000Z'), // corte = véspera (28/jun) 22:01 BRT
      tarde('2026-06-29', '2026-06-29T13:00:00.000Z'), // corte = 29/jun 10:00 BRT
    ]
    const r = nextCutoff(slots, now)
    expect(r.open).toBe(true)
    expect(r.label).toBe('Manhã') // corte mais próximo à frente
  })

  it('marca encerrado quando TODOS os cortes do dia já passaram (instante absoluto)', () => {
    // Agora: 28/jun 23:00 BRT (= 29/jun 02:00 UTC). Entrega 28/jun: ambos os cortes já passaram.
    const now = new Date('2026-06-29T02:00:00.000Z')
    const slots = [
      manha('2026-06-28', '2026-06-28T01:01:00.000Z'), // corte 27/jun 22:01 BRT — passou
      tarde('2026-06-28', '2026-06-28T13:00:00.000Z'), // corte 28/jun 10:00 BRT — passou
    ]
    expect(nextCutoff(slots, now).open).toBe(false)
  })

  it('é a DATA, não a hora-do-dia, que decide: mesmos cutoffTime, dias diferentes → resultados diferentes', () => {
    const now = new Date('2026-06-28T01:30:00.000Z') // 27/jun 22:30 BRT
    // Sem cutoffAt: deriva o instante de deliveryDate + time + cutoffTime (modo slots-status).
    const ontem = nextCutoff([manha('2026-06-27'), tarde('2026-06-27')], now)
    const amanha = nextCutoff([manha('2026-06-29'), tarde('2026-06-29')], now)
    expect(ontem.open).toBe(false) // cortes de 26-27/jun já passaram
    expect(amanha.open).toBe(true) // cortes de 28-29/jun ainda à frente
  })

  it('calcula o tempo restante até o próximo corte', () => {
    const now = new Date('2026-06-29T11:00:00.000Z') // 29/jun 08:00 BRT
    // Tarde corta 29/jun 10:00 BRT (= 13:00 UTC) → faltam 2h.
    const r = nextCutoff([tarde('2026-06-29', '2026-06-29T13:00:00.000Z')], now)
    expect(r.open).toBe(true)
    expect(r.remaining).toBe('2h 00m')
  })

  it('assume aberto quando não há slots ou faltam dados de corte', () => {
    expect(nextCutoff(null).open).toBe(true)
    expect(nextCutoff([]).open).toBe(true)
    // slot sem deliveryDate nem cutoffAt → sem como derivar o instante → assume aberto
    expect(nextCutoff([{ slotId: 'x', label: 'X', time: '06:30', cutoffTime: '22:00' }]).open).toBe(true)
  })
})
