import { apiFetch } from './apiFetch'

/** Selo do comprovante que vem com cada pedido do cliente (hoje e histórico). */
export interface ClientProofFlags {
  /** Há foto para mostrar agora. */
  available: boolean
  /** Houve foto, mas passou dos 90 dias. */
  expired: boolean
}

/** Foto do comprovante: URL assinada (vence em 10 min), quando foi tirada e o desfecho. */
export interface ClientProofPhoto {
  url: string
  at: string
  outcome: 'DELIVERED' | 'NOT_DELIVERED' | string
}

/**
 * Busca a foto de um pedido do próprio cliente — pão (`/orders/:id/proof`) ou Cestinha
 * (`/market/orders/:id/proof`). `null` = não há foto para mostrar; nunca lança.
 */
export async function fetchClientProof(kind: 'bread' | 'market', id: string): Promise<ClientProofPhoto | null> {
  try {
    const res = await apiFetch(kind === 'market' ? `/market/orders/${id}/proof` : `/orders/${id}/proof`)
    if (!res.ok) return null
    return (await res.json()) as ClientProofPhoto
  } catch {
    return null
  }
}
