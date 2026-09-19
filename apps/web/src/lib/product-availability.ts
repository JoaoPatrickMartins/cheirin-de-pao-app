// Rótulos de disponibilidade de um produto da Cestinha — LADO ADMIN.
//
// O cliente nunca passa por aqui: para ele tudo é "Esgotado", e o backend já resolve isso num
// único `soldOut`. Este arquivo existe só para a tela do admin, que é a única que recebe estado,
// motivo e hora da volta — e é a única que precisa saber a diferença entre um produto que acabou
// e um que alguém derrubou.

/** Espelha o `availability` que `GET /admin/market/products` devolve. */
export interface ProductAvailability {
  state: 'inativo' | 'pausado' | 'esgotado' | 'ativo'
  reason: 'manual' | 'temporaria' | 'horario' | null
  /** ISO do instante da volta; null = sem previsão. */
  until: string | null
}

/** "HH:MM" de um ISO, no fuso do dispositivo (o admin opera em BRT). */
export function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Minutos que faltam até `iso` (mínimo 0). */
export function minutesUntil(iso: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60_000))
}

/** "12 min", "1h20", "2 dias" — a granularidade cai conforme o prazo cresce. */
export function humanDuration(minutes: number): string {
  if (minutes < 1) return 'menos de 1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
  const days = Math.round(hours / 24)
  return days === 1 ? '1 dia' : `${days} dias`
}

export interface AvailabilityBadge {
  label: string
  /** Texto de apoio (contagem regressiva / hora da volta); vazio quando não há. */
  detail: string
  color: string
  bg: string
}

/**
 * Pill de estado da lista de produtos. A ordem de prioridade já vem decidida pelo backend
 * (`availability.state`) — aqui é só tradução e cor.
 *
 * "Pausado" usa o par ouro/acento em vez do vermelho de erro de propósito: não é falha, é uma
 * decisão de alguém, e o admin precisa reconhecê-la de relance sem ler como alarme.
 */
export function availabilityBadge(
  a: ProductAvailability | undefined,
  now: Date,
  lowStock = false,
): AvailabilityBadge {
  const state = a?.state ?? 'ativo'

  if (state === 'inativo') {
    return { label: 'Inativo', detail: '', color: 'var(--color-text-ter)', bg: 'var(--color-surface-2)' }
  }

  if (state === 'pausado') {
    const gold = { color: 'var(--color-accent)', bg: 'var(--color-gold-soft, #F3DDA6)' }
    if (a?.reason === 'temporaria' && a.until) {
      return { label: 'Pausado', detail: humanDuration(minutesUntil(a.until, now)), ...gold }
    }
    if (a?.reason === 'horario') {
      return { label: 'Pausado', detail: a.until ? `volta ${hhmm(a.until)}` : 'por horário', ...gold }
    }
    return { label: 'Pausado', detail: 'até religar', ...gold }
  }

  if (state === 'esgotado') {
    return { label: 'Esgotado', detail: '', color: 'var(--color-accent)', bg: 'var(--color-gold-soft, #F3DDA6)' }
  }

  if (lowStock) {
    return { label: 'Baixo', detail: '', color: 'var(--color-accent)', bg: 'var(--color-gold-soft, #F3DDA6)' }
  }

  return { label: 'Ativo', detail: '', color: 'var(--color-good)', bg: 'var(--color-good-soft)' }
}

/**
 * Resumo do horário de VENDA para a lista do admin.
 *
 * `until` = fecha, `from` = reabre. Não dá para escrever "22:00–20:00" e esperar que alguém leia
 * certo: a janela pode cruzar a meia-noite, então o rótulo diz o verbo em vez do intervalo.
 */
export function windowLabel(from?: string | null, until?: string | null): string {
  if (until && from) return `fecha ${until} · reabre ${from}`
  if (until) return `fecha ${until}`
  if (from) return `reabre ${from}`
  return ''
}

/**
 * Frase pronta descrevendo quando a loja daquele produto está FECHADA. É o que o admin precisa
 * conferir de relance no formulário — "fecha 20:00 / reabre 22:00" é a regra; "fechado das 20:00
 * às 22:00" é a consequência, e é a consequência que ele quer validar.
 */
export function storeHoursSummary(from?: string | null, until?: string | null): string {
  if (!from && !until) return 'Sempre aberto.'
  if (until && from) return `Fechado das ${until} às ${from} · aberto o resto do dia.`
  if (until) return `Fechado das ${until} à meia-noite.`
  return `Fechado da meia-noite às ${from}.`
}
