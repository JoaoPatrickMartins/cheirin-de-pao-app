/**
 * banner-visibility.ts — quando um banner aparece, para quem, e para onde ele leva.
 *
 * Tudo aqui é DERIVADO de `now` na leitura — nada de cron escrevendo flag, nada de job noturno
 * expirando peça. Mesma escolha de `product-availability.ts`, e pelos mesmos motivos: não existe
 * minuto perdido em deploy ou queda, não precisa de backfill, a precisão é ao segundo e a regra
 * inteira é função pura com relógio injetável (logo, barata de testar).
 *
 * São TRÊS filtros independentes, e um banner só aparece quando passa nos três:
 *
 *   1. JANELA   (`isActive`, `startsAt`, `endsAt`) — a peça está no ar neste instante?
 *   2. PÚBLICO  (`condominiumIds`)                 — vale para este cliente?
 *   3. FREQUÊNCIA (`frequency` × BannerView)       — já mostrei demais para ele?
 *
 * O terceiro só existe para POPUP: faixa e banner do mercadinho são conteúdo de página, não
 * interrupção, e portanto não se "gastam".
 *
 * A resolução da AÇÃO também mora aqui, e é deliberadamente estrita: o cliente recebe uma URL
 * pronta e nunca o `actionType`. Ele não monta rota, não conhece a allowlist e não tem como ser
 * induzido a navegar para lugar nenhum — se o cadastro estiver inconsistente, a resposta é `null`
 * (banner sem ação), jamais um destino adivinhado.
 */

import { BANNER_SCREENS, type BannerScreenKey } from '@cheirin-de-pao/shared'
import { brtDateStr } from './cutoff.js'

/** Estado de um banner na visão do ADMIN. */
export type BannerStatus = 'live' | 'scheduled' | 'expired' | 'paused'

/**
 * Só os campos de ação — separados porque `resolveActionUrl` não precisa saber nem o formato nem
 * a janela da peça, e pedir o banner inteiro obrigaria quem chama a montar um objeto falso.
 */
export interface BannerActionFields {
  actionType?: 'NONE' | 'SCREEN' | 'PRODUCT' | 'COMBO' | 'EXTERNAL'
  actionScreen?: string | null
  actionProductId?: string | null
  actionComboId?: string | null
  actionUrl?: string | null
}

/** Os campos de um Banner que as regras deste arquivo leem. */
export interface BannerFields extends BannerActionFields {
  placement: 'POPUP' | 'STRIP' | 'MARKET'
  isActive: boolean
  startsAt?: Date | null
  endsAt?: Date | null
  condominiumIds?: string[]
  frequency?: 'ONCE' | 'DAILY' | 'ALWAYS'
  priority?: number
  createdAt?: Date
}

/** Os campos de um BannerView que a frequência lê. */
export interface BannerViewFields {
  lastSeenAt: Date
  clickedAt?: Date | null
}

/**
 * Quantas peças de cada formato o cliente pode receber de uma vez.
 *
 * POPUP é 1 por decisão de produto, não por limitação técnica: dois modais elegíveis viram dois
 * modais na cara de quem só queria ver o saldo. O desempate é `priority` (ver `sortByPriority`).
 */
export const BANNER_LIMITS: Record<BannerFields['placement'], number> = {
  POPUP: 1,
  STRIP: 1,
  // O mercadinho vira carrossel sozinho a partir da segunda peça. Cinco é o teto: o bastante
  // para variar, pouco o bastante para as últimas ainda serem vistas e para a vitrine não
  // carregar meia dúzia de imagens grandes antes dos produtos.
  MARKET: 5,
}

// ── 1. Janela de exibição ───────────────────────────────────────────────────

/**
 * A peça está no ar neste instante?
 *
 * `startsAt` ausente = já vale; `endsAt` ausente = não expira. O fim é EXCLUSIVO (`now < endsAt`):
 * marcar o fim às 00:00 de 26/12 faz o banner morrer na virada, não durar mais um dia.
 */
export function isWithinWindow(b: BannerFields, now: Date = new Date()): boolean {
  if (!b.isActive) return false
  if (b.startsAt && b.startsAt.getTime() > now.getTime()) return false
  if (b.endsAt && b.endsAt.getTime() <= now.getTime()) return false
  return true
}

/**
 * Estado consolidado para a lista do admin.
 *
 * Prioridade: pausado → expirado → agendado → no ar. "Pausado" vem primeiro porque é a decisão de
 * alguém, e é isso que o admin precisa reconhecer e desfazer; um banner desligado E vencido se
 * descreve melhor como desligado.
 */
export function bannerStatus(b: BannerFields, now: Date = new Date()): BannerStatus {
  if (!b.isActive) return 'paused'
  if (b.endsAt && b.endsAt.getTime() <= now.getTime()) return 'expired'
  if (b.startsAt && b.startsAt.getTime() > now.getTime()) return 'scheduled'
  return 'live'
}

// ── 2. Público-alvo ─────────────────────────────────────────────────────────

/**
 * A peça vale para este cliente?
 *
 * Lista VAZIA = todos. Com IDs = só esses condomínios. Cliente sem condomínio (cadastro
 * incompleto) recebe apenas os banners de lista vazia — segmentar por condomínio e acertar quem
 * não tem nenhum seria contradição.
 */
export function matchesAudience(b: BannerFields, condominiumId: string | null | undefined): boolean {
  const ids = b.condominiumIds ?? []
  if (ids.length === 0) return true
  if (!condominiumId) return false
  return ids.includes(condominiumId)
}

// ── 3. Frequência (só POPUP) ────────────────────────────────────────────────

/**
 * Este cliente pode ver este pop-up agora?
 *
 * A comparação de "hoje" é em BRT (`brtDateStr`), nunca em UTC: entre 21:00 e 00:00 de Brasília o
 * servidor já virou o dia, e um pop-up diário reapareceria à noite para quem o viu de manhã.
 *
 * CLIQUE encerra o dia em qualquer frequência — quem já foi para o destino não precisa do convite
 * de novo. DISPENSAR (X) não: conta como visto, então um `DAILY` dispensado hoje volta amanhã.
 */
export function passesFrequency(
  b: BannerFields,
  view: BannerViewFields | null | undefined,
  now: Date = new Date(),
): boolean {
  // Faixa e banner do mercadinho são conteúdo de página: não se gastam.
  if (b.placement !== 'POPUP') return true
  if (!view) return true

  const hoje = brtDateStr(now)
  if (view.clickedAt && brtDateStr(view.clickedAt) === hoje) return false

  switch (b.frequency ?? 'DAILY') {
    case 'ONCE':
      return false // já existe view = já viu uma vez, e uma vez era o combinado
    case 'ALWAYS':
      return true
    case 'DAILY':
    default:
      return brtDateStr(view.lastSeenAt) !== hoje
  }
}

// ── 4. Ação ao clicar ───────────────────────────────────────────────────────

export interface BannerAction {
  url: string
  /** true = sai do app (abre em aba nova). false = rota interna do react-router. */
  external: boolean
}

/**
 * A URL final da peça — ou `null` quando ela não leva a lugar nenhum (aviso puro).
 *
 * Estrito de propósito: cadastro inconsistente (tipo SCREEN sem tela, chave fora da allowlist,
 * link `http://`) vira `null`, nunca um palpite. Um banner que não navega é um problema pequeno;
 * um banner que navega para o lugar errado é um problema de segurança.
 */
export function resolveActionUrl(b: BannerActionFields): BannerAction | null {
  switch (b.actionType) {
    case 'SCREEN': {
      const key = b.actionScreen as BannerScreenKey | null | undefined
      if (!key || !(key in BANNER_SCREENS)) return null
      return { url: BANNER_SCREENS[key].route, external: false }
    }
    case 'PRODUCT':
      if (!b.actionProductId) return null
      return { url: `/client/market/produto/${b.actionProductId}`, external: false }
    case 'COMBO':
      // A tela de créditos é uma lista; o `?combo=` faz ela rolar até o card e realçá-lo.
      if (!b.actionComboId) return null
      return { url: `/client/creditos?combo=${b.actionComboId}`, external: false }
    case 'EXTERNAL':
      // Só https. `http://` e qualquer esquema exótico (javascript:, data:) caem fora aqui,
      // mesmo que tenham escapado da validação de cadastro.
      if (!b.actionUrl || !/^https:\/\/\S+$/i.test(b.actionUrl)) return null
      return { url: b.actionUrl, external: true }
    case 'NONE':
    default:
      return null
  }
}

// ── 5. Seleção ──────────────────────────────────────────────────────────────

/**
 * Ordena as peças de um formato: maior `priority` primeiro; empate resolvido pela mais NOVA.
 *
 * O desempate por data importa mais do que parece: sem ele, dois banners de mesma prioridade
 * alternariam conforme a ordem que o banco devolvesse, e o admin veria o pop-up "mudando sozinho"
 * sem ter mexido em nada.
 */
export function sortByPriority<T extends BannerFields>(banners: T[]): T[] {
  return [...banners].sort((a, b) => {
    const byPriority = (b.priority ?? 0) - (a.priority ?? 0)
    if (byPriority !== 0) return byPriority
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  })
}

/**
 * O filtro completo de um formato, na ordem certa e já com o teto aplicado — é esta função que o
 * serviço do cliente chama, para que a regra viva num lugar só.
 */
export function selectForClient<T extends BannerFields>(
  banners: T[],
  opts: {
    placement: BannerFields['placement']
    condominiumId: string | null | undefined
    /** View do cliente por bannerId; só consultada para POPUP. */
    viewsByBanner?: Map<string, BannerViewFields>
    /** Como obter o id de um banner (o serviço passa `b => b.id`). */
    idOf: (b: T) => string
  },
  now: Date = new Date(),
): T[] {
  const elegiveis = banners.filter(
    (b) =>
      b.placement === opts.placement &&
      isWithinWindow(b, now) &&
      matchesAudience(b, opts.condominiumId) &&
      passesFrequency(b, opts.viewsByBanner?.get(opts.idOf(b)) ?? null, now),
  )
  return sortByPriority(elegiveis).slice(0, BANNER_LIMITS[opts.placement])
}
