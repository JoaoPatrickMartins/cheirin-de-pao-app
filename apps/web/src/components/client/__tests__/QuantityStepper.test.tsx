// QuantityStepper component tests -- Wave 0 stubs (RED state)
// Requirements: UI-07 (stepper respeita min/max; botoes desabilitados nos limites)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// import QuantityStepper from '../QuantityStepper'

describe('QuantityStepper [UI-07]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('limites de valor', () => {
    it('TODO: value nao ultrapassa max quando botao + e pressionado no limite superior', () => { expect(true).toBe(false) })
    it('TODO: value nao cai abaixo de min quando botao - e pressionado no limite inferior', () => { expect(true).toBe(false) })
    it('TODO: value incrementa corretamente entre min e max', () => { expect(true).toBe(false) })
  })

  describe('estado dos botoes', () => {
    it('TODO: botao - esta desabilitado quando value == min', () => { expect(true).toBe(false) })
    it('TODO: botao + esta desabilitado quando value == max', () => { expect(true).toBe(false) })
    it('TODO: ambos os botoes habilitados quando value esta entre min e max', () => { expect(true).toBe(false) })
  })
})
