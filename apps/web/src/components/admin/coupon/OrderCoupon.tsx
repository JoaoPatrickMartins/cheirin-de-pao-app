import { QRCodeSVG } from 'qrcode.react'
import {
  Coupon,
  CouponAddress,
  CouponBrandHeader,
  CouponFirstOrderBadge,
  CouponFooter,
  CouponPrintHost,
} from './CouponShell'

/**
 * Cupom de um PEDIDO — o que vai dentro do saquinho. Impresso em lote na Separação e,
 * um a um, na reimpressão a partir do detalhe do pedido.
 *
 * As partes da marca (topo, endereço, rodapé) vêm do `CouponShell`; aqui fica só o miolo:
 * turno, pães, itens da Cestinha e o QR que o entregador bipa na porta.
 */

export interface CouponData {
  orderId: string
  code: string
  clientName: string
  condominiumName: string
  block: string
  /** Complemento do bloco ("Lado A"); '' quando não há. */
  complement: string
  apartment: string
  quantity: number
  slotLabel: string
  dateLabel: string
  /** Itens do mini market ("Além do Pãozin") que acompanham esta parada. */
  marketItems?: { name: string; qty: number }[]
  /** Estreia do cliente — imprime o selo de primeiro pedido. */
  isFirstOrder?: boolean
}

export function OrderCouponSheet({ coupons }: { coupons: CouponData[] }) {
  if (coupons.length === 0) return null

  return (
    <CouponPrintHost>
      {coupons.map((c) => (
        <Coupon key={c.orderId}>
          <CouponBrandHeader />

          <CouponAddress
            clientName={c.clientName}
            condominiumName={c.condominiumName}
            block={c.block}
            complement={c.complement}
            apartment={c.apartment}
          />

          {/* Logo abaixo do endereço: é onde o olho de quem monta o saquinho já está. */}
          {c.isFirstOrder && <CouponFirstOrderBadge />}

          <div style={{ fontSize: '9pt', fontWeight: 700, padding: '3mm 0 0' }}>
            Turno: {c.slotLabel} · {c.dateLabel}
          </div>
          {c.quantity > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '1mm 0',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: '11pt' }}>Pãezinhos</span>
              <span style={{ fontWeight: 800, fontSize: '17pt' }}>{c.quantity}</span>
            </div>
          )}

          {c.marketItems && c.marketItems.length > 0 && (
            <div style={{ padding: '2mm 0 1mm', borderTop: c.quantity > 0 ? '1px dashed #000' : undefined, marginTop: c.quantity > 0 ? '1mm' : 0 }}>
              <div style={{ fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1mm' }}>
                Além do Pãozin
              </div>
              {c.marketItems.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5pt', fontWeight: 700, padding: '0.3mm 0' }}>
                  <span>{it.name}</span>
                  <span>{it.qty}×</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5mm', paddingTop: '4mm' }}>
            <QRCodeSVG value={c.orderId} size={256} level="M" style={{ width: '28mm', height: '28mm' }} />
            <div style={{ fontSize: '8.5pt', letterSpacing: '0.12em', fontWeight: 700 }}>#{c.code}</div>
          </div>

          <CouponFooter />
        </Coupon>
      ))}
    </CouponPrintHost>
  )
}
