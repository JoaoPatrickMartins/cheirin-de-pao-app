/**
 * client-label.ts — rótulo curto do cliente nos avisos ao admin: "Fulano · Apto 12B".
 *
 * Existia em três cópias (pedido de pão, desfecho de entrega e agora a Cestinha). Um aviso que
 * identifica o cliente de forma diferente em cada tela obriga o admin a traduzir mentalmente
 * quem é quem — o rótulo é vocabulário compartilhado, não formatação local.
 */
export function clientLabel(u: {
  name?: string | null
  apartment?: string | null
  block?: string | null
}): string {
  const loc = [u.block, u.apartment].filter(Boolean).join(' ')
  return [u.name ?? 'Cliente', loc ? `Apto ${loc}` : null].filter(Boolean).join(' · ')
}
