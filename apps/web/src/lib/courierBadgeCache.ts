import type { CourierMe } from './courierApi'

/**
 * Crachá v3 guardado no aparelho (plano do entregador, Onda 11 · H-11/T-27): o perfil do
 * `/courier/me`, o segredo do QR e a diferença para a hora do servidor (T-26). Atualizado sempre que
 * há sinal; sem sinal, o crachá abre com o status da última vez. O Sair apaga tudo.
 *
 * Um PWA não tem Keychain: o segredo fica no `localStorage` do aparelho. Ele só gera o código do
 * próprio entregador, e a validação (futuro perfil Portaria) confere no servidor se ele está ativo.
 * Toda leitura/escrita é protegida: navegador privado ou sem armazenamento segue sem cache.
 */
export interface CourierBadgeCache {
  me: CourierMe | null
  /** null = crachá inativo/vencido (não gera QR) ou ainda não baixado. */
  secret: string | null
  /** hora do servidor − hora do aparelho, em ms. */
  offsetMs: number
  savedAt: string
}

const PREFIX = 'cdp:courier-badge:'

export function loadBadgeCache(courierId: string | null): CourierBadgeCache | null {
  if (!courierId) return null
  try {
    const raw = localStorage.getItem(PREFIX + courierId)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<CourierBadgeCache>
    return { me: v.me ?? null, secret: typeof v.secret === 'string' ? v.secret : null, offsetMs: Number(v.offsetMs) || 0, savedAt: v.savedAt ?? '' }
  } catch {
    return null
  }
}

/** Junta com o que já está guardado (o perfil e o segredo chegam por chamadas diferentes). */
export function saveBadgeCache(courierId: string | null, patch: Partial<Omit<CourierBadgeCache, 'savedAt'>>, now: Date = new Date()): void {
  if (!courierId) return
  try {
    const cur = loadBadgeCache(courierId) ?? { me: null, secret: null, offsetMs: 0, savedAt: '' }
    localStorage.setItem(PREFIX + courierId, JSON.stringify({ ...cur, ...patch, savedAt: now.toISOString() }))
  } catch {
    // sem armazenamento: o crachá só abre com sinal
  }
}

/** Sair do app: apaga o crachá de todos os entregadores deste aparelho. */
export function clearBadgeCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k)
    }
  } catch {
    // nada a apagar
  }
}
