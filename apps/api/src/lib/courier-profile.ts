/**
 * Perfil do entregador definido pelo ADMIN (plano-app-entregador §3.1). Os campos ficam em `User`
 * como Json opcional; aqui mora a resolução com os padrões — a mesma para a API do entregador, a
 * do admin e os jobs, para nunca haver duas opiniões sobre "este entregador precisa de foto?".
 */

export interface CourierRules {
  /** Foto obrigatória ao confirmar a entrega (sem "Pular"; a exceção vira "sem foto"). */
  fotoEntrega: boolean
  /** Foto obrigatória na não entrega. */
  fotoNaoEntrega: boolean
  /** Pode reordenar a rota no app (vale só no dia). */
  podeReordenar: boolean
  /** Pode mandar recados prontos ao cliente. */
  podeRecados: boolean
}

/**
 * Padrão de quem não tem a chave (V-17): comprovante obrigatório nos dois desfechos; reordenar e
 * recados desligados, liberados caso a caso pelo admin.
 */
export const DEFAULT_COURIER_RULES: CourierRules = {
  fotoEntrega: true,
  fotoNaoEntrega: true,
  podeReordenar: false,
  podeRecados: false,
}

/** Regras do entregador a partir do Json gravado; chave ausente ou de tipo errado cai no padrão. */
export function resolveCourierRules(raw: unknown): CourierRules {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const bool = (k: keyof CourierRules) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : DEFAULT_COURIER_RULES[k])
  return {
    fotoEntrega: bool('fotoEntrega'),
    fotoNaoEntrega: bool('fotoNaoEntrega'),
    podeReordenar: bool('podeReordenar'),
    podeRecados: bool('podeRecados'),
  }
}
