// Dados de exemplo das telas de pessoas do entregador (Onda 6): perfil, crachá, números e escala.
import type { CourierMe, CourierSchedule, CourierStats } from '../../../lib/courierApi'

export const meBody = (over: Partial<CourierMe> = {}): CourierMe => ({
  name: 'Antônio Ribeiro',
  firstName: 'Antônio',
  phone: '11998887766',
  since: '2026-03-10T12:00:00.000Z',
  photoUrl: null,
  cpfMasked: '***.456.789-**',
  vehicle: { tipo: 'MOTO', modelo: 'CG 160', placa: 'ABC1D23', combustivel: 'GASOLINA', kmPorLitro: 38 },
  rules: { fotoEntrega: true, fotoNaoEntrega: false, podeReordenar: false, podeRecados: false },
  badge: { number: '0427', validUntil: '2026-12-31', active: true, reason: 'ATIVO' },
  today: { slots: [{ slotId: 'manha', label: 'Manhã', emoji: '☀️' }], condos: ['Residencial Jardins', 'Edifício Aurora', 'Vila Nova'] },
  deliveries30: 312,
  scheduleLabel: 'Seg a sáb',
  nextTimeOff: { startDate: '2026-10-12', endDate: '2026-10-12' },
  ...over,
})

const manha = { slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30' }
const tarde = { slotId: 'tarde', label: 'Tarde', emoji: '🌇', time: '16:00' }

export const scheduleBody = (over: Partial<CourierSchedule> = {}): CourierSchedule => ({
  weekStart: '2026-09-28',
  weekEnd: '2026-10-04',
  slots: [manha, tarde],
  week: [
    { date: '2026-09-28', weekday: 'seg', today: false, off: null, slots: [manha] },
    { date: '2026-09-29', weekday: 'ter', today: false, off: null, slots: [manha, tarde] },
    { date: '2026-09-30', weekday: 'qua', today: false, off: null, slots: [manha] },
    { date: '2026-10-01', weekday: 'qui', today: false, off: null, slots: [manha, tarde] },
    { date: '2026-10-02', weekday: 'sex', today: true, off: null, slots: [manha] },
    { date: '2026-10-03', weekday: 'sab', today: false, off: null, slots: [manha] },
    { date: '2026-10-04', weekday: 'dom', today: false, off: 'FORA_DA_ESCALA', slots: [] },
  ],
  todayOff: null,
  timeOffs: [{ startDate: '2026-10-12', endDate: '2026-10-13', reason: 'Consulta médica' }],
  nextShift: { ...manha, date: '2026-10-03' },
  scheduleLabel: 'Seg a sáb',
  ...over,
})

/** Sexta de folga: o dia vira FOLGA e a próxima rota é sábado. */
export const scheduleOffToday = () => {
  const s = scheduleBody({ todayOff: 'FOLGA' })
  s.week = s.week.map((d) => (d.today ? { ...d, off: 'FOLGA' as const, slots: [] } : d))
  return s
}

export const statsBody = (days: 7 | 30 = 30, over: Partial<CourierStats> = {}): CourierStats => {
  const perDay = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 2 - (days - 1) + i)).toISOString().slice(0, 10)
    return { date: d, delivered: i % 7 === 6 ? 0 : 11, failed: i === days - 1 ? 1 : 0 }
  })
  return {
    days,
    deliveries: 286,
    failed: 9,
    successRate: 0.969,
    breads: 1144,
    avgRouteMin: 52,
    perDay,
    recent: [
      { date: '2026-10-02', delivered: 11, failed: 1, slots: ['☀️', '🌇'] },
      { date: '2026-10-01', delivered: 12, failed: 0, slots: ['☀️'] },
    ],
    ...over,
  }
}

export const emptyStats = (): CourierStats => ({
  ...statsBody(30),
  deliveries: 0,
  failed: 0,
  successRate: null,
  breads: 0,
  avgRouteMin: null,
  perDay: statsBody(30).perDay.map((d) => ({ ...d, delivered: 0, failed: 0 })),
  recent: [],
})
