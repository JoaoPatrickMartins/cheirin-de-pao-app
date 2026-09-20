import { describe, it, expect } from 'vitest'
import {
  acceptsOrder,
  availabilityOf,
  isNovidadeVigente,
  isUnavailableForClient,
  isWithinStoreHours,
  nextOpening,
  sortVitrine,
  storeHoursBlock,
  vitrinePause,
  vitrineRank,
  type AvailabilityFields,
} from '../product-availability.js'

/** Date a partir de um horário BRT — "2026-09-20 09:59" BRT = 12:59 UTC. */
const brt = (dateStr: string, hhmm: string): Date => {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h + 3, m, 0, 0))
}

/** Relógio num horário do dia 20/09/2026 — o dia em si é irrelevante para o horário de venda. */
const at = (hhmm: string) => brt('2026-09-20', hhmm)

const product = (over: Partial<AvailabilityFields> = {}): AvailabilityFields => ({ ...over })

describe('product-availability', () => {
  // ── Horário de venda: relógio de loja ────────────────────────────────────
  //
  // A regressão que este bloco existe para impedir: antes de 19/09/2026 o horário era um corte
  // por ciclo de entrega, e um produto com "fecha 20:00" reabria às 22:00 (ou às 10:00, conforme
  // os turnos do condomínio) — nunca no horário configurado.
  describe('horário de venda', () => {
    describe('janela que CRUZA a meia-noite (fecha 20:00, reabre 22:00)', () => {
      const p = product({ availableUntil: '20:00', availableFrom: '22:00' })

      it('aberto antes de fechar', () => {
        expect(isWithinStoreHours(p, at('19:59'))).toBe(true)
      })

      it('fecha no minuto exato', () => {
        expect(isWithinStoreHours(p, at('20:00'))).toBe(false)
      })

      it('segue fechado até a reabertura', () => {
        expect(isWithinStoreHours(p, at('21:59'))).toBe(false)
      })

      it('reabre no minuto exato', () => {
        expect(isWithinStoreHours(p, at('22:00'))).toBe(true)
      })

      it('atravessa a madrugada ABERTO — o caso que a versão antiga errava', () => {
        expect(isWithinStoreHours(p, at('23:00'))).toBe(true)
        expect(isWithinStoreHours(p, at('00:00'))).toBe(true)
        expect(isWithinStoreHours(p, at('06:00'))).toBe(true)
        expect(isWithinStoreHours(p, at('10:00'))).toBe(true)
      })
    })

    describe('janela normal (fecha 20:00, reabre 06:00)', () => {
      const p = product({ availableUntil: '20:00', availableFrom: '06:00' })

      it('fechado da meia-noite até abrir', () => {
        expect(isWithinStoreHours(p, at('05:59'))).toBe(false)
        expect(isWithinStoreHours(p, at('06:00'))).toBe(true)
      })

      it('fechado a noite inteira depois de fechar', () => {
        expect(isWithinStoreHours(p, at('19:59'))).toBe(true)
        expect(isWithinStoreHours(p, at('20:00'))).toBe(false)
        expect(isWithinStoreHours(p, at('23:59'))).toBe(false)
      })
    })

    describe('só uma das pontas', () => {
      it('só fecha: aberto da meia-noite até a hora de fechar', () => {
        const p = product({ availableUntil: '20:00' })
        expect(isWithinStoreHours(p, at('00:00'))).toBe(true)
        expect(isWithinStoreHours(p, at('19:59'))).toBe(true)
        expect(isWithinStoreHours(p, at('20:00'))).toBe(false)
        expect(isWithinStoreHours(p, at('23:59'))).toBe(false)
      })

      it('só reabre: fechado da meia-noite até a hora de abrir', () => {
        const p = product({ availableFrom: '06:00' })
        expect(isWithinStoreHours(p, at('05:59'))).toBe(false)
        expect(isWithinStoreHours(p, at('06:00'))).toBe(true)
        expect(isWithinStoreHours(p, at('23:59'))).toBe(true)
      })
    })

    it('sem horário nenhum: sempre aberto', () => {
      expect(isWithinStoreHours(product(), at('03:00'))).toBe(true)
      expect(isWithinStoreHours(product(), at('20:00'))).toBe(true)
    })

    it('não depende de turno nem de data — é relógio', () => {
      // O mesmo produto, o mesmo horário, em dias diferentes: mesmo resultado.
      const p = product({ availableUntil: '20:00' })
      expect(isWithinStoreHours(p, brt('2026-09-20', '21:00'))).toBe(false)
      expect(isWithinStoreHours(p, brt('2026-12-25', '21:00'))).toBe(false)
      expect(isWithinStoreHours(p, brt('2027-03-01', '10:00'))).toBe(true)
    })
  })

  describe('hora da volta', () => {
    it('é a próxima ocorrência da reabertura, hoje', () => {
      const p = product({ availableUntil: '20:00', availableFrom: '22:00' })
      expect(nextOpening(p, at('20:30'))).toEqual(brt('2026-09-20', '22:00'))
    })

    it('é amanhã quando a reabertura do dia já passou', () => {
      const p = product({ availableUntil: '20:00', availableFrom: '06:00' })
      expect(nextOpening(p, at('21:00'))).toEqual(brt('2026-09-21', '06:00'))
    })

    it('sem reabertura própria, volta à meia-noite', () => {
      const p = product({ availableUntil: '20:00' })
      expect(nextOpening(p, at('21:00'))).toEqual(brt('2026-09-21', '00:00'))
    })

    it('sem horário nenhum não há o que reabrir', () => {
      expect(nextOpening(product(), at('21:00'))).toBeNull()
    })

    it('storeHoursBlock devolve bloqueio + volta', () => {
      const p = product({ availableUntil: '20:00', availableFrom: '22:00' })
      expect(storeHoursBlock(p, at('19:00'))).toEqual({ blocked: false, until: null })
      expect(storeHoursBlock(p, at('21:00'))).toEqual({
        blocked: true,
        until: brt('2026-09-20', '22:00'),
      })
    })
  })

  describe('pausa de vitrine', () => {
    const NOW = brt('2026-09-20', '09:00')

    it('pausa com prazo bloqueia e informa a volta', () => {
      const p = product({ pausedUntil: brt('2026-09-20', '09:30') })
      expect(vitrinePause(p, NOW)).toEqual({
        paused: true,
        reason: 'temporaria',
        until: brt('2026-09-20', '09:30'),
      })
    })

    it('pausa com prazo expirada não bloqueia', () => {
      const p = product({ pausedUntil: brt('2026-09-20', '08:30') })
      expect(vitrinePause(p, NOW).paused).toBe(false)
    })

    it('pausa sem prazo bloqueia sem previsão de volta', () => {
      const p = product({ isPaused: true })
      expect(vitrinePause(p, NOW)).toEqual({ paused: true, reason: 'manual', until: null })
    })

    it('pausa sem prazo tem precedência sobre um pausedUntil velho', () => {
      const p = product({ isPaused: true, pausedUntil: brt('2026-09-19', '10:00') })
      expect(vitrinePause(p, NOW).reason).toBe('manual')
    })

  })

  // ── Empilhamento ─────────────────────────────────────────────────────────
  describe('empilhamento pausa × horário', () => {
    it('expirada a pausa com prazo, o horário de venda volta a mandar', () => {
      const p = product({ availableUntil: '10:00', pausedUntil: brt('2026-09-20', '10:30') })
      const now = at('10:31')

      expect(vitrinePause(p, now).paused).toBe(false)
      expect(acceptsOrder(p, now)).toBe(false)

      const st = availabilityOf(p, { isActive: true, outOfStock: false }, now)
      expect(st).toMatchObject({ state: 'pausado', reason: 'horario' })
    })

    it('dentro do horário aberto, a pausa com prazo é o motivo relatado', () => {
      const p = product({ availableUntil: '18:00', pausedUntil: brt('2026-09-20', '10:30') })
      const st = availabilityOf(p, { isActive: true, outOfStock: false }, at('10:00'))
      expect(st).toMatchObject({ state: 'pausado', reason: 'temporaria' })
    })

    it('pausa manual bloqueia mesmo com a loja aberta', () => {
      const p = product({ isPaused: true, availableUntil: '20:00' })
      expect(acceptsOrder(p, at('10:00'))).toBe(false)
    })
  })

  describe('availabilityOf', () => {
    const NOW = brt('2026-09-20', '09:00')

    it('inativo tem precedência sobre tudo', () => {
      const p = product({ isPaused: true })
      expect(availabilityOf(p, { isActive: false, outOfStock: true }, NOW).state).toBe('inativo')
    })

    it('pausado tem precedência sobre esgotado', () => {
      const p = product({ isPaused: true })
      expect(availabilityOf(p, { isActive: true, outOfStock: true }, NOW).state).toBe('pausado')
    })

    it('esgotado quando não há pausa nem horário barrando', () => {
      expect(availabilityOf(product(), { isActive: true, outOfStock: true }, NOW).state).toBe('esgotado')
    })

    it('ativo no caso feliz', () => {
      expect(availabilityOf(product(), { isActive: true, outOfStock: false }, NOW).state).toBe('ativo')
    })

    it('fora do horário reporta motivo e hora da volta', () => {
      const p = product({ availableUntil: '08:00', availableFrom: '18:00' })
      const st = availabilityOf(p, { isActive: true, outOfStock: false }, NOW)
      expect(st).toEqual({
        state: 'pausado',
        reason: 'horario',
        until: brt('2026-09-20', '18:00').toISOString(),
      })
    })

    it('o horário funciona SEM depender de turno — era o buraco da versão antiga', () => {
      // Antes, condomínio sem turno ativo fazia o horário do produto virar no-op silencioso.
      const p = product({ availableUntil: '08:00' })
      expect(availabilityOf(p, { isActive: true, outOfStock: false }, NOW).state).toBe('pausado')
    })
  })

  describe('isUnavailableForClient', () => {
    const now = brt('2026-09-20', '11:00')

    it('colapsa as três causas em um booleano', () => {
      expect(isUnavailableForClient(product(), { outOfStock: true }, now)).toBe(true)
      expect(isUnavailableForClient(product({ isPaused: true }), { outOfStock: false }, now)).toBe(true)
      expect(isUnavailableForClient(product({ availableUntil: '10:00' }), { outOfStock: false }, now)).toBe(true)
      expect(isUnavailableForClient(product(), { outOfStock: false }, now)).toBe(false)
    })

    it('dentro do horário e com estoque, está disponível', () => {
      const p = product({ availableUntil: '20:00', availableFrom: '06:00' })
      expect(isUnavailableForClient(p, { outOfStock: false }, now)).toBe(false)
    })
  })

  describe('novidade', () => {
    const NOW = brt('2026-09-20', '09:00')

    it('vigente sem prazo (até eu remover)', () => {
      expect(isNovidadeVigente(product({ isNew: true }), NOW)).toBe(true)
    })

    it('vigente dentro do prazo', () => {
      expect(isNovidadeVigente(product({ isNew: true, newUntil: brt('2026-09-30', '00:00') }), NOW)).toBe(true)
    })

    it('expirada não vale mais', () => {
      expect(isNovidadeVigente(product({ isNew: true, newUntil: brt('2026-09-19', '00:00') }), NOW)).toBe(false)
    })

    it('desmarcada não vale, mesmo com prazo no futuro', () => {
      expect(isNovidadeVigente(product({ isNew: false, newUntil: brt('2026-09-30', '00:00') }), NOW)).toBe(false)
    })

    it('sobe as novidades vigentes preservando a ordem de cada balde', () => {
      const list = [
        { id: 'a' },
        { id: 'b', isNew: true, newUntil: brt('2026-09-19', '00:00') }, // expirada → fica embaixo
        { id: 'c', isNew: true },
        { id: 'd' },
        { id: 'e', isNew: true, newUntil: brt('2026-09-30', '00:00') },
      ]
      expect(sortVitrine(list, NOW).map((p) => p.id)).toEqual(['c', 'e', 'a', 'b', 'd'])
    })
  })

  // ── Ordem da vitrine: três degraus ───────────────────────────────────────

  describe('vitrineRank / sortVitrine', () => {
    const NOW = brt('2026-09-20', '09:00')
    const promoOn = { isPromo: true, promoType: 'PERCENT' as const, promoValue: 18 }

    it('novidade = 0, promoção destacada = 1, resto = 2', () => {
      expect(vitrineRank({ isNew: true }, NOW)).toBe(0)
      expect(vitrineRank({ ...promoOn, promoPriority: true }, NOW)).toBe(1)
      expect(vitrineRank({ ...promoOn }, NOW)).toBe(2)
      expect(vitrineRank({}, NOW)).toBe(2)
    })

    it('novidade ganha de promoção destacada', () => {
      expect(vitrineRank({ isNew: true, ...promoOn, promoPriority: true }, NOW)).toBe(0)
    })

    it('destaque sem promoção vigente não sobe', () => {
      // Flag de destaque sobrando de uma promoção que já venceu.
      expect(
        vitrineRank({ ...promoOn, promoPriority: true, promoUntil: brt('2026-09-19', '00:00') }, NOW),
      ).toBe(2)
    })

    it('promoção sem destaque fica no balde de baixo — selo sim, fila não', () => {
      expect(vitrineRank({ ...promoOn, promoPriority: false }, NOW)).toBe(2)
    })

    it('ordena os três baldes preservando a ordem dentro de cada um', () => {
      const list = [
        { id: 'catalogo1' },
        { id: 'promo1', ...promoOn, promoPriority: true },
        { id: 'novidade1', isNew: true },
        { id: 'catalogo2', ...promoOn }, // promoção SEM destaque
        { id: 'promo2', ...promoOn, promoPriority: true },
        { id: 'novidade2', isNew: true },
      ]
      expect(sortVitrine(list, NOW).map((p) => p.id)).toEqual([
        'novidade1',
        'novidade2',
        'promo1',
        'promo2',
        'catalogo1',
        'catalogo2',
      ])
    })
  })
})
