/**
 * Rótulos e cores do gancho de porta — fonte única para a fila de ganchos (Gestão) e para o
 * histórico no detalhe do cliente. Duas cópias divergiriam na primeira vez que um tipo mudasse
 * de nome, e "Bônus" virar "Cortesia" só na fila é o tipo de inconsistência que ninguém reporta.
 */

export type HookType = 'FREE' | 'PAID' | 'BONUS'

/** Status da fila. O detalhe do cliente vê mais dois: ver `HookFullStatus`. */
export type HookStatus = 'REQUESTED' | 'DELIVERED'

/** Todos os status do HookRequest — o histórico do cliente mostra também os que não entram na fila. */
export type HookFullStatus = 'PENDING_PAYMENT' | HookStatus | 'CANCELLED'

interface Badge {
  label: string
  bg: string
  fg: string
}

export const HOOK_TYPE_BADGE: Record<HookType, Badge> = {
  FREE: { label: 'Grátis', bg: 'var(--color-good-soft)', fg: 'var(--color-good)' },
  PAID: { label: 'Pago', bg: 'var(--color-gold-soft)', fg: 'var(--color-accent)' },
  BONUS: { label: 'Bônus', bg: 'var(--color-surface-2)', fg: 'var(--color-text-sec)' },
}

export const HOOK_STATUS_BADGE: Record<HookFullStatus, Badge> = {
  PENDING_PAYMENT: { label: 'Aguardando pagamento', bg: 'var(--color-surface-2)', fg: 'var(--color-text-ter)' },
  REQUESTED: { label: 'Pendente', bg: 'var(--color-gold-soft)', fg: 'var(--color-accent)' },
  DELIVERED: { label: 'Entregue', bg: 'var(--color-good-soft)', fg: 'var(--color-good)' },
  CANCELLED: { label: 'Cancelado', bg: 'var(--color-surface-2)', fg: 'var(--color-text-ter)' },
}
