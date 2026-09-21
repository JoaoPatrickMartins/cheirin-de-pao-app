import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { formatUnit } from '@cheirin-de-pao/shared'

/**
 * CouponShell — as partes comuns de todo cupom não fiscal impresso na térmica de 80mm.
 *
 * Existiam dois motivos para extrair isto de `SeparationCoupon.tsx`:
 *
 *   1. O CSS de impressão é GLOBAL (`body > *:not(.coupon-print-host) { display: none }`). Cada
 *      cópia que nascesse junto de um cupom novo divergiria na primeira mudança de layout — e o
 *      sintoma seria uma folha em branco saindo da térmica, não um erro de build.
 *   2. Cabeçalho da marca, bloco de endereço e rodapé são o mesmo contrato visual em qualquer
 *      cupom (pedido, reimpressão, avulso manual). Quem imprime escolhe só o MIOLO.
 *
 * Estratégia de impressão (robusta entre navegadores):
 * - O conteúdo é renderizado num portal direto no <body> (.coupon-print-host).
 * - Na tela fica display:none.
 * - Em @media print, escondemos TODOS os outros filhos do body e mostramos só o host,
 *   com @page 80mm e quebra de página por cupom. Monocromático (preto/branco) — fundos
 *   coloridos não saem na térmica.
 */

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

/**
 * Host de impressão: portal no <body> com o CSS. Invisível na tela; só existe para o
 * `window.print()` ter o que mostrar. Renderizar `null` quando não há nada a imprimir
 * evita deixar um host vazio competindo com outro na mesma página.
 */
export function CouponPrintHost({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="coupon-print-host" aria-hidden="true">
      <style>{COUPON_CSS}</style>
      {children}
    </div>,
    document.body,
  )
}

/** Um cupom dentro do host — delimita a página que a térmica corta. */
export function Coupon({ children }: { children: ReactNode }) {
  return <div className="cdp-coupon">{children}</div>
}

/** Topo da marca: pão, nome e a linha "Cupom não fiscal". Igual em todo cupom. */
export function CouponBrandHeader() {
  return (
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
  )
}

/** Onde alguém vai bater na porta. `formatUnit` é a MESMA fonte da rota do entregador. */
export function CouponAddress({
  clientName,
  condominiumName,
  block,
  complement,
  apartment,
}: {
  clientName: string
  condominiumName: string
  block?: string
  complement?: string
  apartment?: string
}) {
  return (
    <div className="cdp-dash" style={{ padding: '3mm 0', fontSize: '10pt', lineHeight: 1.45 }}>
      {condominiumName && <div style={{ fontWeight: 800, fontSize: '12.5pt' }}>{condominiumName}</div>}
      <div style={{ fontWeight: 700 }}>{formatUnit({ block, complement, apartment })}</div>
      <div>{clientName}</div>
    </div>
  )
}

/**
 * Selo de estreia. Caixa com BORDA, não fundo preto: fundo sólido depende do driver e da
 * calibração da térmica, e um selo que sai como um borrão cinza não avisa ninguém. A borda
 * imprime igual em qualquer impressora.
 */
export function CouponFirstOrderBadge() {
  return (
    <div
      style={{
        border: '2px solid #000',
        borderRadius: '1mm',
        textAlign: 'center',
        padding: '1.8mm 1mm',
        margin: '2.5mm 0 0',
        fontSize: '10pt',
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      ★ Primeiro pedido ★
    </div>
  )
}

/** Rodapé da marca. */
export function CouponFooter() {
  return (
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
  )
}

/**
 * Fila de impressão: guarda o que vai sair, dispara `window.print()` no próximo tick (o portal
 * precisa ter pintado) e limpa no `afterprint`.
 *
 * O timeout de 60ms e a limpeza no `afterprint` são o comportamento que a Separação já tinha —
 * sem a limpeza, o host fica montado e a próxima impressão da página sai com o lote anterior junto.
 */
export function usePrintQueue<T>(): { queue: T[]; print: (items: T[]) => void } {
  const [queue, setQueue] = useState<T[]>([])

  useEffect(() => {
    if (queue.length === 0) return
    const t = setTimeout(() => window.print(), 60)
    const clear = () => setQueue([])
    window.addEventListener('afterprint', clear)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', clear)
    }
  }, [queue])

  return { queue, print: setQueue }
}
