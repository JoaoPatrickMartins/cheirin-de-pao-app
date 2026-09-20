import { z } from 'zod'
import { ObjectIdSchema } from './index'

// Schemas dos banners, avisos e promoções. Fonte única (backend valida com .parse; o admin reusa
// as mesmas regras e rótulos). Os tipos são inferidos via z.infer no fim do arquivo.
//
// Ver o plano em .projeto/docs/plano-banners-avisos.md.

// ── Enums (espelham os enums Prisma) ──────────────────────────────────────
export const BANNER_PLACEMENTS = ['POPUP', 'STRIP', 'MARKET'] as const
export const BannerPlacementSchema = z.enum(BANNER_PLACEMENTS)

export const BANNER_ACTION_TYPES = ['NONE', 'SCREEN', 'PRODUCT', 'COMBO', 'EXTERNAL'] as const
export const BannerActionTypeSchema = z.enum(BANNER_ACTION_TYPES)

export const BANNER_FREQUENCIES = ['ONCE', 'DAILY', 'ALWAYS'] as const
export const BannerFrequencySchema = z.enum(BANNER_FREQUENCIES)

/**
 * ALLOWLIST de destinos internos — a única forma de um banner navegar dentro do app.
 *
 * Mora aqui (e não no back) porque as três pontas precisam dela: o Zod valida contra as chaves,
 * o formulário do admin monta o `<select>` com os rótulos, e a API resolve a rota final. Rota
 * nunca chega como texto digitado: o admin escolhe "Comprar créditos", não "/client/creditos".
 *
 * As rotas espelham apps/web/src/routes/router.tsx — ao mexer lá, conferir aqui.
 */
export const BANNER_SCREENS = {
  home: { route: '/client/home', label: 'Início' },
  creditos: { route: '/client/creditos', label: 'Comprar créditos' },
  recorrente: { route: '/client/creditos/recorrente', label: 'Recarga automática' },
  agenda: { route: '/client/agenda', label: 'Minha agenda' },
  pedidoUnico: { route: '/client/agenda/pedido-unico', label: 'Pedido único' },
  pedidos: { route: '/client/pedidos', label: 'Meus pedidos' },
  market: { route: '/client/market', label: 'Além do Pãozin' },
  cestinha: { route: '/client/market/cestinha', label: 'Minha Cestinha' },
  gancho: { route: '/client/perfil/gancho', label: 'Gancho de porta' },
} as const

export type BannerScreenKey = keyof typeof BANNER_SCREENS
const SCREEN_KEYS = Object.keys(BANNER_SCREENS) as [BannerScreenKey, ...BannerScreenKey[]]
export const BannerScreenSchema = z.enum(SCREEN_KEYS)

/**
 * Proporção (largura ÷ altura) da arte de cada formato. O crop do admin trava nestes valores e o
 * preview usa os mesmos — é o que impede uma peça esticada chegar ao cliente.
 * STRIP não aparece aqui de propósito: faixa de aviso não tem imagem.
 */
export const BANNER_ASPECT = { POPUP: 4 / 5, MARKET: 3 / 1 } as const

/** Rótulo de cada formato, para a UI do admin. */
export const BANNER_PLACEMENT_LABEL: Record<(typeof BANNER_PLACEMENTS)[number], string> = {
  POPUP: 'Pop-up de abertura',
  STRIP: 'Faixa de aviso',
  MARKET: 'Banner do mercadinho',
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

// ── Banner ────────────────────────────────────────────────────────────────
// Objeto CRU, sem as regras cruzadas. Existe separado porque `.partial()` não funciona depois de
// um `.superRefine()` — o PATCH precisa deste, e as regras cruzadas são aplicadas ao objeto já
// MESCLADO (atual + patch) no serviço. Validar o patch isolado deixaria passar, por exemplo,
// trocar o formato para STRIP mantendo a imagem gravada.
export const BannerBaseSchema = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao banner').max(60, 'Nome muito longo (máx. 60)'),
  placement: BannerPlacementSchema,

  imageUrl: z.string().url('Imagem inválida').nullable().optional(),
  alt: z.string().trim().max(120, 'Descrição muito longa (máx. 120)').nullable().optional(),

  title: z.string().trim().max(60, 'Título muito longo (máx. 60)').nullable().optional(),
  body: z.string().trim().max(140, 'Texto muito longo (máx. 140)').nullable().optional(),
  bgColor: z.string().regex(HEX_RE, 'Cor inválida (use #RRGGBB)').nullable().optional(),

  ctaLabel: z.string().trim().max(24, 'Rótulo muito longo (máx. 24)').nullable().optional(),
  actionType: BannerActionTypeSchema.default('NONE'),
  actionScreen: BannerScreenSchema.nullable().optional(),
  actionProductId: ObjectIdSchema.nullable().optional(),
  actionComboId: ObjectIdSchema.nullable().optional(),
  actionUrl: z.string().trim().max(500, 'Link muito longo').nullable().optional(),

  frequency: BannerFrequencySchema.default('DAILY'),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(999).default(0),

  // Vazio = todos os clientes. Com IDs = só clientes desses condomínios.
  condominiumIds: z.array(ObjectIdSchema).default([]),
})

type BannerBase = z.infer<typeof BannerBaseSchema>

/**
 * As regras que dependem de mais de um campo. Ficam numa função só porque tanto a criação quanto
 * a edição (sobre o objeto mesclado) precisam exatamente delas.
 */
function bannerRefine(d: BannerBase, ctx: z.RefinementCtx): void {
  const fail = (path: string, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message })

  // Conteúdo — cada formato pede uma coisa, e proíbe a do outro.
  if (d.placement === 'STRIP') {
    if (!d.title?.trim()) fail('title', 'A faixa de aviso precisa de um título.')
    if (d.imageUrl) fail('imageUrl', 'A faixa de aviso não usa imagem.')
  } else {
    if (!d.imageUrl) fail('imageUrl', 'Envie a arte do banner.')
    // Sem alt, quem usa leitor de tela recebe um banner mudo — e, se a imagem falhar, ninguém
    // recebe nada. Por isso é bloqueio, não aviso.
    if (!d.alt?.trim()) fail('alt', 'Descreva a imagem — é o que o leitor de tela anuncia.')
  }

  // Ação — cada tipo exige o seu campo, e só EXTERNAL tem texto livre.
  if (d.actionType === 'SCREEN' && !d.actionScreen) {
    fail('actionScreen', 'Escolha a tela de destino.')
  }
  if (d.actionType === 'PRODUCT' && !d.actionProductId) {
    fail('actionProductId', 'Escolha o produto de destino.')
  }
  if (d.actionType === 'COMBO' && !d.actionComboId) {
    fail('actionComboId', 'Escolha o combo de destino.')
  }
  if (d.actionType === 'EXTERNAL' && !/^https:\/\/\S+$/i.test(d.actionUrl ?? '')) {
    fail('actionUrl', 'O link externo precisa começar com https://')
  }

  // Janela — um fim antes do início nunca apareceria, e o admin não descobriria por quê.
  if (d.startsAt && d.endsAt && d.startsAt.getTime() >= d.endsAt.getTime()) {
    fail('endsAt', 'O fim precisa ser depois do início.')
  }
}

export const CreateBannerSchema = BannerBaseSchema.superRefine(bannerRefine)

// PATCH: campos soltos, SEM as regras cruzadas. O serviço mescla com o banner gravado e roda
// `CreateBannerSchema.parse()` no resultado — é lá que as regras acima valem.
export const UpdateBannerSchema = BannerBaseSchema.partial()

// ── Telemetria (cliente) ──────────────────────────────────────────────────
export const BANNER_EVENTS = ['seen', 'click', 'dismiss'] as const
export const BannerEventSchema = z.enum(BANNER_EVENTS)

// ── Tipos ─────────────────────────────────────────────────────────────────
export type BannerPlacement = z.infer<typeof BannerPlacementSchema>
export type BannerActionType = z.infer<typeof BannerActionTypeSchema>
export type BannerFrequency = z.infer<typeof BannerFrequencySchema>
export type BannerEvent = z.infer<typeof BannerEventSchema>
export type CreateBannerInput = z.infer<typeof CreateBannerSchema>
export type UpdateBannerInput = z.infer<typeof UpdateBannerSchema>
