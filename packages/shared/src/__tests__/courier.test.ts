import { describe, it, expect } from 'vitest'
import {
  FAILURE_CODES,
  FAILURE_LABELS,
  failureClientText,
  isFailureCode,
  isProofExpired,
  stopShortCode,
  normalizeStopCode,
  matchesStopCode,
  fuelPriceFor,
  fuelUnit,
  consumptionUnit,
  fuelsFor,
  estimateFuel,
  vehicleUsesFuel,
  payoutRemuneration,
  payWeekOf,
  payoutProposal,
  payoutTotals,
  payoutCompetenceMonth,
  readCondoAccess,
  ACCESS_FIELD_KEY,
  isAvailableOn,
  isOnTimeOff,
  recadoText,
} from '../courier'

describe('motivos de não entrega', () => {
  it('todo código tem rótulo do entregador e texto do cliente', () => {
    for (const c of FAILURE_CODES) {
      expect(FAILURE_LABELS[c]).toBeTruthy()
      expect(failureClientText(c)).toBeTruthy()
    }
  })
  it('"Outro" e a correção do admin não vazam texto livre para o cliente', () => {
    expect(failureClientText('OUTRO')).toBe('tivemos um imprevisto na entrega')
    expect(failureClientText('CORRIGIDO_ADMIN')).toBe('tivemos um imprevisto na entrega')
  })
  it('sem código (pedido antigo) ou código desconhecido → null', () => {
    expect(failureClientText(null)).toBeNull()
    expect(failureClientText('XYZ')).toBeNull()
    expect(isFailureCode('PORTARIA_NAO_LIBEROU')).toBe(true)
    expect(isFailureCode('CORRIGIDO_ADMIN')).toBe(false)
  })
})

describe('comprovante — 90 dias', () => {
  const now = new Date('2026-12-31T12:00:00Z')
  it('expira depois de 90 dias', () => {
    expect(isProofExpired('2026-10-01T12:00:00Z', now)).toBe(true)
    expect(isProofExpired(new Date('2026-10-03T12:00:00Z'), now)).toBe(false)
  })
})

describe('código curto do cupom', () => {
  const id = '66f1a2b3c4d5e6f7a8b9c0d1'
  it('imprime os 6 últimos caracteres em maiúsculas', () => {
    expect(stopShortCode(id)).toBe('B9C0D1')
    expect(stopShortCode(id, 4)).toBe('C0D1')
  })
  it('normaliza #, espaços, hífens e caixa', () => {
    expect(normalizeStopCode(' #b9c-0d1 ')).toBe('B9C0D1')
  })
  it('aceita 6 (novo) e 4 (cupom antigo); recusa outros tamanhos e não-hex', () => {
    expect(matchesStopCode('#b9c0d1', id)).toBe(true)
    expect(matchesStopCode('c0d1', id)).toBe(true)
    expect(matchesStopCode('0d1', id)).toBe(false)
    expect(matchesStopCode('A7K2QX', id)).toBe(false)
    expect(matchesStopCode('B9C0D2', id)).toBe(false)
  })
})

describe('combustível', () => {
  const prices = { gasolina: 6.09, etanol: 4.19 }
  it('flex usa o preço da gasolina', () => {
    expect(fuelPriceFor('FLEX', prices)).toBe(6.09)
    expect(fuelPriceFor('ETANOL', prices)).toBe(4.19)
    expect(fuelPriceFor(null, prices)).toBeNull()
  })
  it('estima litros e custo (9,6 km · 38 km/l · R$ 6,09 ≈ R$ 1,54)', () => {
    expect(estimateFuel(9.6, 38, 6.09)).toEqual({ litros: 0.25, custo: 1.54 })
  })
  it('sem consumo ou sem preço → null (não é "de graça")', () => {
    expect(estimateFuel(10, null, 6.09)).toBeNull()
    expect(estimateFuel(10, 38, null)).toBeNull()
    expect(estimateFuel(10, 0, 6.09)).toBeNull()
  })
  it('GNV (Onda 11): preço próprio por m³, km/m³ e só no carro', () => {
    expect(fuelPriceFor('GNV', { ...prices, gnv: 4.99 })).toBe(4.99)
    expect(fuelPriceFor('GNV', prices)).toBeNull() // sem preço do GNV informado
    expect([fuelUnit('GNV'), consumptionUnit('GNV')]).toEqual(['m³', 'km/m³'])
    expect([fuelUnit('FLEX'), consumptionUnit(null)]).toEqual(['l', 'km/l'])
    expect(fuelsFor('CARRO')).toContain('GNV')
    expect(fuelsFor('MOTO')).toEqual(['GASOLINA', 'ETANOL', 'FLEX'])
  })
  it('bicicleta e a pé não usam combustível', () => {
    expect(vehicleUsesFuel('MOTO')).toBe(true)
    expect(vehicleUsesFuel('BIKE')).toBe(false)
    expect(vehicleUsesFuel(undefined)).toBe(false)
  })
})

describe('pagamento', () => {
  const counts = { entregas: 142, rotas: 8 }
  it('as três modalidades', () => {
    expect(payoutRemuneration('PER_DELIVERY', 1.5, counts)).toEqual({ units: 142, amount: 213 })
    expect(payoutRemuneration('PER_ROUTE', 25, counts)).toEqual({ units: 8, amount: 200 })
    expect(payoutRemuneration('WEEKLY_FIXED', 400, counts)).toEqual({ units: 1, amount: 400 })
  })
  it('sem modalidade → 0', () => {
    expect(payoutRemuneration(null, 10, counts)).toEqual({ units: 0, amount: 0 })
  })

  const prices = { gasolina: 6.09, etanol: 4.19 }
  const moto = { tipo: 'MOTO', combustivel: 'FLEX', kmPorLitro: 38 }
  it('proposta: por entrega + combustível (flex = gasolina)', () => {
    const p = payoutProposal({ pay: { modalidade: 'PER_DELIVERY', valor: 1.5, pagaCombustivel: true }, vehicle: moto, prices, entregas: 142, rotas: 8, km: 49.3 })
    expect(p).toMatchObject({ payMode: 'PER_DELIVERY', payAmount: 1.5, units: 142, remunerationEst: 213, kmEst: 49.3, fuelEst: 7.9 })
    expect(p.fuelBasis).toEqual({ kmPorLitro: 38, preco: 6.09, combustivel: 'FLEX', reason: null })
  })
  it('proposta: por rota, semanal fixo e etanol', () => {
    expect(payoutProposal({ pay: { modalidade: 'PER_ROUTE', valor: 25 }, vehicle: { ...moto, combustivel: 'ETANOL' }, prices, entregas: 50, rotas: 10, km: 38 })).toMatchObject({ units: 10, remunerationEst: 250, fuelEst: 4.19 })
    expect(payoutProposal({ pay: { modalidade: 'WEEKLY_FIXED', valor: 400 }, vehicle: moto, prices, entregas: 0, rotas: 0, km: 0 })).toMatchObject({ units: 1, remunerationEst: 400, fuelEst: 0, fuelBasis: { reason: 'SEM_KM' } })
  })
  it('combustível fora: sem preço, sem consumo, bicicleta, não paga', () => {
    const base = { pay: { modalidade: 'PER_DELIVERY', valor: 1 }, entregas: 10, rotas: 2, km: 20 }
    expect(payoutProposal({ ...base, vehicle: moto, prices: { gasolina: null, etanol: null } })).toMatchObject({ fuelEst: 0, fuelBasis: { reason: 'SEM_PRECO' } })
    expect(payoutProposal({ ...base, vehicle: { tipo: 'MOTO' }, prices })).toMatchObject({ fuelEst: 0, fuelBasis: { reason: 'SEM_CONSUMO' } })
    // GNV: 60 km ÷ 12 km/m³ × R$ 4,99 = R$ 24,95; sem o preço do GNV, fica de fora
    const gnvCar = { tipo: 'CARRO', combustivel: 'GNV', kmPorLitro: 12 }
    expect(payoutProposal({ ...base, km: 60, vehicle: gnvCar, prices: { ...prices, gnv: 4.99 } })).toMatchObject({ fuelEst: 24.95, fuelBasis: { kmPorLitro: 12, preco: 4.99, combustivel: 'GNV', reason: null } })
    expect(payoutProposal({ ...base, km: 60, vehicle: gnvCar, prices })).toMatchObject({ fuelEst: 0, fuelBasis: { reason: 'SEM_PRECO' } })
    expect(payoutProposal({ ...base, vehicle: { tipo: 'BIKE' }, prices })).toMatchObject({ fuelEst: 0, fuelBasis: { reason: 'NAO_USA', combustivel: null } })
    expect(payoutProposal({ ...base, vehicle: null, prices })).toMatchObject({ fuelEst: 0, fuelBasis: { reason: 'NAO_USA' } })
    expect(payoutProposal({ ...base, pay: { ...base.pay, pagaCombustivel: false }, vehicle: moto, prices })).toMatchObject({ remunerationEst: 10, fuelEst: 0, fuelBasis: { reason: 'NAO_PAGA' } })
  })
  it('cadastro sem pagamento: sem modalidade, combustível pago', () => {
    expect(payoutProposal({ pay: null, vehicle: moto, prices, entregas: 30, rotas: 3, km: 38 })).toMatchObject({ payMode: null, payAmount: null, units: 0, remunerationEst: 0, fuelEst: 6.09 })
    expect(payoutProposal({ pay: { modalidade: 'INVALIDA', valor: 9 }, vehicle: moto, prices, entregas: 30, rotas: 3, km: 0 })).toMatchObject({ payMode: null, remunerationEst: 0 })
  })
  it('totais e competência', () => {
    expect(payoutTotals({ remunerationEst: 213, fuelEst: 7.8 })).toEqual({ remuneration: 213, fuel: 7.8, estimated: 220.8, final: 220.8 })
    expect(payoutTotals({ remunerationEst: 213, fuelEst: 7.8, remunerationFinal: 213, fuelFinal: 10 })).toEqual({ remuneration: 213, fuel: 10, estimated: 220.8, final: 223 })
    expect(payoutCompetenceMonth('2026-10-04')).toBe('2026-10')
  })
  it('semana de segunda a domingo', () => {
    expect(payWeekOf('2026-10-01')).toEqual({ weekStart: '2026-09-28', weekEnd: '2026-10-04' }) // quinta
    expect(payWeekOf('2026-09-28')).toEqual({ weekStart: '2026-09-28', weekEnd: '2026-10-04' }) // segunda
    expect(payWeekOf('2026-10-04')).toEqual({ weekStart: '2026-09-28', weekEnd: '2026-10-04' }) // domingo
  })
})

describe('disponibilidade', () => {
  it('sem cadastro = disponível sempre', () => {
    expect(isAvailableOn(null, 'dom', 'manha')).toBe(true)
  })
  it('respeita dias e turnos', () => {
    const a = { dias: ['seg', 'ter'], turnos: ['manha'] }
    expect(isAvailableOn(a, 'seg', 'manha')).toBe(true)
    expect(isAvailableOn(a, 'qua', 'manha')).toBe(false)
    expect(isAvailableOn(a, 'seg', 'tarde')).toBe(false)
  })
  it('folga por intervalo de datas', () => {
    const f = [{ startDate: '2026-10-12', endDate: '2026-10-13' }]
    expect(isOnTimeOff('2026-10-12', f)).toBe(true)
    expect(isOnTimeOff('2026-10-13', f)).toBe(true)
    expect(isOnTimeOff('2026-10-14', f)).toBe(false)
  })
})

describe('recados', () => {
  it('texto do modelo; chave desconhecida → null', () => {
    expect(recadoText('NA_PORTARIA')).toBe('Estou na portaria')
    expect(recadoText('LIVRE')).toBeNull()
  })
})

describe('pessoas (Onda 6)', () => {
  it('weekdayOf', async () => {
    const { weekdayOf } = await import('../courier')
    expect(weekdayOf('2026-10-02')).toBe('sex')
    expect(weekdayOf('2026-10-04')).toBe('dom')
    expect(weekdayOf('2026-09-28')).toBe('seg')
  })

  it('offReasonFor: folga vence a escala; fora dos dias ou do turno; sem escala = disponível', async () => {
    const { offReasonFor } = await import('../courier')
    const folgas = [{ startDate: '2026-10-12', endDate: '2026-10-13' }]
    expect(offReasonFor(null, folgas, '2026-10-12', 'manha')).toBe('FOLGA')
    expect(offReasonFor({ dias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], turnos: ['manha'] }, [], '2026-10-04', 'manha')).toBe('FORA_DA_ESCALA')
    expect(offReasonFor({ dias: ['sex'], turnos: ['manha'] }, [], '2026-10-02', 'tarde')).toBe('FORA_DA_ESCALA')
    expect(offReasonFor({ dias: ['sex'], turnos: ['manha'] }, [], '2026-10-02')).toBeNull()
    expect(offReasonFor(null, [], '2026-10-02', 'manha')).toBeNull()
  })

  it('crachá: CPF mascarado, número com 4 dígitos, ativo × desativado × vencido', async () => {
    const { maskCpf, badgeNumberLabel, badgeStatus } = await import('../courier')
    expect(maskCpf('123.456.789-00')).toBe('***.456.789-**')
    expect(maskCpf('123')).toBeNull()
    expect(badgeNumberLabel(427)).toBe('0427')
    expect(badgeNumberLabel(null)).toBeNull()
    expect(badgeStatus({ isBlocked: false, validUntil: '2026-12-31' }, '2026-10-02')).toEqual({ active: true, reason: 'ATIVO' })
    expect(badgeStatus({ isBlocked: false, validUntil: '2026-12-31' }, '2026-12-31').active).toBe(true)
    expect(badgeStatus({ isBlocked: false, validUntil: '2026-09-30' }, '2026-10-02')).toEqual({ active: false, reason: 'VENCIDO' })
    expect(badgeStatus({ isBlocked: true, validUntil: null }, '2026-10-02')).toEqual({ active: false, reason: 'DESATIVADO' })
    expect(badgeStatus({ isBlocked: false, validUntil: null }, '2026-10-02').active).toBe(true)
  })
})

describe('acesso do condomínio (Onda 8)', () => {
  it('lê o gravado: vazios viram null; nada preenchido = sem dicas', () => {
    expect(readCondoAccess({ portaria: ' 24 h ', temPorteiro: true, portao: '', obs: null, fotoUrl: 'https://cdn/x.jpg', lixo: 1 })).toEqual({
      portaria: '24 h',
      temPorteiro: true,
      portao: null,
      parar: null,
      obs: null,
      fotoUrl: 'https://cdn/x.jpg',
    })
    expect(readCondoAccess({ portaria: '  ', portao: '' })).toBeNull()
    expect(readCondoAccess(null)).toBeNull()
    expect(readCondoAccess({ temPorteiro: false })).toMatchObject({ temPorteiro: false })
  })
  it('cada sugestão aponta o campo que corrige', () => {
    expect(ACCESS_FIELD_KEY).toEqual({ PORTARIA: 'portaria', PORTAO: 'portao', PARAR: 'parar', OUTRO: 'obs' })
  })
})
