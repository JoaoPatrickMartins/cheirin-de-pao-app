/**
 * Aritmética de crédito (pãezinhos) — fonte única para o front e a API.
 *
 * Regra do produto: 1 crédito = 1 pãozinho e resgata sempre `avulsoUnit` (preço do pão
 * avulso, `Setting.avulsoUnit`). O crédito é denominado em PÃO, nunca em R$ congelado na
 * compra: se o avulso é reajustado, o crédito já comprado passa a valer o novo preço — é o
 * que preserva o poder de compra de quem comprou antes.
 *
 * Toda conta é feita em CENTAVOS INTEIROS, de propósito. Em ponto flutuante
 * `Math.floor(3.30 / 1.10)` devolve 2 (o quociente sai 2.9999999999999996) e o cliente
 * perderia um pãozinho inteiro no split do checkout. Falha de verdade com avulso de
 * R$ 1,10 (149 casos até 300 pães), R$ 1,30 (62) e R$ 1,35 (117); R$ 1,20 passa por sorte
 * do binário — ou seja, o bug é latente e aparece no primeiro reajuste.
 */

/** R$ → centavos inteiros. */
export function toCents(value: number): number {
  return Math.round(value * 100)
}

/** Centavos inteiros → R$ com 2 casas. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

/**
 * Escala do saldo: 1 pãozinho = 1000 milésimos.
 *
 * O saldo é guardado em INTEIRO nessa escala (`User.creditMilli`), nunca em `Float`: dinheiro
 * em ponto flutuante acumula drift, e trocar o tipo de um campo `Int` já gravado quebra a
 * leitura no Prisma + MongoDB. Com 1000, o erro de arredondamento de um débito é no máximo
 * meio milésimo — R$ 0,0006 com avulso de R$ 1,20, invisível — e o teto de int32 dá conta de
 * 2 milhões de pãezinhos por cliente.
 */
export const CREDIT_SCALE = 1000

/** Pãezinhos (decimal) → milésimos inteiros. */
export function toMilli(credits: number): number {
  return Math.round(credits * CREDIT_SCALE)
}

/** Milésimos → pãezinhos decimais. */
export function fromMilli(milli: number): number {
  return Math.round(milli) / CREDIT_SCALE
}

/**
 * Pãezinhos INTEIROS que o saldo cobre — é o que a agenda e o pedido único podem consumir
 * (um pão nunca é entregue pela metade). A fração que sobra é a "poeira": fica no saldo e é
 * gasta na próxima Cestinha, nunca vira lixo.
 */
export function wholeBreads(milli: number): number {
  return Math.max(0, Math.floor(milli / CREDIT_SCALE))
}

/**
 * Pães inteiros a partir de pãezinhos DECIMAIS — a forma que a API expõe o saldo (43,5).
 *
 * Atalho de `wholeBreads(toMilli(credits))`: passa pelos milésimos de propósito, para um
 * `43.999999` vindo do JSON não virar 43.
 */
export function wholeBreadsOf(credits: number): number {
  return wholeBreads(toMilli(credits))
}

/**
 * Quanto custa um valor em milésimos de pãozinho, arredondado **PARA BAIXO** (a favor do
 * cliente, no máximo R$ 0,0006 por débito).
 *
 * É esta função que faz a promessa do combo valer sempre: com `k = preço/avulso` exato, o
 * custo em dinheiro-equivalente é `preço × (1 − economia do combo)` para qualquer preço,
 * qualquer combo e qualquer avulso — sem tabela e sem regra especial.
 */
export function creditsForPrice(price: number, avulsoUnit: number): number {
  const unit = toCents(avulsoUnit)
  const total = toCents(price)
  if (unit <= 0 || total <= 0) return 0
  return Math.floor((total * CREDIT_SCALE) / unit)
}

/** Valor em R$ de um saldo em milésimos, ao preço avulso atual. */
export function moneyForCredits(milli: number, avulsoUnit: number): number {
  if (milli <= 0 || avulsoUnit <= 0) return 0
  return fromCents((milli * toCents(avulsoUnit)) / CREDIT_SCALE)
}

/**
 * Formata milésimos para exibição: `45000` → "45", `43500` → "43,5", `1583` → "1,6".
 *
 * Uma casa decimal (D-3) e sem ",0" à direita, para o saldo inteiro do dia a dia continuar
 * lendo como sempre leu. O arredondamento da exibição é meio-a-meio, mas a cobrança usa o
 * valor exato em milésimos — mostrar "1,6" e debitar 1,583 é a favor do cliente.
 */
export function formatCredits(milli: number): string {
  const credits = fromMilli(milli)
  const rounded = Math.round(credits * 10) / 10
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',')
}

/**
 * Custo real (R$) de pagar um valor com pãezinhos de um combo específico — os créditos saem pelo
 * preço que o cliente pagou por pão naquele combo. Usado no aviso do formulário de produto do
 * admin ("com saldo, o cliente gasta o equivalente a R$ X").
 *
 * Com o crédito fracionado o valor é coberto 100% em pãezinhos, então isto é exatamente
 * `value × (1 − economia do combo)` — nunca fica acima do preço em dinheiro.
 */
export function custoComPaezinhos(value: number, avulsoUnit: number, comboUnitPrice: number): number {
  const milli = creditsForPrice(value, avulsoUnit)
  return fromCents(Math.round((milli * toCents(comboUnitPrice)) / CREDIT_SCALE))
}
