import { z } from 'zod'

/**
 * Tipos de notificação do ADMIN que possuem toggle individual (liga/desliga).
 * Fonte da verdade da ordem/lista exposta no GET e aceita no PUT.
 * Mantém paridade com os valores ADMIN_* do enum NotificationType (Prisma).
 */
export const ADMIN_NOTIFICATION_TYPES = [
  'ADMIN_ORDER_PLACED',
  'ADMIN_HOOK_REQUESTED',
  'ADMIN_DELIVERY_DONE',
  'ADMIN_DELIVERY_FAILED',
  'ADMIN_DELIVERY_PENDING',
  'ADMIN_ORDER_CANCELLED',
  'ADMIN_CREDIT_PURCHASED',
  'ADMIN_CUTOFF_REACHED',
  'ADMIN_AUTOGEN_WARNING',
  'ADMIN_AUTOGEN_DONE',
  'ADMIN_LOW_STOCK',
  // Alertas financeiros (⭐C1). Com toggle como todos os outros — um alerta que não se pode
  // desligar acaba desligado no sistema operacional, e aí some junto com os que importavam.
  'ADMIN_EXPENSE_DUE',
  'ADMIN_EXPENSE_ANOMALY',
  'ADMIN_MARGIN_DROP',
  'ADMIN_RESULT_NEGATIVE',
  'ADMIN_GOAL_AT_RISK',
  // Indique e Ganhe
  'ADMIN_REFERRAL_REVIEW',
  'ADMIN_REFERRAL_REWARDED',
  'ADMIN_CONDO_INTEREST',
  // App do entregador — todos nascem ligados.
  'ADMIN_COURIER_ISSUE',
  'ADMIN_COURIER_INCIDENT',
  'ADMIN_CONDO_ACCESS_SUGGESTION',
  'ADMIN_ROUTE_SUGGESTION',
  'ADMIN_PAYOUT_PENDING',
  // Termo do entregador: recusou o turno (plano-termos-legais §5) — nasce ligado.
  'ADMIN_SHIFT_DECLINED',
] as const

export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number]

/**
 * Tipos que nascem DESLIGADOS (D-14). A regra geral é "ausência = ligado" — mas "indicação
 * recompensada" é informativo e dispara a cada indicação que vale: ligado por padrão, viraria
 * ruído logo no primeiro dia. Para estes, só um `true` gravado liga.
 */
export const DEFAULT_OFF_ADMIN_NOTIFICATION_TYPES: ReadonlySet<string> = new Set(['ADMIN_REFERRAL_REWARDED'])

/**
 * O admin recebe este tipo? Fonte única do GET das preferências e do `notifyAdmins` — com duas
 * cópias, a tela mostraria "desligado" e o aviso chegaria mesmo assim.
 */
export function isAdminNotificationOn(
  stored: Record<string, boolean> | null | undefined,
  type: string,
): boolean {
  const value = stored?.[type]
  return DEFAULT_OFF_ADMIN_NOTIFICATION_TYPES.has(type) ? value === true : value !== false
}

/**
 * Body de PUT /admin/notification-prefs — mapa parcial { [type]: boolean }.
 * Só as chaves conhecidas são aceitas; chaves ausentes ficam no default (ligado).
 */
export const UpdatePrefsSchema = z
  .object(
    Object.fromEntries(
      ADMIN_NOTIFICATION_TYPES.map((t) => [t, z.boolean()]),
    ) as Record<AdminNotificationType, z.ZodBoolean>,
  )
  .partial()

export type UpdatePrefs = z.infer<typeof UpdatePrefsSchema>
