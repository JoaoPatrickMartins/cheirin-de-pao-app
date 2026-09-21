import { formatCredits, toMilli, formatUnit } from '@cheirin-de-pao/shared'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'
import { FirstOrderChip } from './FirstOrderChip'
import { usePrintQueue } from './coupon/CouponShell'
import { OrderCouponSheet, type CouponData } from './coupon/OrderCoupon'

export interface LedgerRow {
  /** D-4: o ledger é unificado — 'BREAD' (pedido de pão) | 'CESTINHA' (mini market). */
  kind: 'BREAD' | 'CESTINHA'
  orderId: string
  /** Preenchido só em kind 'CESTINHA' (orderId fica vazio). */
  marketOrderId: string
  userId: string
  clientName: string
  condominiumId: string
  condominiumName: string
  block: string
  /** Complemento do bloco ("Lado A"); '' quando não há. */
  complement: string
  apartment: string
  quantity: number
  slotId: string
  slotLabel: string
  type: string
  status: string
  scheduledDate: string
  courierId: string
  courierName: string
  separatedAt: string
  deliveredAt: string
  failedAt: string
  failureReason: string
  cancelReason: string
  deliveryNote: string
  refunded: boolean
  paymentId: string
  paymentAmount: number
  paymentStatus: string
  /** Produtos do mercadinho — métrica paralela aos pães (D-1). Vazio em 'BREAD'. */
  marketItems: { name: string; qty: number }[]
  marketItemCount: number
  /** Split da Cestinha (0 em 'BREAD'). */
  creditsApplied: number
  moneyAmount: number
  totalValue: number
  /** Estreia do cliente — a linha cai no dia da primeira entrega dele. */
  isFirstOrder?: boolean
}

/** Pagamento vinculado ao pedido — vem de `GET /admin/orders/:id`. */
export interface OrderPayment {
  id: string
  amount: number
  method: string
  status: string
  purpose: string
  createdAt: string
  gatewayId: string
  comboName: string
  quantity: number
}

/**
 * O que `GET /admin/orders/:id` acrescenta à linha do ledger. Opcional no sheet: Entregas abre
 * instantâneo com a linha que já tem em memória e ENRIQUECE em segundo plano — abrir um detalhe
 * não pode ficar esperando rede quando metade da informação já está na tela.
 */
export interface OrderDetailExtras {
  createdAt: string
  code: string
  creditsDebited: number
  creditsDebitedDerived: boolean
  refundedCredits: number
  payment: OrderPayment | null
}

export type OrderDetailRow = LedgerRow & OrderDetailExtras

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  FAILED: 'Falhou',
  REFUNDED: 'Estornado',
}

export const STATUS_META: Record<string, { label: string; color: string; soft: string }> = {
  SCHEDULED: { label: 'Agendado', color: '#8A6A00', soft: 'var(--color-gold-soft)' },
  SEPARATED: { label: 'Separado', color: 'var(--color-accent)', soft: 'var(--color-surface-2)' },
  OUT_FOR_DELIVERY: { label: 'A caminho', color: '#8A6A00', soft: 'var(--color-gold-soft)' },
  DELIVERED: { label: 'Entregue', color: 'var(--color-good)', soft: 'var(--color-good-soft)' },
  NOT_DELIVERED: { label: 'Não entregue', color: 'var(--color-bad, #C2410C)', soft: 'rgba(194,65,12,0.12)' },
  CANCELLED: { label: 'Cancelado', color: 'var(--color-text-ter)', soft: 'var(--color-surface-2)' },
}

const ACTIVE = ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY']
const TERMINAL_REFUNDABLE = ['NOT_DELIVERED', 'CANCELLED']

// Passos do resolver: além da visão, um passo por desfecho e os dois estornos.
type Mode = 'view' | 'deliver' | 'fail' | 'cancel' | 'refund' | 'payment'

function fmt(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Só a data, para o cupom (que já diz o turno na linha ao lado). */
function fmtDateOnly(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  } catch {
    return dateStr
  }
}

/**
 * A linha já veio enriquecida? `code` só existe no retorno de `GET /admin/orders/:id`, então
 * serve de discriminador — quem abre com o detalhe na mão não dispara uma segunda busca.
 */
function toExtras(row: LedgerRow): OrderDetailExtras | null {
  const r = row as Partial<OrderDetailRow>
  if (typeof r.code !== 'string') return null
  return {
    createdAt: r.createdAt ?? '',
    code: r.code,
    creditsDebited: r.creditsDebited ?? 0,
    creditsDebitedDerived: r.creditsDebitedDerived ?? false,
    refundedCredits: r.refundedCredits ?? 0,
    payment: r.payment ?? null,
  }
}

/**
 * Detalhe de um pedido com o "resolver": para um pedido ativo/parado, permite dar o
 * desfecho (entregue a posteriori / não entregue / cancelado) e, no mesmo passo,
 * devolver os pães ao saldo. Estorno de dinheiro (Stripe) é uma ação separada, só
 * quando há pagamento vinculado. Usado no histórico/parados da aba Entregas.
 */
export function OrderDetailSheet({ row, onClose, onChanged }: { row: LedgerRow; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<Mode>('view')
  const [reason, setReason] = useState('')
  const [refundCredits, setRefundCredits] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Detalhe completo (pagamento, créditos, criação). Chega depois da abertura — quem já recebe a
  // linha enriquecida (Clientes) não espera nada; quem abre do ledger vê o resto preencher.
  const [extras, setExtras] = useState<OrderDetailExtras | null>(toExtras(row))
  const { queue: coupons, print: printCoupons } = usePrintQueue<CouponData>()

  const detailId = row.kind === 'CESTINHA' ? row.marketOrderId : row.orderId

  useEffect(() => {
    if (extras || !detailId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(`/admin/orders/${detailId}?kind=${row.kind}`)
        if (res.ok && !cancelled) setExtras(toExtras((await res.json()) as OrderDetailRow))
      } catch {
        // silencioso: o detalhe é complemento, a linha principal já está na tela
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailId, row.kind, extras])

  const meta = STATUS_META[row.status] ?? { label: row.status, color: 'var(--color-text-ter)', soft: 'var(--color-surface-2)' }
  const isCestinha = row.kind === 'CESTINHA'
  const canResolve = ACTIVE.includes(row.status)
  // Estas duas ações são específicas do pedido de pão e NÃO existem para a Cestinha:
  // - `/admin/orders/:id/refund` procura um `Order` (404 numa Cestinha);
  // - o estorno genérico de `purpose=MARKET` está bloqueado em admin-payments de propósito
  //   (estornaria o dinheiro deixando o pedido ativo e os créditos presos).
  // Na Cestinha a devolução acontece dentro do "resolver": tudo em pãezinhos, inclusive a
  // parte paga em dinheiro (DEC-36). Esconder evita oferecer um botão que só dá erro.
  const canRefund = !isCestinha && TERMINAL_REFUNDABLE.includes(row.status) && !row.refunded
  const hasPayment = !!row.paymentId
  const canRefundPayment = !isCestinha && hasPayment && row.paymentStatus === 'PAID'

  function goto(next: Mode) {
    setError('')
    setReason('')
    setRefundCredits(true)
    setMode(next)
  }

  // Resolve o pedido parado: desfecho + (opcional) devolução de pães, em uma chamada.
  async function resolve(outcome: 'DELIVERED' | 'NOT_DELIVERED' | 'CANCELLED') {
    setBusy(true)
    setError('')
    try {
      // D-4: a mesma rota resolve os dois tipos — `kind` roteia para o fluxo da Cestinha,
      // onde o estorno é todo em pãezinhos (inclusive a parte paga em dinheiro).
      const body: Record<string, unknown> = { outcome, kind: row.kind }
      if (outcome === 'DELIVERED') {
        if (reason.trim()) body.reason = reason.trim()
      } else {
        body.reason = reason.trim()
        body.refundCredits = refundCredits
      }
      const res = await apiFetch(`/admin/orders/${row.kind === 'CESTINHA' ? row.marketOrderId : row.orderId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao resolver o pedido')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  // Estorno de pães de um pedido já terminal (não entregue/cancelado sem estorno).
  async function refund() {
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`/admin/orders/${row.orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao estornar')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  // Estorno de dinheiro (Stripe) do pagamento vinculado. Reusa o fluxo de Pagamentos,
  // que já debita os créditos correspondentes atomicamente no backend.
  async function refundPayment() {
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`/admin/payments/${row.paymentId}/refund`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao estornar o pagamento')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  const reasonRequired = mode === 'fail' || mode === 'cancel'
  const confirmDisabled = busy || (reasonRequired && !reason.trim())

  /** 2ª via do cupom deste pedido — mesmo layout da Separação, um cupom só. */
  function reprint() {
    if (!extras) return
    printCoupons([
      {
        // O QR é bipado na porta: precisa do id que o entregador resolve, como no lote original.
        orderId: detailId,
        code: extras.code,
        clientName: row.clientName,
        condominiumName: row.condominiumName,
        block: row.block,
        complement: row.complement,
        apartment: row.apartment,
        quantity: row.quantity,
        slotLabel: row.slotLabel,
        dateLabel: fmtDateOnly(row.scheduledDate),
        marketItems: row.marketItems,
        isFirstOrder: row.isFirstOrder,
      },
    ])
  }

  return (
    <>
    {/* Folha de impressão (oculta na tela; sai via window.print) */}
    <OrderCouponSheet coupons={coupons} />
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: '20px 20px calc(24px + env(safe-area-inset-bottom))',
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              {row.clientName}
              {row.isFirstOrder && <FirstOrderChip />}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', margin: '3px 0 0' }}>
              {row.condominiumName} · {formatUnit(row)}
              {extras?.code ? ` · #${extras.code}` : ''}
            </p>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: 99, background: meta.soft, color: meta.color, fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {meta.label}
          </span>
        </div>

        {/* Detalhes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <DetailRow label="Pãezinhos" value={String(row.quantity)} />
          <DetailRow label="Turno" value={row.slotLabel} />
          <DetailRow label="Data de entrega" value={fmt(row.scheduledDate)} />
          {row.courierName && <DetailRow label="Entregador" value={row.courierName} />}
          {row.separatedAt && <DetailRow label="Separado em" value={fmt(row.separatedAt)} />}
          {row.deliveredAt && <DetailRow label="Entregue em" value={fmt(row.deliveredAt)} />}
          {row.failedAt && <DetailRow label="Não entregue em" value={fmt(row.failedAt)} />}
          {row.failureReason && <DetailRow label="Motivo" value={row.failureReason} />}
          {row.cancelReason && <DetailRow label="Motivo do cancelamento" value={row.cancelReason} />}
          {row.deliveryNote && <DetailRow label="Nota da entrega" value={row.deliveryNote} />}
          {row.refunded && <DetailRow label="Pães" value="Devolvidos ao saldo ✓" />}
          {/* Cestinha: itens e split — é o que o admin precisa para decidir o desfecho. */}
          {isCestinha && (
            <>
              <DetailRow
                label="Itens"
                value={row.marketItems.map((it) => `${it.qty}× ${it.name}`).join(', ') || '—'}
              />
              <DetailRow
                label="Pago"
                value={
                  [
                    row.creditsApplied > 0 ? `${formatCredits(toMilli(row.creditsApplied))} 🥖` : '',
                    row.moneyAmount > 0 ? fmtMoney(row.moneyAmount) : '',
                  ]
                    .filter(Boolean)
                    .join(' + ') || '—'
                }
              />
              {row.totalValue > 0 && <DetailRow label="Total" value={fmtMoney(row.totalValue)} />}
            </>
          )}
          {extras?.createdAt && <DetailRow label="Pedido feito em" value={fmt(extras.createdAt)} />}
        </div>

        {/* ── Pagamento ──────────────────────────────────────────────────────
            Um pedido de pão pode não ter pagamento nenhum (saiu do saldo). Dizer "pago com
            saldo" é informação; deixar a seção vazia faria parecer dado faltando. */}
        {extras && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Pagamento</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {extras.payment ? (
                <>
                  <DetailRow label="Valor" value={fmtMoney(extras.payment.amount)} />
                  <DetailRow label="Forma" value={PAYMENT_METHOD_LABEL[extras.payment.method] ?? extras.payment.method} />
                  <DetailRow label="Situação" value={PAYMENT_STATUS_LABEL[extras.payment.status] ?? extras.payment.status} />
                  <DetailRow label="Pago em" value={fmt(extras.payment.createdAt)} />
                  {extras.payment.comboName && <DetailRow label="Combo" value={extras.payment.comboName} />}
                  {extras.payment.quantity > 0 && (
                    <DetailRow label="Creditou" value={`${extras.payment.quantity} 🥖`} />
                  )}
                  {extras.payment.gatewayId && <DetailRow label="Id no gateway" value={extras.payment.gatewayId} />}
                </>
              ) : (
                <DetailRow label="Forma" value="Pago com saldo de pãezinhos" />
              )}
              {extras.creditsDebited > 0 && (
                <DetailRow
                  label="Pãezinhos debitados"
                  // A flag existe porque pedido do corte antigo não tem linha no extrato: o número
                  // é a regra que debitou, não um movimento auditado. Esconder isso seria mentir.
                  value={`${formatCredits(toMilli(extras.creditsDebited))}${extras.creditsDebitedDerived ? ' (estimado)' : ''}`}
                />
              )}
              {extras.refundedCredits > 0 && (
                <DetailRow label="Pãezinhos devolvidos" value={formatCredits(toMilli(extras.refundedCredits))} />
              )}
            </div>
          </div>
        )}

        {!extras && hasPayment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <DetailRow
              label="Pagamento"
              value={
                (row.paymentAmount ? fmtMoney(row.paymentAmount) : 'vinculado') +
                (row.paymentStatus === 'REFUNDED' ? ' · estornado' : '')
              }
            />
          </div>
        )}

        {error && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-bad, #C2410C)', margin: '0 0 12px' }}>{error}</p>
        )}

        {/* Campo de motivo/nota conforme o passo */}
        {mode !== 'view' && mode !== 'payment' && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              mode === 'fail'
                ? 'Motivo da não-entrega (cliente ausente, endereço...)'
                : mode === 'cancel'
                  ? 'Motivo do cancelamento'
                  : mode === 'deliver'
                    ? 'Observação (opcional) — ex.: entregue manualmente'
                    : 'Motivo do estorno (opcional)'
            }
            rows={3}
            style={{
              width: '100%',
              borderRadius: 12,
              border: '1px solid var(--color-border-2)',
              background: 'var(--color-surface-2)',
              padding: 12,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-text)',
              resize: 'vertical',
              marginBottom: 12,
            }}
          />
        )}

        {/* Devolver pães — só nos desfechos de não-entrega/cancelamento.
            Na Cestinha o que volta é o split inteiro (pãezinhos aplicados + a parte paga em
            dinheiro convertida em pãezinhos), não a quantidade de pães do pedido. */}
        {(mode === 'fail' || mode === 'cancel') && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={refundCredits} onChange={(e) => setRefundCredits(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--color-espresso)' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)' }}>
              {isCestinha
                ? 'Devolver o valor da Cestinha em pãezinhos (inclui a parte paga em dinheiro)'
                : `Devolver ${row.quantity} ${row.quantity === 1 ? 'pão' : 'pães'} ao saldo`}
            </span>
          </label>
        )}

        {/* Aviso do estorno de dinheiro (dinheiro ≠ pães) */}
        {mode === 'payment' && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', margin: '0 0 12px', lineHeight: 1.45 }}>
            Estorna {row.paymentAmount ? fmtMoney(row.paymentAmount) : 'o valor pago'} no cartão/Pix e remove os créditos correspondentes.
            O valor pago pode ser menor que {row.quantity} {row.quantity === 1 ? 'pão' : 'pães'} (parte pode ter vindo do saldo) —
            não combine com “devolver pães” para as mesmas unidades.
          </p>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'view' && (
            <>
              {canResolve && (
                <>
                  <ActionButton variant="good" label="Marcar como entregue" onClick={() => goto('deliver')} />
                  <ActionButton variant="danger" label="Registrar não entrega" onClick={() => goto('fail')} />
                  <ActionButton variant="dangerGhost" label="Cancelar pedido" onClick={() => goto('cancel')} />
                </>
              )}
              {canRefund && <ActionButton variant="primary" label="Devolver pães ao saldo" onClick={() => goto('refund')} />}
              {canRefundPayment && <ActionButton variant="ghost" label={`Estornar pagamento${row.paymentAmount ? ` (${fmtMoney(row.paymentAmount)})` : ''}`} onClick={() => goto('payment')} />}
              {/* Reimpressão: cupom perdido/rasgado, ou 2ª via para conferência na porta.
                  Só depois que o detalhe chega — é dele que sai o código impresso. */}
              {extras && <ActionButton variant="ghost" label="Reimprimir cupom" onClick={reprint} />}
              <ActionButton variant="ghost" label="Fechar" onClick={onClose} />
            </>
          )}
          {mode === 'deliver' && (
            <>
              <ActionButton variant="good" label={busy ? 'Salvando...' : 'Confirmar entrega'} onClick={() => resolve('DELIVERED')} disabled={busy} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
          {mode === 'fail' && (
            <>
              <ActionButton variant="danger" label={busy ? 'Salvando...' : 'Confirmar não entrega'} onClick={() => resolve('NOT_DELIVERED')} disabled={confirmDisabled} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
          {mode === 'cancel' && (
            <>
              <ActionButton variant="danger" label={busy ? 'Cancelando...' : 'Confirmar cancelamento'} onClick={() => resolve('CANCELLED')} disabled={confirmDisabled} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
          {mode === 'refund' && (
            <>
              <ActionButton variant="primary" label={busy ? 'Estornando...' : `Confirmar estorno (${row.quantity})`} onClick={refund} disabled={busy} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
          {mode === 'payment' && (
            <>
              <ActionButton variant="danger" label={busy ? 'Estornando...' : 'Confirmar estorno do pagamento'} onClick={refundPayment} disabled={busy} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--color-text-ter)',
        margin: '0 0 8px',
      }}
    >
      {children}
    </p>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function ActionButton({ label, onClick, variant, disabled }: { label: string; onClick: () => void; variant: 'primary' | 'danger' | 'dangerGhost' | 'good' | 'ghost'; disabled?: boolean }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-espresso)', color: '#fff', border: 'none' },
    danger: { background: 'var(--color-bad, #C2410C)', color: '#fff', border: 'none' },
    dangerGhost: { background: 'none', color: 'var(--color-bad, #C2410C)', border: '1.5px solid var(--color-bad, #C2410C)' },
    good: { background: 'var(--color-good)', color: '#fff', border: 'none' },
    ghost: { background: 'none', color: 'var(--color-text)', border: '1.5px solid var(--color-border)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 46,
        borderRadius: 999,
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 15,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        ...styles[variant],
      }}
    >
      {label}
    </button>
  )
}
