import { describe, it, expect } from 'vitest'
import {
  BANNER_LIMITS,
  bannerStatus,
  isWithinWindow,
  matchesAudience,
  passesFrequency,
  resolveActionUrl,
  selectForClient,
  sortByPriority,
  type BannerFields,
  type BannerViewFields,
} from '../banner-visibility.js'

/** Date a partir de um horário BRT — "2026-09-20 09:59" BRT = 12:59 UTC. */
const brt = (dateStr: string, hhmm: string): Date => {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h + 3, m, 0, 0))
}

const AGORA = brt('2026-09-20', '10:00')

const banner = (over: Partial<BannerFields> = {}): BannerFields => ({
  placement: 'POPUP',
  isActive: true,
  condominiumIds: [],
  frequency: 'DAILY',
  actionType: 'NONE',
  priority: 0,
  ...over,
})

const CONDO_A = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const CONDO_B = 'bbbbbbbbbbbbbbbbbbbbbbbb'

describe('banner-visibility', () => {
  // ── 1. Janela ────────────────────────────────────────────────────────────
  describe('janela de exibição', () => {
    it('sem datas, está no ar', () => {
      expect(isWithinWindow(banner(), AGORA)).toBe(true)
    })

    it('antes do início, não aparece', () => {
      const b = banner({ startsAt: brt('2026-09-20', '10:01') })
      expect(isWithinWindow(b, AGORA)).toBe(false)
    })

    it('exatamente no início, já aparece', () => {
      const b = banner({ startsAt: AGORA })
      expect(isWithinWindow(b, AGORA)).toBe(true)
    })

    // O fim é EXCLUSIVO: marcar 00:00 de 26/12 tem que matar o banner na virada, e não deixá-lo
    // sobreviver mais um dia inteiro.
    it('exatamente no fim, já NÃO aparece', () => {
      const b = banner({ endsAt: AGORA })
      expect(isWithinWindow(b, AGORA)).toBe(false)
    })

    it('depois do fim, não aparece', () => {
      const b = banner({ endsAt: brt('2026-09-19', '23:59') })
      expect(isWithinWindow(b, AGORA)).toBe(false)
    })

    it('dentro da janela fechada dos dois lados, aparece', () => {
      const b = banner({ startsAt: brt('2026-09-19', '00:00'), endsAt: brt('2026-09-21', '00:00') })
      expect(isWithinWindow(b, AGORA)).toBe(true)
    })

    it('desligado não aparece, mesmo dentro da janela', () => {
      const b = banner({ isActive: false, startsAt: brt('2026-09-19', '00:00') })
      expect(isWithinWindow(b, AGORA)).toBe(false)
    })
  })

  // ── 2. Status para o admin ───────────────────────────────────────────────
  describe('status na lista do admin', () => {
    it('no ar', () => {
      expect(bannerStatus(banner(), AGORA)).toBe('live')
    })

    it('agendado', () => {
      expect(bannerStatus(banner({ startsAt: brt('2026-09-21', '00:00') }), AGORA)).toBe('scheduled')
    })

    it('expirado', () => {
      expect(bannerStatus(banner({ endsAt: brt('2026-09-19', '00:00') }), AGORA)).toBe('expired')
    })

    it('pausado', () => {
      expect(bannerStatus(banner({ isActive: false }), AGORA)).toBe('paused')
    })

    // Desligado E vencido se descreve melhor como desligado: é a decisão de alguém, e é o que o
    // admin precisa reconhecer para desfazer.
    it('pausado vence expirado quando os dois valem', () => {
      const b = banner({ isActive: false, endsAt: brt('2026-09-19', '00:00') })
      expect(bannerStatus(b, AGORA)).toBe('paused')
    })
  })

  // ── 3. Público ───────────────────────────────────────────────────────────
  describe('público-alvo', () => {
    it('lista vazia vale para todos', () => {
      expect(matchesAudience(banner(), CONDO_A)).toBe(true)
    })

    it('lista vazia vale até para quem não tem condomínio', () => {
      expect(matchesAudience(banner(), null)).toBe(true)
    })

    it('segmentado acerta quem está na lista', () => {
      expect(matchesAudience(banner({ condominiumIds: [CONDO_A] }), CONDO_A)).toBe(true)
    })

    it('segmentado ignora quem está fora', () => {
      expect(matchesAudience(banner({ condominiumIds: [CONDO_A] }), CONDO_B)).toBe(false)
    })

    // Segmentar por condomínio e acertar quem não tem nenhum seria contradição.
    it('segmentado ignora cliente sem condomínio', () => {
      expect(matchesAudience(banner({ condominiumIds: [CONDO_A] }), null)).toBe(false)
    })
  })

  // ── 4. Frequência ────────────────────────────────────────────────────────
  describe('frequência do pop-up', () => {
    const view = (over: Partial<BannerViewFields> = {}): BannerViewFields => ({
      lastSeenAt: brt('2026-09-19', '10:00'),
      ...over,
    })

    it('sem histórico, sempre passa', () => {
      expect(passesFrequency(banner({ frequency: 'ONCE' }), null, AGORA)).toBe(true)
    })

    it('ONCE não repete depois de visto', () => {
      expect(passesFrequency(banner({ frequency: 'ONCE' }), view(), AGORA)).toBe(false)
    })

    it('DAILY volta no dia seguinte', () => {
      const v = view({ lastSeenAt: brt('2026-09-19', '23:00') })
      expect(passesFrequency(banner({ frequency: 'DAILY' }), v, AGORA)).toBe(true)
    })

    it('DAILY não repete no mesmo dia', () => {
      const v = view({ lastSeenAt: brt('2026-09-20', '07:00') })
      expect(passesFrequency(banner({ frequency: 'DAILY' }), v, AGORA)).toBe(false)
    })

    // A regressão que este teste impede: comparar em UTC. Às 22:00 BRT do dia 20 o servidor já
    // está no dia 21 em UTC, e um pop-up visto de manhã reapareceria à noite.
    it('DAILY usa o dia BRT, não o UTC (visto 22:00, checado 23:00 do mesmo dia)', () => {
      const v = view({ lastSeenAt: brt('2026-09-20', '22:00') })
      expect(passesFrequency(banner({ frequency: 'DAILY' }), v, brt('2026-09-20', '23:00'))).toBe(false)
    })

    it('DAILY vira na meia-noite BRT', () => {
      const v = view({ lastSeenAt: brt('2026-09-20', '23:30') })
      expect(passesFrequency(banner({ frequency: 'DAILY' }), v, brt('2026-09-21', '00:30'))).toBe(true)
    })

    it('ALWAYS repete sempre', () => {
      const v = view({ lastSeenAt: brt('2026-09-20', '09:59') })
      expect(passesFrequency(banner({ frequency: 'ALWAYS' }), v, AGORA)).toBe(true)
    })

    it('clique encerra o dia, mesmo em ALWAYS', () => {
      const v = view({ lastSeenAt: brt('2026-09-20', '09:00'), clickedAt: brt('2026-09-20', '09:00') })
      expect(passesFrequency(banner({ frequency: 'ALWAYS' }), v, AGORA)).toBe(false)
    })

    it('clique de ontem não bloqueia hoje (em ALWAYS)', () => {
      const v = view({ lastSeenAt: brt('2026-09-19', '09:00'), clickedAt: brt('2026-09-19', '09:00') })
      expect(passesFrequency(banner({ frequency: 'ALWAYS' }), v, AGORA)).toBe(true)
    })

    it('faixa e banner do mercadinho ignoram frequência', () => {
      const v = view({ lastSeenAt: AGORA, clickedAt: AGORA })
      expect(passesFrequency(banner({ placement: 'STRIP', frequency: 'ONCE' }), v, AGORA)).toBe(true)
      expect(passesFrequency(banner({ placement: 'MARKET', frequency: 'ONCE' }), v, AGORA)).toBe(true)
    })
  })

  // ── 5. Ação ──────────────────────────────────────────────────────────────
  describe('resolução da ação', () => {
    it('NONE não leva a lugar nenhum', () => {
      expect(resolveActionUrl(banner({ actionType: 'NONE' }))).toBeNull()
    })

    it('SCREEN resolve pela allowlist', () => {
      const b = banner({ actionType: 'SCREEN', actionScreen: 'creditos' })
      expect(resolveActionUrl(b)).toEqual({ url: '/client/creditos', external: false })
    })

    it('SCREEN fora da allowlist vira null', () => {
      const b = banner({ actionType: 'SCREEN', actionScreen: '/admin/gestao' })
      expect(resolveActionUrl(b)).toBeNull()
    })

    it('SCREEN sem tela vira null', () => {
      expect(resolveActionUrl(banner({ actionType: 'SCREEN' }))).toBeNull()
    })

    it('PRODUCT monta a rota do produto', () => {
      const b = banner({ actionType: 'PRODUCT', actionProductId: CONDO_A })
      expect(resolveActionUrl(b)).toEqual({ url: `/client/market/produto/${CONDO_A}`, external: false })
    })

    it('COMBO leva à tela de créditos com o combo marcado', () => {
      const b = banner({ actionType: 'COMBO', actionComboId: CONDO_B })
      expect(resolveActionUrl(b)).toEqual({ url: `/client/creditos?combo=${CONDO_B}`, external: false })
    })

    it('EXTERNAL aceita https', () => {
      const b = banner({ actionType: 'EXTERNAL', actionUrl: 'https://wa.me/5599999999999' })
      expect(resolveActionUrl(b)).toEqual({ url: 'https://wa.me/5599999999999', external: true })
    })

    // Um banner que não navega é um problema pequeno; um que navega para o lugar errado é um
    // problema de segurança. Por isso estes três viram null mesmo se escaparem do cadastro.
    it('EXTERNAL recusa http', () => {
      const b = banner({ actionType: 'EXTERNAL', actionUrl: 'http://exemplo.com' })
      expect(resolveActionUrl(b)).toBeNull()
    })

    it('EXTERNAL recusa javascript:', () => {
      const b = banner({ actionType: 'EXTERNAL', actionUrl: 'javascript:alert(1)' })
      expect(resolveActionUrl(b)).toBeNull()
    })

    it('EXTERNAL recusa URL vazia', () => {
      expect(resolveActionUrl(banner({ actionType: 'EXTERNAL', actionUrl: '   ' }))).toBeNull()
    })
  })

  // ── 6. Ordem e seleção ───────────────────────────────────────────────────
  describe('ordem e seleção', () => {
    const comId = (id: string, over: Partial<BannerFields> = {}) => ({ id, ...banner(over) })

    it('maior prioridade primeiro', () => {
      const lista = [comId('a', { priority: 1 }), comId('b', { priority: 5 }), comId('c', { priority: 3 })]
      expect(sortByPriority(lista).map((b) => b.id)).toEqual(['b', 'c', 'a'])
    })

    it('empate de prioridade resolve pelo mais novo', () => {
      const lista = [
        comId('velho', { priority: 1, createdAt: brt('2026-09-01', '10:00') }),
        comId('novo', { priority: 1, createdAt: brt('2026-09-18', '10:00') }),
      ]
      expect(sortByPriority(lista).map((b) => b.id)).toEqual(['novo', 'velho'])
    })

    it('não muta a lista recebida', () => {
      const lista = [comId('a', { priority: 1 }), comId('b', { priority: 5 })]
      sortByPriority(lista)
      expect(lista.map((b) => b.id)).toEqual(['a', 'b'])
    })

    it('pop-up entrega no máximo 1, o de maior prioridade', () => {
      const lista = [comId('a', { priority: 1 }), comId('b', { priority: 9 })]
      const out = selectForClient(lista, {
        placement: 'POPUP',
        condominiumId: CONDO_A,
        idOf: (b) => b.id,
      }, AGORA)
      expect(out.map((b) => b.id)).toEqual(['b'])
    })

    it('mercadinho entrega até 5, em ordem de prioridade', () => {
      const lista = [1, 2, 3, 4, 5, 6, 7].map((n) => comId(`b${n}`, { placement: 'MARKET', priority: n }))
      const out = selectForClient(lista, {
        placement: 'MARKET',
        condominiumId: CONDO_A,
        idOf: (b) => b.id,
      }, AGORA)
      expect(out.map((b) => b.id)).toEqual(['b7', 'b6', 'b5', 'b4', 'b3'])
      expect(out).toHaveLength(BANNER_LIMITS.MARKET)
    })

    it('aplica janela, público e frequência de uma vez', () => {
      const lista = [
        comId('expirado', { priority: 9, endsAt: brt('2026-09-01', '00:00') }),
        comId('outroCondo', { priority: 8, condominiumIds: [CONDO_B] }),
        comId('jaVisto', { priority: 7 }),
        comId('ok', { priority: 1 }),
      ]
      const out = selectForClient(lista, {
        placement: 'POPUP',
        condominiumId: CONDO_A,
        viewsByBanner: new Map([['jaVisto', { lastSeenAt: brt('2026-09-20', '08:00') }]]),
        idOf: (b) => b.id,
      }, AGORA)
      expect(out.map((b) => b.id)).toEqual(['ok'])
    })

    it('formato errado nunca entra', () => {
      const lista = [comId('faixa', { placement: 'STRIP', priority: 9 })]
      const out = selectForClient(lista, {
        placement: 'POPUP',
        condominiumId: CONDO_A,
        idOf: (b) => b.id,
      }, AGORA)
      expect(out).toEqual([])
    })
  })
})
