import {
  Coupon,
  CouponAddress,
  CouponBrandHeader,
  CouponFooter,
  CouponPrintHost,
} from './CouponShell'

/**
 * Cupom de ENTREGA DE GANCHO — o papel que vai junto do gancho de porta.
 *
 * O gancho não viaja dentro de um saquinho de pedido: sai avulso, muitas vezes num dia em que
 * aquele cliente não tem entrega nenhuma. Sem cupom, quem leva só tem uma lista no celular — e o
 * endereço da porta é justamente o que não pode sair errado.
 *
 * Sem QR, pela mesma razão do cupom manual: não há pedido para o entregador bipar, e um QR que
 * não resolve nada só confunde. O que identifica a entrega é o cabeçalho de endereço.
 */

export interface HookCouponData {
  /** ID do HookRequest — chave do React e rastro de qual gancho gerou este papel. */
  hookRequestId: string
  clientName: string
  condominiumName: string
  block: string
  /** Complemento do bloco ("Lado A"); '' quando não há. */
  complement: string
  apartment: string
  /** "Grátis" | "Pago" | "Bônus" — o mesmo rótulo da pílula da fila. */
  typeLabel: string
  /** Motivo (defeito/perda no pago; texto da bonificação no bônus); '' esconde a linha. */
  reason: string
  /** "Solicitado em 12/06" — data de entrada na fila. */
  dateLabel: string
}

export function HookCouponSheet({ coupons }: { coupons: HookCouponData[] }) {
  if (coupons.length === 0) return null

  return (
    <CouponPrintHost>
      {coupons.map((c) => (
        <Coupon key={c.hookRequestId}>
          <CouponBrandHeader />

          <CouponAddress
            clientName={c.clientName}
            condominiumName={c.condominiumName}
            block={c.block}
            complement={c.complement}
            apartment={c.apartment}
          />

          {/* Faixa com BORDA, não fundo sólido: fundo preto depende da calibração da térmica
              e sai como borrão cinza em metade das impressoras. Mesma escolha do selo de estreia. */}
          <div
            style={{
              border: '2px solid #000',
              borderRadius: '1mm',
              textAlign: 'center',
              padding: '2.2mm 1mm',
              margin: '3mm 0 0',
              fontSize: '11pt',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Gancho de porta
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2mm', fontSize: '10pt', fontWeight: 700, padding: '2.5mm 0 0' }}>
            <span>{c.typeLabel}</span>
            <span>{c.dateLabel}</span>
          </div>

          {c.reason.trim() !== '' && (
            <div style={{ padding: '3mm 0 0', marginTop: '2mm', borderTop: '1px dashed #000' }}>
              <div style={{ fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1.5mm' }}>
                Motivo
              </div>
              <div style={{ fontSize: '10pt', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{c.reason}</div>
            </div>
          )}

          <div style={{ fontSize: '9.5pt', lineHeight: 1.45, padding: '3mm 0 0', marginTop: '2mm', borderTop: '1px dashed #000' }}>
            É só encaixar o gancho na porta. A partir de agora seu pãozinho chega fresquinho
            direto nele, todo dia da sua agenda.
          </div>

          <CouponFooter />
        </Coupon>
      ))}
    </CouponPrintHost>
  )
}
