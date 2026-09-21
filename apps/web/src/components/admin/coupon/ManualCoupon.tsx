import {
  Coupon,
  CouponAddress,
  CouponBrandHeader,
  CouponFooter,
  CouponPrintHost,
} from './CouponShell'

/**
 * Cupom MANUAL — o admin escreve o conteúdo na hora e imprime.
 *
 * Existe para o que não nasce de um pedido: um brinde, uma reposição, um bilhete que precisa
 * chegar identificado na porta certa. Antes disso o único jeito de imprimir um cupom com nome e
 * endereço do cliente era ter um pedido para aquele cliente naquele dia.
 *
 * Sem QR de propósito: não há pedido para bipar, e um QR que não resolve nada confunde o
 * entregador. O que entra no lugar é a data de emissão.
 */

export interface ManualCouponData {
  clientName: string
  condominiumName: string
  block: string
  complement: string
  apartment: string
  /** Pãezinhos avulsos; 0 esconde a linha. */
  quantity: number
  /** Itens escritos à mão pelo admin. */
  items: { name: string; qty: number }[]
  /** Observação livre — o bilhete em si. */
  note: string
  dateLabel: string
}

export function ManualCouponSheet({ coupon }: { coupon: ManualCouponData | null }) {
  if (!coupon) return null

  const items = coupon.items.filter((it) => it.name.trim() !== '')

  return (
    <CouponPrintHost>
      <Coupon>
        <CouponBrandHeader />

        <CouponAddress
          clientName={coupon.clientName}
          condominiumName={coupon.condominiumName}
          block={coupon.block}
          complement={coupon.complement}
          apartment={coupon.apartment}
        />

        <div style={{ fontSize: '9pt', fontWeight: 700, padding: '3mm 0 0' }}>{coupon.dateLabel}</div>

        {coupon.quantity > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '1mm 0' }}>
            <span style={{ fontWeight: 800, fontSize: '11pt' }}>Pãezinhos</span>
            <span style={{ fontWeight: 800, fontSize: '17pt' }}>{coupon.quantity}</span>
          </div>
        )}

        {items.length > 0 && (
          <div
            style={{
              padding: '2mm 0 1mm',
              borderTop: coupon.quantity > 0 ? '1px dashed #000' : undefined,
              marginTop: coupon.quantity > 0 ? '1mm' : 0,
            }}
          >
            <div style={{ fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1mm' }}>
              Itens
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5pt', fontWeight: 700, padding: '0.3mm 0', gap: '2mm' }}>
                <span>{it.name}</span>
                {it.qty > 0 && <span>{it.qty}×</span>}
              </div>
            ))}
          </div>
        )}

        {coupon.note.trim() !== '' && (
          <div style={{ padding: '3mm 0 0', marginTop: '2mm', borderTop: '1px dashed #000' }}>
            <div style={{ fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1.5mm' }}>
              Observação
            </div>
            {/* pre-wrap: a quebra de linha que o admin digitou é parte do bilhete. */}
            <div style={{ fontSize: '10pt', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{coupon.note}</div>
          </div>
        )}

        <CouponFooter />
      </Coupon>
    </CouponPrintHost>
  )
}
