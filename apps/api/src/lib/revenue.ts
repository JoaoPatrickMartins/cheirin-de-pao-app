import { PaymentPurpose } from '@prisma/client'

/**
 * Segmentação financeira (§4.7 — feature "Além do Pãozin").
 *
 * Purposes que NÃO são compra de crédito/pão: `HOOK` (gancho de porta pago) e `MARKET`
 * (Cestinha do mini market). Antes deste filtro, o `HOOK` já vazava para toda a receita e o
 * `MARKET` vazaria igual — contaminando receita total, ranking por condomínio, passivo de
 * crédito (`estPricePerCredit`) e os relatórios de pagamento/retenção.
 *
 * Compras de crédito têm `purpose = null` (nunca setam 'CREDITS'). Tanto `notIn`/`$nin`
 * quanto `NOT { in }` incluem documentos com `purpose` null/ausente no MongoDB — ou seja,
 * as compras de crédito continuam contando; só HOOK e MARKET saem.
 */
export const NON_CREDIT_PURPOSES: PaymentPurpose[] = [PaymentPurpose.HOOK, PaymentPurpose.MARKET]

/** Fragmento de `where` do Prisma — espalhe em agregações de receita de crédito. */
export const excludeNonCreditPurpose = { NOT: { purpose: { in: NON_CREDIT_PURPOSES } } }

/** Fragmento de `$match` nativo do Mongo (pipelines via $runCommandRaw). */
export const nonCreditPurposeMatchRaw = { purpose: { $nin: NON_CREDIT_PURPOSES } }
