// Tipos e helpers do mini market "Além do Pãozin" (front cliente).
// O catálogo vem de GET /market/catalog; a precificação (avulsoUnit) de GET /pricing;
// o desconto máximo (selo "até X%") de GET /combos (economyPercent já calculado no backend).

export interface MarketCategory {
  id: string
  name: string
  emoji?: string | null
  sortOrder?: number | null
}

export interface MarketProduct {
  id: string
  name: string
  description?: string | null
  categoryId: string
  price: number
  photoUrl?: string | null
  /** Dias da semana em que o produto está disponível; [] = sempre. */
  availableDays: string[]
  /** Estoque FIXO zerado — visível no catálogo, não adicionável. */
  soldOut: boolean
  /** Estoque FIXO baixo — selo "Últimas". */
  limited: boolean
}

export interface MarketCatalog {
  categories: MarketCategory[]
  products: MarketProduct[]
}

// ── Cestinha (carrinho) — espelha o CartView do backend (GET/PUT /market/cart) ──
export interface CartLine {
  productId: string
  qty: number
  name: string
  price: number
  photoUrl: string | null
  categoryId: string
  lineTotal: number
  soldOut: boolean
}

export interface CartView {
  items: CartLine[]
  breadQty: number
  /** Σ dos produtos (R$). */
  productSubtotal: number
  /** Total da Cestinha (R$) = produtos + breadQty × avulsoUnit. Base do mínimo. */
  subtotal: number
  /** Σ das quantidades de produto (não inclui pães). */
  count: number
  avulsoUnit: number
  minimo: number
  meetsMinimum: boolean
}

/** Cestinha vazia (estado inicial antes do 1º fetch / sem sessão). */
export function emptyCart(): CartView {
  return {
    items: [],
    breadQty: 0,
    productSubtotal: 0,
    subtotal: 0,
    count: 0,
    avulsoUnit: 0,
    minimo: 0,
    meetsMinimum: false,
  }
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function formatBRL(value: number): string {
  return brl.format(value)
}

/** Equivalente em pãezinhos: 1 crédito resgata a valor avulso (`avulsoUnit`). */
export function paezinhosDe(price: number, avulsoUnit: number): number {
  if (!(avulsoUnit > 0) || !(price > 0)) return 0
  return Math.round(price / avulsoUnit)
}

// Rótulos curtos dos dias, na ordem da semana (para o aviso de disponibilidade).
export const WEEKDAY_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const
export const WEEKDAY_LABEL: Record<string, string> = {
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
  dom: 'Dom',
}

/** Lista os dias na ordem canônica da semana (ex.: "Seg, Qua, Sex"). */
export function formatAvailableDays(days: string[]): string {
  return WEEKDAY_ORDER.filter((d) => days.includes(d))
    .map((d) => WEEKDAY_LABEL[d])
    .join(', ')
}
