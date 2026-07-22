/**
 * OrderSummarySheet — resumo do pedido único antes de finalizar.
 *
 * Bottom sheet que desliza de baixo e reúne TODAS as informações do pedido (o que pediu,
 * para quando, forma de pagamento e o financeiro) para uma última conferência antes de
 * disparar o pagamento/reserva. Puramente presentacional: quem decide o que acontece no
 * "Confirmar" é o SingleScreen (via onConfirm → doSubmit). Segue a identidade premium do
 * app — o mesmo "ticket" espresso do CreditBalanceCard (gradiente + brilho + marca d'água).
 *
 * Para clientes com gancho já ENTREGUE, mostra o aviso de deixar o gancho na porta.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../brand/Icon'
import { BreadMark } from '../brand/BreadMark'

const formatBRL = (val: number) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface OrderSummarySheetProps {
  open: boolean
  qtd: number
  /** Data por extenso, ex.: "Sexta-feira, 25 de julho". */
  whenLabel: string
  slotLabel?: string
  slotEmoji?: string
  slotTime?: string
  creditBalance: number
  usaSaldo: number
  deficit: number
  totalPagar: number
  precisaPagar: boolean
  /** Gancho já entregue → exibe o aviso de deixar o gancho na porta. */
  hookDelivered: boolean
  isSubmitting: boolean
  errorMsg: string | null
  onConfirm: () => void
  onClose: () => void
}

/** Linha de detalhe: ícone + rótulo à esquerda, valor à direita. */
function Row({
  icon,
  label,
  value,
  emphasis = false,
}: {
  icon: string
  label: string
  value: ReactNode
  emphasis?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Icon name={icon} size={18} color="var(--color-text-ter)" stroke={2} />
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            color: 'var(--color-text-sec)',
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: emphasis ? 800 : 700,
          fontSize: emphasis ? 17 : 14.5,
          color: 'var(--color-text)',
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function OrderSummarySheet({
  open,
  qtd,
  whenLabel,
  slotLabel,
  slotEmoji,
  slotTime,
  creditBalance,
  usaSaldo,
  deficit,
  totalPagar,
  precisaPagar,
  hookDelivered,
  isSubmitting,
  errorMsg,
  onConfirm,
  onClose,
}: OrderSummarySheetProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Fecha no Esc (exceto durante o envio) e leva o foco ao CTA ao abrir.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => confirmRef.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, isSubmitting, onClose])

  const saldoApos = Math.max(0, creditBalance - usaSaldo)
  const divider = (
    <div style={{ height: 1, background: 'var(--color-border-2)', margin: '2px 0' }} />
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            if (!isSubmitting) onClose()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-summary-title"
            className="order-summary-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '92dvh',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              background: 'var(--color-app-bg)',
              borderRadius: '24px 24px 0 0',
              padding: '10px 20px calc(22px + env(safe-area-inset-bottom))',
              boxShadow: '0 -12px 40px rgba(30,18,7,0.24)',
            }}
          >
            <style>{`.order-summary-sheet::-webkit-scrollbar{display:none}`}</style>
            {/* Grabber */}
            <div
              aria-hidden="true"
              style={{
                width: 40,
                height: 4,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--color-border)',
                margin: '0 auto 16px',
              }}
            />

            {/* Cabeçalho */}
            <h2
              id="order-summary-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--color-text)',
                margin: '0 0 3px',
              }}
            >
              Confirme seu pedido
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                color: 'var(--color-text-sec)',
                margin: '0 0 16px',
              }}
            >
              Revise os detalhes antes de finalizar.
            </p>

            {/* Ticket espresso */}
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 'var(--radius-card)',
                background: 'linear-gradient(135deg, #1E1207, #2E1D0D)',
                padding: '18px 20px',
                boxShadow: 'var(--shadow-strong)',
                marginBottom: 12,
              }}
            >
              <span className="cdp-sheen" aria-hidden="true" />
              <div
                className="cdp-float"
                style={{ position: 'absolute', bottom: -46, right: -28, opacity: 0.1, pointerEvents: 'none' }}
              >
                <BreadMark size={170} color="#E3AC3F" />
              </div>

              <div style={{ position: 'relative' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: '#C7B595',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    margin: '0 0 4px',
                  }}
                >
                  Seu pedido
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 40,
                      lineHeight: 1,
                      letterSpacing: '-0.03em',
                      color: '#FAF5EC',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {qtd}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 16, color: '#E3AC3F' }}>
                    pães 🥖
                  </span>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#C7B595', margin: '10px 0 0' }}>
                  {whenLabel}
                  {slotLabel ? ` · ${slotEmoji ?? ''} ${slotLabel}${slotTime ? ` ${slotTime}` : ''}` : ''}
                </p>
              </div>
            </div>

            {/* Detalhes */}
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-border-2)',
                boxShadow: 'var(--shadow-soft)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <Row icon="calendar" label="Entrega" value={whenLabel} />
              {slotLabel && (
                <Row
                  icon="clock"
                  label="Horário"
                  value={`${slotEmoji ? `${slotEmoji} ` : ''}${slotLabel}${slotTime ? ` · ${slotTime}` : ''}`}
                />
              )}
              <Row icon="card" label="Pagamento" value={precisaPagar ? 'Pix' : 'Saldo'} />

              {precisaPagar && (
                <>
                  {divider}
                  <Row icon="wallet" label="Do seu saldo" value={`${usaSaldo} pães`} />
                  <Row
                    icon="coin"
                    label={`A comprar (${deficit} ${deficit === 1 ? 'pão' : 'pães'})`}
                    value={formatBRL(totalPagar)}
                  />
                </>
              )}

              {divider}
              <Row
                icon="bag"
                label="Total"
                value={precisaPagar ? formatBRL(totalPagar) : 'Usa seu saldo'}
                emphasis
              />
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  color: 'var(--color-text-ter)',
                  margin: '-4px 0 0',
                  textAlign: 'right',
                }}
              >
                Saldo após: {saldoApos} pães
              </p>
            </div>

            {/* Aviso do gancho — só quando já entregue */}
            {hookDelivered && (
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  background: 'var(--color-gold-soft)',
                  borderRadius: 'var(--radius-card)',
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    background: 'rgba(176,112,42,0.16)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="alert" size={19} color="var(--color-accent)" stroke={2.1} />
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--color-text)',
                    margin: 0,
                  }}
                >
                  Para a entrega acontecer, deixe seu <strong>gancho na porta</strong>. Sem o gancho, o pedido pode não
                  ser entregue e o valor volta como saldo para sua conta.
                </p>
              </div>
            )}

            {/* Erro do backend (renderizado aqui para ficar visível sobre o sheet) */}
            {errorMsg && (
              <p
                role="alert"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: 'var(--color-warn)',
                  textAlign: 'center',
                  margin: '0 0 12px',
                }}
              >
                {errorMsg}
              </p>
            )}

            {/* CTA */}
            <button
              ref={confirmRef}
              onClick={onConfirm}
              disabled={isSubmitting}
              style={{
                width: '100%',
                minHeight: 52,
                borderRadius: 'var(--radius-btn)',
                border: 'none',
                background: 'var(--color-espresso)',
                color: 'var(--color-primary-btn-text)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                cursor: isSubmitting ? 'default' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'opacity .15s',
              }}
            >
              {isSubmitting ? (
                <>
                  <svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 1 1-3-6.7" />
                  </svg>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  {precisaPagar ? 'Processando...' : 'Reservando...'}
                </>
              ) : (
                <>
                  <Icon name="check" size={18} color="var(--color-primary-btn-text)" />
                  {precisaPagar ? `Confirmar e pagar ${formatBRL(totalPagar)}` : 'Confirmar pedido'}
                </>
              )}
            </button>

            <button
              onClick={() => {
                if (!isSubmitting) onClose()
              }}
              disabled={isSubmitting}
              style={{
                width: '100%',
                minHeight: 44,
                marginTop: 8,
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-sec)',
                fontFamily: 'var(--font-body)',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: isSubmitting ? 'default' : 'pointer',
              }}
            >
              Voltar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
