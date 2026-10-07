/**
 * Documentos legais com aceite registrado (plano-termos-legais §6 · T-T6). A versão vigente fica
 * aqui para a API e o app dizerem IGUAL qual versão o usuário precisa aceitar. Mudou o texto de forma
 * relevante (ex.: depois da revisão jurídica) → suba a versão: o app pede o aceite de novo.
 *
 * Hoje só o Termo do Entregador Parceiro. Próximas rodadas (§3 do plano): termos do cliente,
 * regulamento do Indique e Ganhe e confidencialidade da equipe.
 */
export const LEGAL_DOCS = {
  COURIER_TERMS: {
    title: 'Termo do Entregador Parceiro',
    version: '1.0',
    /** Dia BRT em que esta versão passou a valer. */
    date: '2026-10-05',
    path: '/termos-entregador',
  },
} as const

export type LegalDoc = keyof typeof LEGAL_DOCS

export function isLegalDoc(doc: string): doc is LegalDoc {
  return Object.prototype.hasOwnProperty.call(LEGAL_DOCS, doc)
}

/** Precisa aceitar: nunca aceitou ou aceitou uma versão que não é a vigente. */
export function needsLegalAcceptance(doc: LegalDoc, acceptedVersion: string | null | undefined): boolean {
  return acceptedVersion !== LEGAL_DOCS[doc].version
}
