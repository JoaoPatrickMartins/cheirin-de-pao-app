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
] as const

export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number]

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
