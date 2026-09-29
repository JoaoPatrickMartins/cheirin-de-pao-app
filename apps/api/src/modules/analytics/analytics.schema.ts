import { z } from 'zod'

/**
 * TrackEventSchema — validação do corpo de POST /analytics/event (rota pública).
 *
 * `ref`       — código de indicação da carga (só em access; ver abaixo)
 *
 * `type`      — 'access' (abertura do app) ou 'login' (login efetuado)
 * `visitorId` — ID anônimo do dispositivo (device_id do cliente)
 * `userId`    — só em login; validado como ObjectId no service antes de persistir
 * `role`      — só em login
 */
export const TrackEventSchema = z.object({
  type: z.enum(['access', 'login']),
  visitorId: z.string().min(1).max(128),
  userId: z.string().max(64).optional(),
  role: z.enum(['CLIENT', 'COURIER', 'ADMIN']).optional(),
  path: z.string().max(512).optional(),
  referrer: z.string().max(1024).optional(),
  platform: z.enum(['pwa', 'browser']).optional(),
  /**
   * Indique e Ganhe: código do `?ref=` capturado NESTA carga — a 1ª etapa do funil (V-21).
   * `.catch(undefined)`: um código adulterado só é descartado; o evento de acesso nunca vira 400.
   */
  ref: z.string().max(40).optional().catch(undefined),
})

export type TrackEvent = z.infer<typeof TrackEventSchema>
