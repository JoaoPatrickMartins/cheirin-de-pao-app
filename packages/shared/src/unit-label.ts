/**
 * Rótulo da unidade do cliente (bloco · complemento · apartamento) — fonte única do front e da API.
 *
 * Antes disto existiam sete cópias de `blockLabel()` e uma dúzia de composições ad-hoc
 * ("Bl A · Apto 12", "Bloco A · Apto 12", "A — Apto 12"). Com o complemento entrando na linha,
 * cada cópia viraria uma divergência a mais: o cupom impresso, a rota do entregador e a tela de
 * entregas precisam dizer a MESMA coisa — é o endereço em que alguém vai bater na porta.
 *
 * O complemento é a subdivisão do bloco ("Lado A"), curto de propósito: cabe na térmica de 80mm
 * e no rótulo compacto das listas.
 */

/** Limite do complemento. Curto porque é subbloco ("Lado A"), não endereço livre. */
export const COMPLEMENT_MAX_LENGTH = 10

export interface UnitParts {
  block?: string | null
  complement?: string | null
  apartment?: string | null
}

export interface UnitLabelOptions {
  /**
   * Como o bloco entra na linha:
   * - `full` (padrão) → "Bloco A"
   * - `compact`       → "Bl A"
   * - `bare`          → "A" (a tela já diz que aquilo é um bloco)
   * - `omit`          → não mostra (lista já agrupada por bloco)
   */
  block?: 'full' | 'compact' | 'bare' | 'omit'
  /** Rótulo do apartamento. Padrão "Apto"; `''` devolve só o número. */
  apartmentLabel?: string
  /** Separador entre bloco e complemento. Padrão " · ". */
  separator?: string
  /** Separador antes do apartamento. Padrão = `separator`. */
  apartmentSeparator?: string
  /**
   * Texto quando não há apartamento. Padrão "—"; `''` remove o segmento inteiro em vez de
   * imprimir um "Apto " solto (linha do entregador e do detalhamento por condomínio).
   */
  emptyApartment?: string
}

/**
 * Evita duplicar a palavra: "B" → "Bloco B"; "Bloco 2" → "Bloco 2".
 * O valor gravado varia (o cadastro grava "1 ou A", o admin pode digitar "Bloco 2").
 *
 * Devolve '' quando não há bloco — inclusive para o travessão, que algumas telas usam como
 * CHAVE do grupo "sem bloco". Quem exibe decide o texto do vazio (`|| 'Sem bloco'`).
 */
export function blockLabel(block: string | null | undefined, compact = false): string {
  const b = (block ?? '').trim()
  if (!b || b === '—') return ''
  if (/^(bloco|bl)\b/i.test(b)) return b
  return `${compact ? 'Bl' : 'Bloco'} ${b}`
}

/** "Bloco A · Lado B · Apto 102". Partes vazias somem — nada de "Bloco  · Apto". */
export function formatUnit(parts: UnitParts, opts: UnitLabelOptions = {}): string {
  const {
    block: blockStyle = 'full',
    apartmentLabel = 'Apto',
    separator = ' · ',
    apartmentSeparator = separator,
    emptyApartment = '—',
  } = opts

  const head: string[] = []

  const b = (parts.block ?? '').trim()
  if (b && blockStyle !== 'omit') {
    head.push(blockStyle === 'bare' ? b : blockLabel(b, blockStyle === 'compact'))
  }

  const c = (parts.complement ?? '').trim()
  if (c) head.push(c)

  const apt = (parts.apartment ?? '').trim() || emptyApartment
  const aptText = apt ? (apartmentLabel ? `${apartmentLabel} ${apt}` : apt) : ''

  if (!aptText) return head.join(separator)
  return head.length > 0 ? `${head.join(separator)}${apartmentSeparator}${aptText}` : aptText
}

/**
 * Chave de ordenação da unidade: bloco → complemento → apartamento.
 *
 * O complemento entra ENTRE bloco e apartamento de propósito. Ele marca uma separação física
 * ("Lado A"/"Lado B"), então ordenar só por bloco→apto faria o entregador atravessar o bloco a
 * cada parada: 101 (Lado A) → 102 (Lado B) → 103 (Lado A).
 */
export function compareUnits(a: UnitParts, b: UnitParts): number {
  const cmp = (x: string | null | undefined, y: string | null | undefined) =>
    (x ?? '').trim().localeCompare((y ?? '').trim(), 'pt-BR', { numeric: true })
  return cmp(a.block, b.block) || cmp(a.complement, b.complement) || cmp(a.apartment, b.apartment)
}
