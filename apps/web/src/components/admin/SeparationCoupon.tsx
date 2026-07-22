import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'

/**
 * Cupom não fiscal da Separação — impresso em impressora térmica via window.print().
 *
 * Estratégia de impressão (robusta entre navegadores):
 * - O conteúdo é renderizado num portal direto no <body> (.coupon-print-host).
 * - Na tela fica display:none.
 * - Em @media print, escondemos TODOS os outros filhos do body e mostramos só o host,
 *   com @page 80mm e quebra de página por cupom. Monocromático (preto/branco) — fundos
 *   coloridos não saem na térmica.
 */

export interface CouponData {
  orderId: string
  code: string
  clientName: string
  condominiumName: string
  block: string
  apartment: string
  quantity: number
  slotLabel: string
  dateLabel: string
}

function BreadMark() {
  return (
    <svg viewBox="0 0 100 100" width="34" height="34" fill="none" aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
      <path d="M22 80 C22 58 34 48 50 48 C66 48 78 58 78 80" stroke="#000" strokeWidth="8" strokeLinecap="round" />
      <path d="M50 48 C45 39 55 34 50 24" stroke="#000" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M36 52 C32 45 39 41 36 34" stroke="#000" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M64 52 C60 45 67 41 64 34" stroke="#000" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  )
}

const COUPON_CSS = `
.coupon-print-host { display: none; }
@media print {
  @page { size: 80mm auto; margin: 0; }
  html, body { background: #fff !important; }
  body > *:not(.coupon-print-host) { display: none !important; }
  .coupon-print-host { display: block !important; }
  /* Cada cupom = uma página bem delimitada, para o driver da térmica cortar por página
     (Epson APD: "Paper Cut = Per Page"). break-* moderno + fallback page-break-*;
     break-inside evita que um cupom se parta entre duas páginas/cortes. */
  .cdp-coupon { page-break-after: always; break-after: page; break-inside: avoid; page-break-inside: avoid; }
  .cdp-coupon:last-child { page-break-after: auto; break-after: auto; }
}
.cdp-coupon {
  width: 72mm;
  margin: 0 auto;
  padding: 4mm 2mm 7mm;
  color: #000;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
}
.cdp-coupon * { color: #000 !important; }
.cdp-dash { border-bottom: 1px dashed #000; }
`

export function SeparationCouponSheet({ coupons }: { coupons: CouponData[] }) {
  if (coupons.length === 0) return null

  return createPortal(
    <div className="coupon-print-host" aria-hidden="true">
      <style>{COUPON_CSS}</style>
      {coupons.map((c) => (
        <div className="cdp-coupon" key={c.orderId}>
          <div className="cdp-dash" style={{ textAlign: 'center', paddingBottom: '2.5mm' }}>
            <BreadMark />
            <div
              style={{
                fontWeight: 800,
                fontSize: '15pt',
                letterSpacing: '-0.02em',
                fontFamily: "'Bricolage Grotesque', sans-serif",
                marginTop: '1mm',
              }}
            >
              Cheirin de Pão
            </div>
            <div style={{ fontSize: '7pt', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
              Cupom não fiscal
            </div>
          </div>

          <div className="cdp-dash" style={{ padding: '3mm 0', fontSize: '10pt', lineHeight: 1.45 }}>
            <div style={{ fontWeight: 800, fontSize: '12.5pt' }}>{c.condominiumName}</div>
            <div style={{ fontWeight: 700 }}>
              {c.block ? `Bloco ${c.block} · ` : ''}Apto {c.apartment || '—'}
            </div>
            <div>{c.clientName}</div>
          </div>

          <div style={{ fontSize: '9pt', fontWeight: 700, padding: '3mm 0 0' }}>
            Turno: {c.slotLabel} · {c.dateLabel}
          </div>
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

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5mm', paddingTop: '4mm' }}>
            <QRCodeSVG value={c.orderId} size={256} level="M" style={{ width: '28mm', height: '28mm' }} />
            <div style={{ fontSize: '8.5pt', letterSpacing: '0.12em', fontWeight: 700 }}>#{c.code}</div>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: '8pt',
              fontWeight: 400,
              lineHeight: 1.5,
              paddingTop: '4.5mm',
              marginTop: '5mm',
              borderTop: '1px dashed #000',
            }}
          >
            Feito com carinho pra começar o seu dia com aquele Cheirin de Pão.
            <br />
            Obrigado pela preferência!
          </div>
        </div>
      ))}
    </div>,
    document.body,
  )
}
