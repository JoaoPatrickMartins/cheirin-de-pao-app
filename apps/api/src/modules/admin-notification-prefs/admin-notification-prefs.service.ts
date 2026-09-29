import { FastifyInstance } from 'fastify'
import {
  ADMIN_NOTIFICATION_TYPES,
  isAdminNotificationOn,
  type AdminNotificationType,
  type UpdatePrefs,
} from './admin-notification-prefs.schema.js'

export type PrefsMap = Record<AdminNotificationType, boolean>

/**
 * AdminNotificationPrefsService — toggles de notificação por admin.
 *
 * Persistência: campo Json `User.adminNotificationPrefs` = mapa `{ [type]: boolean }`.
 * Ausência/null = tudo LIGADO, menos os tipos de `DEFAULT_OFF_ADMIN_NOTIFICATION_TYPES`. O GET sempre devolve o mapa completo (defaults=true)
 * para a UI renderizar todos os switches sem precisar conhecer os defaults.
 */
export class AdminNotificationPrefsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Preenche o mapa completo (todos os tipos). Chave ausente = ligado, exceto os tipos que nascem
   * desligados (D-14) — ver `isAdminNotificationOn`.
   */
  private fill(stored: Record<string, boolean> | null | undefined): PrefsMap {
    const out = {} as PrefsMap
    for (const t of ADMIN_NOTIFICATION_TYPES) {
      out[t] = isAdminNotificationOn(stored, t)
    }
    return out
  }

  /** Retorna o mapa completo de preferências do admin. */
  async getPrefs(adminId: string): Promise<PrefsMap> {
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { adminNotificationPrefs: true },
    })
    return this.fill((user?.adminNotificationPrefs ?? null) as Record<string, boolean> | null)
  }

  /**
   * Aplica um patch parcial de toggles e retorna o mapa completo resultante.
   * Faz merge com o que já existe (não zera chaves não enviadas).
   */
  async setPrefs(adminId: string, patch: UpdatePrefs): Promise<PrefsMap> {
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { adminNotificationPrefs: true },
    })
    const current = (user?.adminNotificationPrefs ?? {}) as Record<string, boolean>
    const merged = { ...current, ...patch }

    await this.prisma.user.update({
      where: { id: adminId },
      data: { adminNotificationPrefs: merged },
    })
    return this.fill(merged)
  }
}
