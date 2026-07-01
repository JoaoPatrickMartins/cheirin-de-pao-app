// Flags de primeiro acesso (por conta) — onboarding.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  hasSeenOnboarding,
  slidesDone,
  markSlidesDone,
  markOnboardingSeen,
  resetOnboarding,
  getTourStep,
  setTourStep,
} from '../onboarding'

describe('lib/onboarding', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('hasSeenOnboarding: false quando ausente, true após markOnboardingSeen', () => {
    expect(hasSeenOnboarding('u1')).toBe(false)
    markOnboardingSeen('u1')
    expect(hasSeenOnboarding('u1')).toBe(true)
  })

  it('slidesDone reflete markSlidesDone', () => {
    expect(slidesDone('u1')).toBe(false)
    markSlidesDone('u1')
    expect(slidesDone('u1')).toBe(true)
  })

  it('markOnboardingSeen limpa as chaves intermediárias (slides/step)', () => {
    markSlidesDone('u1')
    setTourStep('u1', 3)
    markOnboardingSeen('u1')
    expect(slidesDone('u1')).toBe(false)
    expect(getTourStep('u1')).toBe(0)
    expect(hasSeenOnboarding('u1')).toBe(true)
  })

  it('getTourStep/setTourStep faz round-trip', () => {
    expect(getTourStep('u1')).toBe(0)
    setTourStep('u1', 4)
    expect(getTourStep('u1')).toBe(4)
  })

  it('resetOnboarding limpa tudo (re-disparo manual)', () => {
    markOnboardingSeen('u1')
    markSlidesDone('u1')
    setTourStep('u1', 2)
    resetOnboarding('u1')
    expect(hasSeenOnboarding('u1')).toBe(false)
    expect(slidesDone('u1')).toBe(false)
    expect(getTourStep('u1')).toBe(0)
  })

  it('chaves são independentes por usuário', () => {
    markOnboardingSeen('u1')
    expect(hasSeenOnboarding('u1')).toBe(true)
    expect(hasSeenOnboarding('u2')).toBe(false)
  })

  it('se o localStorage lançar, getters retornam true (nunca bloqueia)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    expect(hasSeenOnboarding('u1')).toBe(true)
    expect(slidesDone('u1')).toBe(true)
  })
})
