// Veículo do entregador (A3): GNV só no carro e o consumo na unidade do combustível (Onda 11 · T-36).
import { describe, it, expect } from 'vitest'
import { VehicleSchema } from '../admin-couriers.schema.js'

const issues = (v: unknown) => {
  const r = VehicleSchema.safeParse(v)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe('VehicleSchema', () => {
  it('GNV vale no carro e é recusado na moto', () => {
    expect(issues({ tipo: 'CARRO', combustivel: 'GNV', kmPorLitro: 12 })).toEqual([])
    expect(issues({ tipo: 'MOTO', combustivel: 'GNV', kmPorLitro: 12 })).toEqual(['GNV só para carro'])
  })

  it('consumo fora de 1..100 com a unidade do combustível', () => {
    expect(issues({ tipo: 'CARRO', combustivel: 'GNV', kmPorLitro: 150 })).toEqual(['Consumo entre 1 e 100 km/m³'])
    expect(issues({ tipo: 'MOTO', combustivel: 'FLEX', kmPorLitro: 0.5 })).toEqual(['Consumo entre 1 e 100 km/l'])
    expect(issues({ tipo: 'BIKE' })).toEqual([])
  })
})
