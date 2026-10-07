// Salvar o condomínio sem mexer no endereço não pode re-geocodificar — isso sobrescrevia
// coordenadas digitadas à mão e mexia no aviso de "localização aproximada".
import { describe, it, expect, vi, beforeEach } from 'vitest'

const geocodeWithFallback = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/geocode.js', () => ({ geocodeWithFallback }))
const syncDefaultRoute = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../../../lib/default-route.js', () => ({ syncDefaultRoute }))
vi.mock('../../../lib/delivery-slots.js', () => ({ getGlobalDeliverySlots: vi.fn(async () => []) }))

import { AdminCondominiumsService, sameAddress } from '../admin-condominiums.service.js'

const address = { street: 'Rua das Flores', number: '120', city: 'São Paulo', state: 'SP', zip: '01310100' }

function setup(existing: Record<string, unknown>) {
  const prisma = {
    condominium: {
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...existing, ...data })),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
      delete: vi.fn().mockResolvedValue(existing),
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new AdminCondominiumsService({ prisma, log: { warn: vi.fn(), error: vi.fn() } } as any)
  return { service, prisma }
}

describe('AdminCondominiumsService.update — coordenadas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    geocodeWithFallback.mockResolvedValue({ lat: -23.6, lng: -46.7, approximate: false })
  })

  it('mesmo endereço e coordenadas já salvas: não re-geocodifica nem mexe no aviso', async () => {
    const { service, prisma } = setup({ id: 'c1', address, lat: -23.5, lng: -46.6, approxLocation: true })

    await service.update('c1', { name: 'Novo nome', address: { ...address, street: ' rua das flores ', zip: '01310-100' } })

    expect(geocodeWithFallback).not.toHaveBeenCalled()
    const data = prisma.condominium.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('lat')
    expect(data).not.toHaveProperty('approxLocation')
  })

  it('endereço mudou: re-geocodifica e atualiza o aviso', async () => {
    const { service, prisma } = setup({ id: 'c1', address, lat: -23.5, lng: -46.6, approxLocation: true })

    await service.update('c1', { address: { ...address, number: '130' } })

    expect(geocodeWithFallback).toHaveBeenCalledTimes(1)
    expect(prisma.condominium.update.mock.calls[0][0].data).toMatchObject({ lat: -23.6, lng: -46.7, approxLocation: false })
  })

  it('sem coordenadas salvas: geocodifica mesmo com o endereço igual', async () => {
    const { service } = setup({ id: 'c1', address, lat: null, lng: null, approxLocation: false })

    await service.update('c1', { address })

    expect(geocodeWithFallback).toHaveBeenCalledTimes(1)
  })

  it('coordenadas manuais têm prioridade e tiram o aviso de aproximada', async () => {
    const { service, prisma } = setup({ id: 'c1', address, lat: -23.5, lng: -46.6, approxLocation: true })

    await service.update('c1', { address, lat: -23.55, lng: -46.65 })

    expect(geocodeWithFallback).not.toHaveBeenCalled()
    expect(prisma.condominium.update.mock.calls[0][0].data).toMatchObject({ lat: -23.55, lng: -46.65, approxLocation: false })
  })
})

describe('rota padrão (plano-rota-padrao): o cadastro dispara o encaixe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    geocodeWithFallback.mockResolvedValue({ lat: -23.6, lng: -46.7, approximate: false })
  })

  it('criar e remover sincronizam a rota', async () => {
    const { service } = setup({ id: 'c1', address, lat: -23.5, lng: -46.6, isActive: true })
    await service.create({ name: 'Novo', address, type: 'SINGLE_ENTRANCE' } as never)
    await service.remove('c1')
    expect(syncDefaultRoute).toHaveBeenCalledTimes(2)
    expect(syncDefaultRoute).toHaveBeenCalledWith(expect.anything(), { moved: undefined })
  })

  it('ativar/desativar sincroniza; só o nome não', async () => {
    const { service } = setup({ id: 'c1', address, lat: -23.5, lng: -46.6, isActive: true })
    await service.update('c1', { name: 'Outro nome' })
    expect(syncDefaultRoute).not.toHaveBeenCalled()
    await service.update('c1', { isActive: false })
    expect(syncDefaultRoute).toHaveBeenCalledWith(expect.anything(), { moved: undefined })
  })

  it('mudou de lugar: reencaixa (moved); ganhou a 1ª coordenada: entra como novo', async () => {
    const moved = setup({ id: 'c1', address, lat: -23.5, lng: -46.6, isActive: true })
    await moved.service.update('c1', { address: { ...address, number: '130' } })
    expect(syncDefaultRoute).toHaveBeenLastCalledWith(expect.anything(), { moved: ['c1'] })

    const located = setup({ id: 'c2', address, lat: null, lng: null, isActive: true })
    await located.service.update('c2', { address })
    expect(syncDefaultRoute).toHaveBeenLastCalledWith(expect.anything(), { moved: undefined })
  })

  it('mesmas coordenadas digitadas de novo: não sincroniza', async () => {
    const { service } = setup({ id: 'c1', address, lat: -23.55, lng: -46.65, isActive: true })
    await service.update('c1', { address, lat: -23.55, lng: -46.65 })
    expect(syncDefaultRoute).not.toHaveBeenCalled()
  })
})

describe('sameAddress', () => {
  it('ignora espaços, caixa e a pontuação do CEP', () => {
    expect(sameAddress(address, { ...address, city: ' SÃO PAULO ', zip: '01310-100' })).toBe(true)
  })
  it('complemento ausente e vazio são iguais; número diferente não', () => {
    expect(sameAddress({ ...address, complement: '' }, { ...address, complement: null })).toBe(true)
    expect(sameAddress(address, { ...address, number: '121' })).toBe(false)
    expect(sameAddress(address, null)).toBe(false)
  })
})
