import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

/**
 * Lista de espera de condomínio (C8 → A7): contato único (e-mail, celular, inválido), `groupKey`,
 * sem duplicar o mesmo contato, aviso ao admin best-effort, grupos do admin e tratar/reabrir.
 */

const notifyAdmins = vi.fn()
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: vi.fn().mockImplementation(function () {
    return { notifyAdmins }
  }),
}))

import { CondoInterestsService, condoGroupKey, parseContact } from '../condo-interests.service.js'
import { CondoInterestSchema } from '../condo-interests.schema.js'

function makeService() {
  const prisma = {
    condoInterest: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'i1' }),
      count: vi.fn().mockResolvedValue(3),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  }
  const fastify = { prisma, log: { warn: vi.fn(), error: vi.fn() } } as unknown as FastifyInstance
  return { service: new CondoInterestsService(fastify), prisma }
}

const body = (over: Record<string, unknown> = {}) =>
  CondoInterestSchema.parse({
    condoName: 'Residencial Sol',
    city: 'Campinas',
    contactName: 'Luciana P.',
    contact: 'luciana@email.com',
    ...over,
  })

beforeEach(() => {
  vi.clearAllMocks()
  notifyAdmins.mockResolvedValue(undefined)
})

describe('contato único e groupKey', () => {
  it('com "@" é e-mail (minúsculo); senão, celular em dígitos; lixo é inválido', () => {
    expect(parseContact(' Luciana@Email.com ')).toEqual({ email: 'luciana@email.com', phone: null })
    expect(parseContact('(19) 9 8123-4400')).toEqual({ email: null, phone: '19981234400' })
    expect(parseContact('luciana@')).toBeNull()
    expect(parseContact('1234')).toBeNull()
  })

  it('groupKey junta nome + cidade sem acento, minúsculos e com espaços simples', () => {
    expect(condoGroupKey('  Residêncial   Sol ', 'Campinas')).toBe('residencial sol|campinas')
    expect(condoGroupKey('RESIDENCIAL SOL', 'campinas')).toBe(condoGroupKey('Residencial Sol', 'Campinas'))
  })

  it('schema: cidade obrigatória, CEP com 8 dígitos, código de indicação adulterado é descartado', () => {
    expect(CondoInterestSchema.safeParse({ ...body(), city: '' }).success).toBe(false)
    expect(CondoInterestSchema.safeParse({ ...body(), zip: '1308' }).success).toBe(false)
    expect(body({ zip: '13085-000' }).zip).toBe('13085000')
    expect(body({ refCode: 'joao-7k2f' }).refCode).toBe('JOAO7K2F')
    expect(body({ refCode: '<x>' }).refCode).toBeUndefined()
    expect(body({ refCode: 42 }).refCode).toBeUndefined()
  })
})

describe('CondoInterestsService.create', () => {
  it('grava com todas as chaves e avisa o admin com o nº do pedido no grupo', async () => {
    const { service, prisma } = makeService()
    await service.create(body({ refCode: 'JOAO7K2F', zip: '13085000' }))
    expect(prisma.condoInterest.create).toHaveBeenCalledWith({
      data: {
        condoName: 'Residencial Sol',
        zip: '13085000',
        city: 'Campinas',
        groupKey: 'residencial sol|campinas',
        contactName: 'Luciana P.',
        email: 'luciana@email.com',
        phone: null,
        refCode: 'JOAO7K2F',
        visitorId: null,
        handledAt: null,
      },
    })
    expect(notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ADMIN_CONDO_INTEREST', title: 'Pedido de novo condomínio', body: 'Residencial Sol (Campinas) — 3º pedido.' }),
    )
  })

  it('contato inválido → 400 com a mensagem do campo, nada gravado', async () => {
    const { service, prisma } = makeService()
    await expect(service.create(body({ contact: 'abc' }))).rejects.toMatchObject({
      statusCode: 400,
      message: 'Informe um e-mail ou celular válido',
    })
    expect(prisma.condoInterest.create).not.toHaveBeenCalled()
  })

  it('o mesmo contato no mesmo condomínio não entra de novo (nem avisa de novo)', async () => {
    const { service, prisma } = makeService()
    prisma.condoInterest.findFirst.mockResolvedValue({ id: 'i0' })
    await service.create(body())
    expect(prisma.condoInterest.findFirst).toHaveBeenCalledWith({
      where: { groupKey: 'residencial sol|campinas', email: 'luciana@email.com' },
      select: { id: true },
    })
    expect(prisma.condoInterest.create).not.toHaveBeenCalled()
    expect(notifyAdmins).not.toHaveBeenCalled()
  })

  it('falha no aviso ao admin não derruba o pedido', async () => {
    const { service, prisma } = makeService()
    notifyAdmins.mockRejectedValue(new Error('onesignal fora'))
    await expect(service.create(body())).resolves.toBeUndefined()
    expect(prisma.condoInterest.create).toHaveBeenCalled()
  })
})

describe('CondoInterestsService — admin (A7)', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 'x',
    condoName: 'Residencial Sol',
    city: 'Campinas',
    groupKey: 'residencial sol|campinas',
    contactName: 'Fulano',
    email: null,
    phone: null,
    refCode: null,
    handledAt: null,
    createdAt: new Date('2026-09-20T12:00:00Z'),
    ...over,
  })

  it('agrupa, conta "por indicação" e põe em aberto primeiro, depois por nº de pedidos', async () => {
    const { service, prisma } = makeService()
    prisma.condoInterest.findMany.mockResolvedValue([
      row({ id: 'a1', groupKey: 'acacias|sumare', condoName: 'Vila das Acácias', city: 'Sumaré', handledAt: new Date(), createdAt: new Date('2026-09-26T12:00:00Z') }),
      row({ id: 's3', contactName: 'Luciana P.', email: 'luciana@email.com', refCode: 'JOAO7K2F', createdAt: new Date('2026-09-24T12:00:00Z') }),
      row({ id: 'b1', groupKey: 'bosque|valinhos', condoName: 'Residencial Bosque Azul', city: 'Valinhos', createdAt: new Date('2026-09-23T12:00:00Z') }),
      row({ id: 's2', contactName: 'Roberto K.', phone: '19981234400', refCode: 'ANA22222', createdAt: new Date('2026-09-22T12:00:00Z') }),
      row({ id: 's1', contactName: 'Camila V.', email: 'camila@email.com' }),
    ])
    const { groups } = await service.listGroups()
    expect(groups.map((g) => [g.name, g.count, g.viaReferral, g.handled])).toEqual([
      ['Residencial Sol', 3, 2, false],
      ['Residencial Bosque Azul', 1, 0, false],
      ['Vila das Acácias', 1, 0, true],
    ])
    expect(groups[0].contacts[0]).toEqual({
      id: 's3',
      name: 'Luciana P.',
      email: 'luciana@email.com',
      phone: null,
      createdAt: '2026-09-24T12:00:00.000Z',
      viaReferral: true,
    })
    expect(groups[0].lastAt).toBe('2026-09-24T12:00:00.000Z')
  })

  it('um pedido novo num grupo tratado o reabre sozinho', async () => {
    const { service, prisma } = makeService()
    prisma.condoInterest.findMany.mockResolvedValue([
      row({ id: 'novo', handledAt: null, createdAt: new Date('2026-09-28T12:00:00Z') }),
      row({ id: 'velho', handledAt: new Date('2026-09-25T12:00:00Z') }),
    ])
    expect((await service.listGroups()).groups[0].handled).toBe(false)
  })

  it('marcar e reabrir mexem no grupo inteiro; grupo inexistente → 404', async () => {
    const { service, prisma } = makeService()
    await service.setHandled('residencial sol|campinas', true)
    expect(prisma.condoInterest.updateMany).toHaveBeenLastCalledWith({
      where: { groupKey: 'residencial sol|campinas' },
      data: { handledAt: expect.any(Date) },
    })
    await service.setHandled('residencial sol|campinas', false)
    expect(prisma.condoInterest.updateMany).toHaveBeenLastCalledWith({
      where: { groupKey: 'residencial sol|campinas' },
      data: { handledAt: null },
    })
    prisma.condoInterest.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.setHandled('nada', true)).rejects.toMatchObject({ statusCode: 404 })
  })
})
