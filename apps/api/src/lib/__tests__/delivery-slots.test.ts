import { describe, it, expect, vi } from 'vitest'
import {
  isSameDayDelivery,
  validateCondoSlotTime,
  normalizeCondoSlot,
  propagateToCondos,
  setCondoDeliverySlots,
  getCondoDeliverySlots,
  setGlobalDeliverySlots,
  listActiveCondoSlots,
  groupCondoSlotsByTime,
  minuteOfDay,
  DEFAULT_DELIVERY_SLOTS,
  type GlobalDeliverySlot,
  type RawSlot,
} from '../delivery-slots.js'

const MANHA: GlobalDeliverySlot = {
  slotId: 'manha', name: 'manha', label: 'Manhã', emoji: '☀️',
  time: '06:30', cutoffTime: '22:00', isActive: true,
}
const TARDE: GlobalDeliverySlot = {
  slotId: 'tarde', name: 'tarde', label: 'Tarde', emoji: '🌙',
  time: '15:30', cutoffTime: '10:00', isActive: true,
}

/** Prisma fake com um Setting de slots globais + N condomínios. */
function fakePrisma(condos: Array<{ id: string; name?: string; deliverySlots: RawSlot[] }>, global = [MANHA, TARDE]) {
  const updates: Array<{ id: string; slots: RawSlot[] }> = []
  return {
    updates,
    prisma: {
      setting: {
        findUnique: vi.fn().mockResolvedValue({ value: JSON.stringify(global) }),
        upsert: vi.fn().mockResolvedValue({}),
      },
      condominium: {
        findMany: vi.fn().mockResolvedValue(condos.map((c) => ({ name: 'Condo', ...c }))),
        findUnique: vi.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(condos.find((c) => c.id === where.id) ?? null),
        ),
        update: vi.fn(({ where, data }: { where: { id: string }; data: { deliverySlots: RawSlot[] } }) => {
          updates.push({ id: where.id, slots: data.deliverySlots })
          return Promise.resolve({})
        }),
      },
    },
  }
}

describe('delivery-slots — personalização por condomínio', () => {
  describe('isSameDayDelivery / Regra A', () => {
    it('entrega no mesmo dia só quando o horário está à frente do corte', () => {
      expect(isSameDayDelivery('06:30', '22:00')).toBe(false) // manhã → amanhã
      expect(isSameDayDelivery('15:30', '10:00')).toBe(true) // tarde → hoje
    })
  })

  describe('validateCondoSlotTime', () => {
    it('aceita horário do mesmo lado da fronteira do corte', () => {
      expect(validateCondoSlotTime(MANHA, '05:00')).toBeNull()
      expect(validateCondoSlotTime(MANHA, '07:45')).toBeNull()
      expect(validateCondoSlotTime(TARDE, '16:00')).toBeNull()
      expect(validateCondoSlotTime(TARDE, '10:01')).toBeNull()
    })

    it('recusa horário que inverte a Regra A', () => {
      // manhã entrega amanhã (06:30 <= 22:00); 23:30 passaria a entregar hoje
      expect(validateCondoSlotTime(MANHA, '23:30')).toMatch(/precisa ser até 22:00/)
      // tarde entrega hoje (15:30 > 10:00); 09:00 passaria a entregar amanhã
      expect(validateCondoSlotTime(TARDE, '09:00')).toMatch(/precisa ser depois de 10:00/)
    })

    it('recusa formato inválido', () => {
      expect(validateCondoSlotTime(MANHA, '6:30')).toMatch(/Use HH:MM/)
      expect(validateCondoSlotTime(MANHA, '25:00')).toMatch(/Use HH:MM/)
    })
  })

  describe('normalizeCondoSlot', () => {
    it('slot legado sem flags é tratado como herdado', () => {
      const s = normalizeCondoSlot({ name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true })
      expect(s.timeCustom).toBe(false)
      expect(s.activeCustom).toBe(false)
      expect(s.slotId).toBe('manha')
      expect(s.label).toBe('Manhã')
    })
  })

  describe('propagateToCondos', () => {
    it('sobrescreve time/isActive dos slots HERDADOS', async () => {
      const { prisma, updates } = fakePrisma([
        { id: 'c1', deliverySlots: [{ slotId: 'manha', name: 'manha', time: '05:00', cutoffTime: '20:00', isActive: false }] },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await propagateToCondos(prisma as any, [MANHA])
      expect(updates[0].slots[0]).toMatchObject({
        time: '06:30', cutoffTime: '22:00', isActive: true, timeCustom: false, activeCustom: false,
      })
    })

    it('PRESERVA time/isActive personalizados e ainda assim alinha o corte', async () => {
      const { prisma, updates } = fakePrisma([
        {
          id: 'c1',
          deliverySlots: [{
            slotId: 'manha', name: 'manha', time: '05:15', cutoffTime: '19:00',
            isActive: false, timeCustom: true, activeCustom: true,
          }],
        },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await propagateToCondos(prisma as any, [MANHA])
      expect(updates[0].slots[0]).toMatchObject({
        time: '05:15', // personalizado — preservado
        isActive: false, // personalizado — preservado
        cutoffTime: '22:00', // corte é sempre global
        label: 'Manhã',
        timeCustom: true,
        activeCustom: true,
      })
    })

    it('preserva o `name` (identidade) mesmo com slotId alinhado', async () => {
      const { prisma, updates } = fakePrisma([
        { id: 'c1', deliverySlots: [{ name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true }] },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await propagateToCondos(prisma as any, [MANHA])
      expect(updates[0].slots[0].name).toBe('manha')
      expect(updates[0].slots[0].slotId).toBe('manha')
    })

    it('deixa intacto slot do condomínio sem correspondência global', async () => {
      const extra = { slotId: 'noite', name: 'noite', time: '20:00', cutoffTime: '12:00', isActive: true }
      const { prisma, updates } = fakePrisma([{ id: 'c1', deliverySlots: [extra] }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await propagateToCondos(prisma as any, [MANHA])
      expect(updates[0].slots[0]).toEqual(extra)
    })
  })

  describe('setGlobalDeliverySlots', () => {
    it('propaga normalmente quando nada conflita', async () => {
      const { prisma } = fakePrisma([
        { id: 'c1', deliverySlots: [{ slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true }] },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await setGlobalDeliverySlots(prisma as any, [{ slotId: 'manha', cutoffTime: '21:00' }])
      expect(out.find((s) => s.slotId === 'manha')?.cutoffTime).toBe('21:00')
      expect(prisma.setting.upsert).toHaveBeenCalled()
    })

    it('recusa (422) mudança de corte que inverteria a Regra A de um condo personalizado', async () => {
      const { prisma } = fakePrisma([
        {
          id: 'c1',
          name: 'Vila Bela',
          deliverySlots: [{
            slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00',
            isActive: true, timeCustom: true,
          }],
        },
      ])
      // Corte 05:00: 06:30 > 05:00 → o condo passaria a entregar HOJE, enquanto o global
      // (que também é 06:30) faria o mesmo... então usamos um global distinto para inverter só o condo.
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setGlobalDeliverySlots(prisma as any, [{ slotId: 'manha', time: '23:30', cutoffTime: '22:00' }]),
      ).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('Vila Bela') })
      expect(prisma.setting.upsert).not.toHaveBeenCalled()
    })

    it('ignora conflito em slot HERDADO (ele acompanha o global por construção)', async () => {
      const { prisma } = fakePrisma([
        { id: 'c1', deliverySlots: [{ slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true }] },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(setGlobalDeliverySlots(prisma as any, [{ slotId: 'manha', time: '23:30' }])).resolves.toBeTruthy()
    })
  })

  describe('setCondoDeliverySlots', () => {
    const condoSlots: RawSlot[] = [
      { slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
      { slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
    ]

    it('personaliza o horário de entrega e marca timeCustom', async () => {
      const { prisma, updates } = fakePrisma([{ id: 'c1', deliverySlots: [...condoSlots] }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await setCondoDeliverySlots(prisma as any, 'c1', [{ slotId: 'manha', time: '05:45' }])
      expect(out.find((s) => s.slotId === 'manha')).toMatchObject({ time: '05:45', timeCustom: true })
      expect(updates[0].slots.find((s) => s.slotId === 'tarde')).toMatchObject({ time: '15:30', timeCustom: false })
    })

    it('desliga o turno só naquele condomínio', async () => {
      const { prisma } = fakePrisma([{ id: 'c1', deliverySlots: [...condoSlots] }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await setCondoDeliverySlots(prisma as any, 'c1', [{ slotId: 'tarde', isActive: false }])
      expect(out.find((s) => s.slotId === 'tarde')).toMatchObject({ isActive: false, activeCustom: true })
      expect(out.find((s) => s.slotId === 'manha')).toMatchObject({ isActive: true, activeCustom: false })
    })

    it('null volta a herdar o padrão global', async () => {
      const custom: RawSlot[] = [
        { slotId: 'manha', name: 'manha', time: '05:00', cutoffTime: '22:00', isActive: false, timeCustom: true, activeCustom: true },
      ]
      const { prisma } = fakePrisma([{ id: 'c1', deliverySlots: custom }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await setCondoDeliverySlots(prisma as any, 'c1', [{ slotId: 'manha', time: null, isActive: null }])
      expect(out[0]).toMatchObject({ time: '06:30', isActive: true, timeCustom: false, activeCustom: false })
    })

    it('personalizar com o MESMO valor do global conta como herança', async () => {
      const { prisma } = fakePrisma([{ id: 'c1', deliverySlots: [...condoSlots] }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await setCondoDeliverySlots(prisma as any, 'c1', [{ slotId: 'manha', time: '06:30' }])
      expect(out[0]).toMatchObject({ time: '06:30', timeCustom: false })
    })

    it('recusa (422) horário que inverte a Regra A, sem gravar nada', async () => {
      const { prisma, updates } = fakePrisma([{ id: 'c1', deliverySlots: [...condoSlots] }])
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCondoDeliverySlots(prisma as any, 'c1', [{ slotId: 'manha', time: '23:00' }]),
      ).rejects.toMatchObject({ statusCode: 422 })
      expect(updates).toHaveLength(0)
    })

    it('recusa (422) turno desconhecido', async () => {
      const { prisma } = fakePrisma([{ id: 'c1', deliverySlots: [...condoSlots] }])
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCondoDeliverySlots(prisma as any, 'c1', [{ slotId: 'madrugada', time: '03:00' }]),
      ).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('madrugada') })
    })

    it('404 em condomínio inexistente', async () => {
      const { prisma } = fakePrisma([])
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCondoDeliverySlots(prisma as any, 'nope', [{ slotId: 'manha', time: '05:00' }]),
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('getCondoDeliverySlots', () => {
    it('resolve o efetivo: personalizado local, resto do global', async () => {
      const { prisma } = fakePrisma([
        {
          id: 'c1',
          deliverySlots: [
            { slotId: 'manha', name: 'manha', time: '05:00', cutoffTime: '19:00', isActive: true, timeCustom: true },
            { slotId: 'tarde', name: 'tarde', time: '99:99', cutoffTime: '01:00', isActive: false },
          ],
        },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await getCondoDeliverySlots(prisma as any, 'c1')
      expect(out[0]).toMatchObject({ time: '05:00', cutoffTime: '22:00', timeCustom: true })
      // slot herdado: valores locais sujos são descartados em favor do global
      expect(out[1]).toMatchObject({ time: '15:30', cutoffTime: '10:00', isActive: true, timeCustom: false })
    })

    it('404 em condomínio inexistente', async () => {
      const { prisma } = fakePrisma([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(getCondoDeliverySlots(prisma as any, 'nope')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('listActiveCondoSlots / groupCondoSlotsByTime', () => {
    const inherited: RawSlot[] = [
      { slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
      { slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
    ]

    it('resolve o horário EFETIVO de cada condomínio e ignora turnos inativos', async () => {
      const { prisma } = fakePrisma([
        { id: 'c1', name: 'Alfa', deliverySlots: inherited },
        {
          id: 'c2',
          name: 'Beta',
          deliverySlots: [
            { slotId: 'manha', name: 'manha', time: '05:00', cutoffTime: '22:00', isActive: true, timeCustom: true },
            { slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: false, activeCustom: true },
          ],
        },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await listActiveCondoSlots(prisma as any)

      expect(out).toHaveLength(3) // 2 do Alfa + só a manhã do Beta
      expect(out.find((o) => o.condominiumId === 'c2' && o.slot.slotId === 'manha')!.slot.time).toBe('05:00')
      expect(out.some((o) => o.condominiumId === 'c2' && o.slot.slotId === 'tarde')).toBe(false)
    })

    it('sem personalização: UM grupo por turno cobrindo todos (comportamento histórico)', () => {
      const groups = groupCondoSlotsByTime([
        { condominiumId: 'c1', condominiumName: 'Alfa', slot: normalizeCondoSlot(inherited[0]) },
        { condominiumId: 'c2', condominiumName: 'Beta', slot: normalizeCondoSlot(inherited[0]) },
        { condominiumId: 'c1', condominiumName: 'Alfa', slot: normalizeCondoSlot(inherited[1]) },
        { condominiumId: 'c2', condominiumName: 'Beta', slot: normalizeCondoSlot(inherited[1]) },
      ])

      expect(groups).toHaveLength(2)
      for (const g of groups) {
        expect(g.condominiumIds).toEqual(['c1', 'c2'])
        expect(g.coversAllCondos).toBe(true)
      }
      // Ordenado por horário: manhã (06:30) antes de tarde (15:30).
      expect(groups.map((g) => g.slotId)).toEqual(['manha', 'tarde'])
    })

    it('horário personalizado destaca só aquele condomínio, sem fragmentar os demais', () => {
      const cedo = { ...normalizeCondoSlot(inherited[0]), time: '05:00', timeCustom: true }
      const groups = groupCondoSlotsByTime([
        { condominiumId: 'c1', condominiumName: 'Alfa', slot: normalizeCondoSlot(inherited[0]) },
        { condominiumId: 'c2', condominiumName: 'Beta', slot: normalizeCondoSlot(inherited[0]) },
        { condominiumId: 'c3', condominiumName: 'Gama', slot: cedo },
      ])

      expect(groups).toHaveLength(2)
      const [cedoGroup, padraoGroup] = groups // 05:00 vem antes de 06:30
      expect(cedoGroup).toMatchObject({ time: '05:00', condominiumIds: ['c3'], coversAllCondos: false })
      expect(padraoGroup).toMatchObject({ time: '06:30', condominiumIds: ['c1', 'c2'], coversAllCondos: false })
    })

    it('coversAllCondos olha só os condomínios QUE TÊM aquele turno ativo', () => {
      // Só o Alfa tem a tarde ativa → o grupo da tarde cobre todos os candidatos dela.
      const groups = groupCondoSlotsByTime([
        { condominiumId: 'c1', condominiumName: 'Alfa', slot: normalizeCondoSlot(inherited[0]) },
        { condominiumId: 'c2', condominiumName: 'Beta', slot: normalizeCondoSlot(inherited[0]) },
        { condominiumId: 'c1', condominiumName: 'Alfa', slot: normalizeCondoSlot(inherited[1]) },
      ])
      expect(groups.find((g) => g.slotId === 'tarde')!.coversAllCondos).toBe(true)
    })

    it('lista vazia → nenhum grupo', () => {
      expect(groupCondoSlotsByTime([])).toEqual([])
    })
  })

  describe('minuteOfDay', () => {
    it('converte HH:MM e aplica o deslocamento', () => {
      expect(minuteOfDay('00:00')).toBe(0)
      expect(minuteOfDay('06:30')).toBe(390)
      expect(minuteOfDay('06:30', 60)).toBe(450) // 07:30
    })

    it('envolve na meia-noite nos dois sentidos', () => {
      expect(minuteOfDay('23:30', 60)).toBe(30) // 00:30 do dia seguinte
      expect(minuteOfDay('00:30', -60)).toBe(1410) // 23:30 do dia anterior
    })
  })

  it('DEFAULT_DELIVERY_SLOTS respeita a Regra A de cada turno', () => {
    for (const s of DEFAULT_DELIVERY_SLOTS) {
      expect(validateCondoSlotTime(s, s.time)).toBeNull()
    }
  })
})
