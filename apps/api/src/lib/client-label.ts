/**
 * client-label.ts — rótulo curto do cliente nos avisos ao admin: "Fulano · Bl A · Lado B · Apto 12".
 *
 * Existia em três cópias (pedido de pão, desfecho de entrega e agora a Cestinha). Um aviso que
 * identifica o cliente de forma diferente em cada tela obriga o admin a traduzir mentalmente
 * quem é quem — o rótulo é vocabulário compartilhado, não formatação local.
 *
 * A composição da unidade em si vem de `formatUnit` (packages/shared), a mesma que imprime o
 * cupom e monta a parada do entregador. Forma compacta porque isto vai em push/título curto.
 */
import { formatUnit } from '@cheirin-de-pao/shared'

export function clientLabel(u: {
  name?: string | null
  apartment?: string | null
  block?: string | null
  complement?: string | null
}): string {
  // Sem nenhuma parte do endereço o rótulo é só o nome — `formatUnit` devolveria "Apto —",
  // que num aviso de entrega parece dado faltando em vez de cliente sem unidade cadastrada.
  const hasLocation = [u.block, u.complement, u.apartment].some((v) => (v ?? '').trim() !== '')
  const loc = hasLocation ? formatUnit(u, { block: 'compact' }) : null
  return [u.name ?? 'Cliente', loc].filter(Boolean).join(' · ')
}
