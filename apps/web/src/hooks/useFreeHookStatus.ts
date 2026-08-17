import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'

/**
 * useFreeHookStatus — status do gancho de porta do cliente (GET /client/hook-request),
 * para os avisos de "você ganha o gancho grátis" no pedido único e na Cestinha.
 *
 * Existia como fetch inline dentro do SingleScreen. Ao replicar o aviso na Cestinha a cópia
 * viraria duas leituras divergentes do mesmo contrato — e o limiar (`cestinhaMinValue`) é
 * configurável pelo admin, então errar de um lado só apareceria em produção.
 *
 * Reage a `cdp:refresh-hook` (mesmo evento que o ClientLayout usa para abrir o modal de
 * consentimento): depois de uma compra que dá o gancho, o aviso não fica desatualizado.
 */
export interface FreeHookStatus {
  /** Já possui algum gancho (grátis, pago ou cortesia do admin). */
  hasHook: boolean
  /** Já atende a alguma regra do grátis (combo, pedido único, Cestinha ou fidelidade). */
  freeEligible: boolean
  /** Mínimo de pães num pedido único que dá direito ao grátis. */
  pedidoUnicoMin: number
  /** Valor mínimo em R$ de uma Cestinha que dá direito ao grátis. 0 = regra indisponível. */
  cestinhaMinValue: number
  /** Gancho já ENTREGUE — alimenta o aviso "deixe o gancho na porta". */
  delivered: boolean
}

export function useFreeHookStatus(): {
  status: FreeHookStatus | null
  /**
   * true quando ainda há o que conquistar: sem gancho e sem ter qualificado por outra via.
   * Quem já qualificou (ex.: comprou combo) não deve ver "compre X e ganhe" — já ganhou.
   */
  podeGanharGratis: boolean
} {
  const [status, setStatus] = useState<FreeHookStatus | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await apiFetch('/client/hook-request')
        if (!res.ok || cancelled) return
        const d = (await res.json()) as {
          hasHook?: boolean
          freeEligible?: boolean
          pedidoUnicoMin?: number
          cestinhaMinValue?: number
          current?: { status?: string } | null
        } | null
        // `pedidoUnicoMin` numérico é o sinal de resposta válida (mesmo critério do SingleScreen):
        // sem ele não há limiar para comparar e o aviso simplesmente não aparece.
        if (!d || typeof d.pedidoUnicoMin !== 'number' || cancelled) return
        setStatus({
          hasHook: !!d.hasHook,
          freeEligible: !!d.freeEligible,
          pedidoUnicoMin: d.pedidoUnicoMin,
          cestinhaMinValue: typeof d.cestinhaMinValue === 'number' ? d.cestinhaMinValue : 0,
          delivered: d.current?.status === 'DELIVERED',
        })
      } catch {
        // Silencioso: o aviso é um bônus, nunca um bloqueio da tela de compra.
      }
    }

    void load()
    window.addEventListener('cdp:refresh-hook', load)
    return () => {
      cancelled = true
      window.removeEventListener('cdp:refresh-hook', load)
    }
  }, [])

  return {
    status,
    podeGanharGratis: !!status && !status.hasHook && !status.freeEligible,
  }
}
