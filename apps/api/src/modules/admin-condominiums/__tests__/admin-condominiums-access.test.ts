// A6 · Acesso para o entregador (Onda 8): salvar o acesso (vazio = sem dicas) e aplicar/descartar
// as sugestões dos entregadores — aplicar altera o `courierAccess`.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/geocode.js', () => ({ geocodeWithFallback: vi.fn() }))

import { AdminCondominiumsService } from '../admin-condominiums.service.js'

const access = { portaria: '24 h', temPorteiro: true, portao: 'Interfone 0', parar: null, obs: 'Cachorro no térreo', fotoUrl: null }

function setup(sug: Record<string, unknown> | null = { id: 's1', condominiumId: 'c1', courierId: 'k1', field: 'PORTAO', text: 'O interfone agora é 9', status: 'PENDING' }) {
  const prisma = {
    condominium: {
      findUnique: vi.fn(async () => ({ id: 'c1', name: 'Residencial Jardins', address: {}, lat: -23.5, lng: -46.6, courierAccess: access })),
      update: vi.fn(async ({ data }: { data: Record<string, any> }) => ({ id: 'c1', ...data })),
    },
    condoAccessSuggestion: {
      findUnique: vi.fn(async () => sug),
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    },
    user: { findMany: vi.fn(async () => []) },
  }
  return { prisma, service: new AdminCondominiumsService({ prisma, log: { warn: vi.fn() } } as never) }
}

describe('A6 · acesso', () => {
  it('salvar: campos vazios viram null; tudo vazio = sem dicas', async () => {
    const { prisma, service } = setup()
    await service.update('c1', { courierAccess: { portaria: '  ', portao: 'Tag na guarita', parar: '', obs: null } })
    expect(prisma.condominium.update.mock.calls[0][0].data.courierAccess).toEqual({ portaria: null, temPorteiro: null, portao: 'Tag na guarita', parar: null, obs: null, fotoUrl: null })
    await service.update('c1', { courierAccess: { portaria: '', portao: '' } })
    expect(prisma.condominium.update.mock.calls[1][0].data.courierAccess).toBeNull()
    await service.update('c1', { name: 'Jardins' })
    expect(prisma.condominium.update.mock.calls[2][0].data).not.toHaveProperty('courierAccess')
  })

  it('aplicar a sugestão troca o campo dela e marca APPLIED', async () => {
    const { prisma, service } = setup()
    const r = await service.applyAccessSuggestion('c1', 's1', 'adm1')
    expect(prisma.condominium.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { courierAccess: { ...access, portao: 'O interfone agora é 9' } } })
    expect(prisma.condoAccessSuggestion.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: expect.objectContaining({ status: 'APPLIED', reviewedById: 'adm1' }) })
    expect(r.courierAccess).toMatchObject({ portao: 'O interfone agora é 9' })
  })

  it('"Outro" soma às observações; descartar não mexe no acesso; revisada → 409', async () => {
    const outro = setup({ id: 's2', condominiumId: 'c1', courierId: 'k1', field: 'OUTRO', text: 'Portão lateral fechado aos domingos', status: 'PENDING' })
    await outro.service.applyAccessSuggestion('c1', 's2', 'adm1')
    expect(outro.prisma.condominium.update.mock.calls[0][0].data.courierAccess.obs).toBe('Cachorro no térreo · Portão lateral fechado aos domingos')

    const disc = setup()
    await disc.service.discardAccessSuggestion('c1', 's1', 'adm1')
    expect(disc.prisma.condoAccessSuggestion.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: expect.objectContaining({ status: 'DISCARDED' }) })
    expect(disc.prisma.condominium.update).not.toHaveBeenCalled()

    const done = setup({ id: 's1', condominiumId: 'c1', courierId: 'k1', field: 'PORTAO', text: 'x', status: 'APPLIED' })
    await expect(done.service.applyAccessSuggestion('c1', 's1', 'adm1')).rejects.toMatchObject({ statusCode: 409 })
    const other = setup({ id: 's1', condominiumId: 'c9', courierId: 'k1', field: 'PORTAO', text: 'x', status: 'PENDING' })
    await expect(other.service.discardAccessSuggestion('c1', 's1', 'adm1')).rejects.toMatchObject({ statusCode: 404 })
  })
})
