import { Icon } from '../brand/Icon'

/**
 * Selo "primeiro pedido" — cliente estreando na operação.
 *
 * Aparece na Separação, no ledger de Entregas e nos pedidos do cliente. Um componente só porque
 * o selo precisa ser reconhecível à primeira vista em qualquer tela: se cada lista desenhasse o
 * seu, viraria um chip diferente por tela e ninguém aprenderia o sinal.
 *
 * Usa o dourado da marca (`--color-accent`), o mesmo tratamento de destaque dos chips de Cestinha.
 */
export function FirstOrderChip({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Primeiro pedido deste cliente"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        flexShrink: 0,
        padding: compact ? '1px 6px' : '2px 8px',
        borderRadius: 999,
        background: 'var(--color-gold-soft)',
        border: '1px solid var(--color-accent)',
        color: 'var(--color-accent)',
        fontFamily: 'var(--font-body)',
        fontSize: compact ? 10 : 10.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      <Icon name="star" size={compact ? 10 : 11} stroke={2.2} color="var(--color-accent)" aria-hidden="true" />
      1º pedido
    </span>
  )
}
