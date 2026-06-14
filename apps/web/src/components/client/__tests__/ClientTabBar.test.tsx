// ClientTabBar component tests -- Wave 0 stubs (RED state)
// Requirements: UI-08 (4 abas com labels corretos; aba ativa com cor diferente)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// import ClientTabBar from '../ClientTabBar'

describe('ClientTabBar [UI-08]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('renderizacao das abas', () => {
    it('TODO: renderiza exatamente 4 abas de navegacao', () => { expect(true).toBe(false) })
    it('TODO: aba "Inicio" esta presente com label correto', () => { expect(true).toBe(false) })
    it('TODO: aba "Agenda" esta presente com label correto', () => { expect(true).toBe(false) })
    it('TODO: aba "Creditos" esta presente com label correto', () => { expect(true).toBe(false) })
    it('TODO: aba "Perfil" esta presente com label correto', () => { expect(true).toBe(false) })
  })

  describe('estado ativo', () => {
    it('TODO: aba ativa recebe classe/cor diferente das abas inativas', () => { expect(true).toBe(false) })
    it('TODO: apenas uma aba esta ativa por vez', () => { expect(true).toBe(false) })
  })
})
