import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../contexts/CartContext'
import { useMarketCatalog } from '../../hooks/useMarketCatalog'
import { useSchedule } from '../../hooks/useSchedule'
import { usePaymentPolling } from '../../hooks/usePaymentPolling'
import { apiFetch } from '../../lib/apiFetch'
import { brtDateStr, isPastCutoffForDelivery } from '../../lib/cutoff'
import { formatBRL } from '../../lib/market'
import { Icon } from '../../components/brand/Icon'
import { SavedCardsList } from '../../components/client/SavedCardsList'
import { AddCardForm } from '../../components/client/AddCardForm'
import { SwitchToggle } from '../../components/admin/SwitchToggle'
import type { SavedCard } from '../../components/client/SavedCardItem'

interface DeliverySlot {
  slotId?: string
  name: string
  label?: string
  emoji?: string
  time: string
  cutoffTime: string
  isActive: boolean
}

const SLOT_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }
const SLOT_EMOJI: Record<string, string> = { manha: '☀️', tarde: '🌙' }
const WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const round2 = (n: number) => Math.round(n * 100) / 100

type Phase = 'form' | 'waiting'

/**
 * MarketCheckoutScreen — checkout da Cestinha (pagamento misto crédito + dinheiro).
 * Split "usar pãezinhos" (padrão = máximo), seletor de entrega (corte respeitado), forma de
 * pagamento (só quando sobra dinheiro), sheet de confirmação (MKT-33) e espera do Pix/cartão.
 * O total e o split são recalculados no servidor no POST /market/checkout.
 */
export function MarketCheckoutScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cart, isLoading: cartLoading, reload: reloadCart } = useCart()
  const { avulsoUnit: catalogAvulso } = useMarketCatalog()
  const creditBalance = user?.creditBalance ?? 0
  const { dailyQty } = useSchedule(creditBalance)

  const avulso = cart.avulsoUnit || catalogAvulso
  const subtotal = cart.subtotal
  const maxApplicable = avulso > 0 ? Math.min(creditBalance, Math.floor(subtotal / avulso)) : 0

  // Consumo de saldo como antes: por padrão usa o saldo (o máximo que cobre) e paga a diferença
  // em dinheiro. O cliente só decide SE usa o saldo (toggle), não QUANTO.
  const [useCredits, setUseCredits] = useState(true)
  const credits = useCredits ? maxApplicable : 0
  const creditValue = round2(credits * avulso)
  const moneyAmount = round2(subtotal - creditValue)

  // ── Entrega (slots + corte) ──
  const [slots, setSlots] = useState<DeliverySlot[]>([])
  const [slotsLoaded, setSlotsLoaded] = useState(false)
  const [dateStr, setDateStr] = useState<string>(() => brtDateStr(new Date(), 1))
  const [slotId, setSlotId] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/client/condominium/slots')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: DeliverySlot[]) => setSlots(Array.isArray(d) ? d.filter((s) => s.isActive) : []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoaded(true))
  }, [])

  const now = new Date()
  const slotOpen = (s: DeliverySlot, date: string) => !isPastCutoffForDelivery(s.time, s.cutoffTime, date, now)
  const dateHasOpenSlot = (date: string) => slots.some((s) => slotOpen(s, date))

  // Régua: hoje..+7; habilita a data só se tiver algum slot aberto.
  const stripDates = useMemo(() => Array.from({ length: 8 }, (_, i) => brtDateStr(now, i)), [slotsLoaded])
  // Default: primeira data com slot aberto (>= amanhã se hoje já fechou).
  useEffect(() => {
    if (!slotsLoaded) return
    if (!dateHasOpenSlot(dateStr)) {
      const firstOk = stripDates.find(dateHasOpenSlot)
      if (firstOk) setDateStr(firstOk)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsLoaded])

  const slotsForDate = slots.map((s) => ({ s, open: slotOpen(s, dateStr) }))
  // Auto-seleciona quando só há 1 slot aberto; limpa seleção inválida ao trocar data.
  useEffect(() => {
    const open = slotsForDate.filter((o) => o.open).map((o) => o.s)
    setSlotId((cur) => {
      if (open.length === 1) return open[0].slotId ?? open[0].name
      if (cur && !open.some((s) => (s.slotId ?? s.name) === cur)) return null
      return cur
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, slotsLoaded])

  const needsSlot = slots.length > 0
  const slotReady = !needsSlot || !!slotId

  // ── Pagamento (só quando sobra dinheiro) ──
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [method, setMethod] = useState<'pix' | 'card'>('pix')
  const [addCardOpen, setAddCardOpen] = useState(false)
  useEffect(() => {
    apiFetch('/users/me/cards')
      .then((r) => (r.ok ? r.json() : []))
      .then((cards: SavedCard[]) => {
        setSavedCards(cards)
        const def = cards.find((c) => c.isDefault) ?? cards[0]
        if (def) {
          setSelectedCardId(def.id)
          setMethod('card')
        }
      })
      .catch(() => {})
  }, [])

  // ── Aviso suave saldo × agenda ──
  const weeklyNeed = Object.values(dailyQty ?? {}).reduce((a, v) => a + (v || 0), 0)
  const leftover = creditBalance - credits
  const scheduleWarn = weeklyNeed > 0 && leftover < weeklyNeed

  // ── Estado do fluxo ──
  const [idemKey] = useState(() => crypto.randomUUID())
  const [phase, setPhase] = useState<Phase>('form')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pix, setPix] = useState<{ paymentId: string; qr: string; code: string } | null>(null)
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null)

  const doneState = (data: CheckoutResponse) => ({
    marketOrderId: data.marketOrderId,
    creditsApplied: data.creditsApplied,
    moneyAmount: data.moneyAmount,
    totalValue: data.totalValue,
    scheduledDate: data.scheduledDate,
    deliveryTime: data.deliveryTime,
    breadQty: data.breadQty,
  })

  const runCheckout = async (savedCardId?: string): Promise<string | null> => {
    const res = await apiFetch('/market/checkout', {
      method: 'POST',
      body: JSON.stringify({
        scheduledDate: dateStr,
        slotId: slotId ?? (slots[0]?.slotId ?? slots[0]?.name ?? ''),
        creditsApplied: credits,
        ...(moneyAmount > 0 ? { paymentMethod: method } : {}),
        ...(savedCardId ? { savedCardId } : {}),
        idempotencyKey: idemKey,
      }),
    })
    const data = (await res.json().catch(() => null)) as (CheckoutResponse & { error?: string }) | null
    if (!res.ok || !data) return data?.error ?? 'Não foi possível concluir o pedido.'

    void reloadCart() // servidor já limpou a Cestinha
    if (data.payment?.method === 'pix' && data.payment.pixCopyPaste) {
      setPix({ paymentId: data.payment.paymentId, qr: data.payment.pixQrCodeUrl ?? '', code: data.payment.pixCopyPaste })
      setPhase('waiting')
      return null
    }
    if (data.payment?.method === 'card' && data.payment.status === 'pending') {
      setPendingPaymentId(data.payment.paymentId)
      setPhase('waiting')
      return null
    }
    // money==0 ou cartão aprovado → sucesso
    navigate('/client/market/sucesso', { replace: true, state: doneState(data) })
    return null
  }

  // Confirmar via sheet (Pix ou cartão salvo).
  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const msg = await runCheckout(method === 'card' ? selectedCardId ?? undefined : undefined)
      if (msg) {
        setError(msg)
        setSheetOpen(false)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setSheetOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  // Cartão novo: salva o cartão e finaliza (não passa pelo sheet — o próprio botão confirma).
  const handleAddAndPay = async (paymentMethodId: string): Promise<string | null> => {
    try {
      const saveRes = await apiFetch('/users/me/cards', {
        method: 'POST',
        body: JSON.stringify({ paymentMethodId }),
      })
      if (!saveRes.ok) {
        const e = (await saveRes.json().catch(() => null)) as { error?: string } | null
        return e?.error ?? 'Não foi possível salvar o cartão.'
      }
      const card = (await saveRes.json()) as SavedCard
      return await runCheckout(card.id)
    } catch {
      return 'Erro de conexão. Tente novamente.'
    }
  }

  // Empurra para a Cestinha se ela ficou vazia (ex.: pedido já concluído).
  useEffect(() => {
    if (phase === 'form' && !cartLoading && cart.items.length === 0 && cart.breadQty === 0) {
      navigate('/client/market/cestinha', { replace: true })
    }
  }, [phase, cartLoading, cart.items.length, cart.breadQty, navigate])

  if (phase === 'waiting') {
    return (
      <WaitingView
        pix={pix}
        cardPaymentId={pendingPaymentId}
        onApproved={() =>
          navigate('/client/market/sucesso', {
            replace: true,
            state: {
              creditsApplied: credits,
              moneyAmount,
              totalValue: subtotal,
              scheduledDate: dateStr,
              deliveryTime: slots.find((s) => (s.slotId ?? s.name) === slotId)?.time ?? null,
              breadQty: cart.breadQty,
            },
          })
        }
        onGiveUp={() => navigate('/client/home')}
      />
    )
  }

  const canConfirm = subtotal >= cart.minimo && slotReady && !submitting

  return (
    <div style={{ background: 'var(--color-app-bg)', minHeight: 'calc(100dvh - 56px)', paddingBottom: 120 }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(10px + env(safe-area-inset-top)) 20px 8px' }}>
        <button onClick={() => navigate(-1)} aria-label="Voltar" style={backBtn}>
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
          Pagamento
        </h1>
      </div>

      <div style={{ padding: '4px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Resumo curto */}
        <Card>
          <RowBetween>
            <span style={muted}>{itemsLabel(cart.items.length, cart.breadQty)}</span>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text)' }}>{formatBRL(subtotal)}</strong>
          </RowBetween>
        </Card>

        {/* Entrega */}
        <Section title="Quando chega">
          <div className="cdp-carousel" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {stripDates.map((d) => {
              const enabled = !slotsLoaded || dateHasOpenSlot(d)
              const active = d === dateStr
              return (
                <button
                  key={d}
                  disabled={!enabled}
                  onClick={() => enabled && setDateStr(d)}
                  style={dateCard(active, enabled)}
                >
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: active ? 'var(--color-accent)' : 'var(--color-text-ter)' }}>
                    {d === brtDateStr(now, 0) ? 'Hoje' : d === brtDateStr(now, 1) ? 'Amanhã' : WEEKDAY[parseDate(d).getDay()]}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: active ? 'var(--color-accent)' : 'var(--color-text)' }}>
                    {parseDate(d).getDate()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 9.5, textTransform: 'uppercase', color: 'var(--color-text-ter)' }}>
                    {MONTHS[parseDate(d).getMonth()]}
                  </span>
                </button>
              )
            })}
          </div>
          {needsSlot && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              {slotsForDate.map(({ s, open }) => {
                const id = s.slotId ?? s.name
                const sel = slotId === id
                return (
                  <button key={id} disabled={!open} onClick={() => open && setSlotId(id)} style={slotPill(sel, !open)}>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, color: sel ? 'var(--color-accent)' : 'var(--color-text)' }}>
                      {(s.emoji ?? SLOT_EMOJI[s.name]) ? `${s.emoji ?? SLOT_EMOJI[s.name]} ` : ''}{s.label ?? SLOT_LABEL[s.name] ?? s.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)' }}>
                      {open ? s.time : `Corte ${s.cutoffTime}`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Section>

        {/* Usar do saldo — consome o saldo por padrão e paga a diferença em dinheiro.
            O cliente só liga/desliga (não escolhe quanto). */}
        {avulso > 0 && maxApplicable > 0 && (
          <Section title="Pãezinhos">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 16,
                padding: '13px 15px',
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--color-gold-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="wallet" size={20} color="var(--color-accent)" stroke={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  Usar do saldo
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                  {useCredits
                    ? `Usa ${credits} 🥖 · sobram ${creditBalance - credits} de ${creditBalance}`
                    : `Você tem ${creditBalance} 🥖 disponíveis`}
                </p>
              </div>
              <SwitchToggle on={useCredits} onChange={() => setUseCredits((v) => !v)} aria-label="Usar pãezinhos do saldo" />
            </div>
          </Section>
        )}

        {/* Balanço */}
        <Card>
          <RowBetween>
            <span style={muted}>Com pãezinhos</span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--color-accent)' }}>
              {credits} 🥖 <span style={{ color: 'var(--color-text-ter)', fontWeight: 600 }}>({formatBRL(creditValue)})</span>
            </span>
          </RowBetween>
          <div style={{ height: 1, background: 'var(--color-border-2)', margin: '10px 0' }} />
          <RowBetween>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--color-text)' }}>Em dinheiro</span>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text)' }}>{formatBRL(moneyAmount)}</strong>
          </RowBetween>
        </Card>

        {/* Aviso suave saldo × agenda */}
        {scheduleWarn && (
          <div style={{ display: 'flex', gap: 10, background: 'var(--color-gold-soft)', border: '1.5px solid var(--color-gold)', borderRadius: 14, padding: 13 }}>
            <Icon name="alert" size={18} color="var(--color-accent)" />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)', margin: 0, lineHeight: 1.45 }}>
              Isso deixa seu saldo abaixo do que sua agenda desta semana precisa (<strong>{weeklyNeed} 🥖</strong>). Você pode continuar mesmo assim.
            </p>
          </div>
        )}

        {/* Forma de pagamento (só quando sobra dinheiro) */}
        {moneyAmount > 0 && (
          <Section title="Como pagar o dinheiro">
            <div style={{ display: 'flex', gap: 8, marginBottom: savedCards.length > 0 || method === 'card' ? 12 : 0 }}>
              <MethodBtn active={method === 'pix'} onClick={() => { setMethod('pix'); setAddCardOpen(false) }} label="Pix" />
              <MethodBtn active={method === 'card'} onClick={() => setMethod('card')} label="Cartão" />
            </div>

            {method === 'card' && (
              <>
                {savedCards.length > 0 && !addCardOpen && (
                  <SavedCardsList cards={savedCards} loading={false} mode="select" selectedCardId={selectedCardId} onSelect={setSelectedCardId} />
                )}
                {savedCards.length > 0 && (
                  <button onClick={() => setAddCardOpen((v) => !v)} style={linkBtn}>
                    {addCardOpen ? 'Usar um cartão salvo' : '+ Novo cartão'}
                  </button>
                )}
                {(addCardOpen || savedCards.length === 0) && (
                  <div style={{ marginTop: 10 }}>
                    <AddCardForm submitLabel={`Pagar ${formatBRL(moneyAmount)} e confirmar`} onSubmit={handleAddAndPay} />
                  </div>
                )}
              </>
            )}
          </Section>
        )}

        {error && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>{error}</p>
        )}
      </div>

      {/* CTA fixa (esconde quando o formulário de cartão novo está aberto — ele tem botão próprio) */}
      {!(moneyAmount > 0 && method === 'card' && (addCardOpen || savedCards.length === 0)) && (
        <div style={footerBar}>
          <button onClick={() => canConfirm && setSheetOpen(true)} disabled={!canConfirm} style={primaryCta(canConfirm)}>
            {moneyAmount > 0 ? `Confirmar · ${formatBRL(subtotal)}` : `Confirmar com pãezinhos`}
          </button>
        </div>
      )}

      {/* Sheet de confirmação (MKT-33) */}
      {sheetOpen && (
        <ConfirmSheet
          itemsLabel={itemsLabel(cart.items.length, cart.breadQty)}
          whenLabel={whenLabel(dateStr, slots.find((s) => (s.slotId ?? s.name) === slotId))}
          credits={credits}
          creditValue={creditValue}
          moneyAmount={moneyAmount}
          total={subtotal}
          submitting={submitting}
          onConfirm={handleConfirm}
          onReview={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}

// ── Sub-view: espera de pagamento (Pix QR / cartão processando) ──
function WaitingView({
  pix,
  cardPaymentId,
  onApproved,
  onGiveUp,
}: {
  pix: { paymentId: string; qr: string; code: string } | null
  cardPaymentId: string | null
  onApproved: () => void
  onGiveUp: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [rejected, setRejected] = useState(false)
  const paymentId = pix?.paymentId ?? cardPaymentId
  const { isTimeout } = usePaymentPolling(
    rejected ? null : paymentId,
    () => onApproved(),
    () => setRejected(true),
    { maxAttempts: 40, intervalMs: 3000 },
  )
  const copy = async () => {
    if (!pix) return
    try {
      await navigator.clipboard.writeText(pix.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard indisponível */ }
  }
  return (
    <div style={{ background: 'var(--color-app-bg)', minHeight: 'calc(100dvh - 56px)', padding: 'calc(20px + env(safe-area-inset-top)) 20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0, alignSelf: 'flex-start' }}>
        {pix ? 'Pague com Pix' : 'Processando'}
      </h1>
      {pix && pix.qr && <img src={pix.qr} width={196} height={196} alt="QR Code Pix" style={{ borderRadius: 12 }} />}
      {pix && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', background: 'var(--color-surface-2)', borderRadius: 10, padding: 12, margin: 0, color: 'var(--color-text-sec)' }}>{pix.code}</p>
          <button onClick={copy} style={{ width: '100%', minHeight: 44, borderRadius: 'var(--radius-btn)', border: '1.5px solid var(--color-border)', background: copied ? 'var(--color-good-soft)' : 'var(--color-surface)', color: copied ? 'var(--color-good)' : 'var(--color-text)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            {copied ? 'Copiado!' : 'Copiar código'}
          </button>
        </div>
      )}
      {rejected ? (
        <StatusBox tone="bad" text="Pagamento não aprovado. Tente novamente." ctaLabel="Voltar" onCta={onGiveUp} />
      ) : isTimeout ? (
        <StatusBox tone="warn" text="Não detectamos o pagamento ainda. Você pode acompanhar pela Cestinha depois." ctaLabel="Voltar ao início" onCta={onGiveUp} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--color-gold-soft)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 800ms linear infinite' }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)', margin: 0 }}>Aguardando pagamento...</p>
        </div>
      )}
    </div>
  )
}

// ── Sheet de confirmação ──
function ConfirmSheet({
  itemsLabel,
  whenLabel,
  credits,
  creditValue,
  moneyAmount,
  total,
  submitting,
  onConfirm,
  onReview,
}: {
  itemsLabel: string
  whenLabel: string
  credits: number
  creditValue: number
  moneyAmount: number
  total: number
  submitting: boolean
  onConfirm: () => void
  onReview: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onReview() }}
    >
      <div style={{ width: '100%', background: 'var(--color-surface)', borderRadius: '22px 22px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--color-border)', alignSelf: 'center' }} />
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>Revisar pedido</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <RowBetween><span style={muted}>{itemsLabel}</span><span /></RowBetween>
          <RowBetween><span style={muted}>Chega</span><span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)' }}>{whenLabel}</span></RowBetween>
          {credits > 0 && (
            <RowBetween><span style={muted}>Com pãezinhos</span><span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-accent)', fontWeight: 700 }}>{credits} 🥖 ({formatBRL(creditValue)})</span></RowBetween>
          )}
          <RowBetween><span style={muted}>Em dinheiro</span><span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)', fontWeight: 700 }}>{formatBRL(moneyAmount)}</span></RowBetween>
          <div style={{ height: 1, background: 'var(--color-border-2)', margin: '2px 0' }} />
          <RowBetween>
            <strong style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-text)' }}>Total a pagar</strong>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text)' }}>{formatBRL(total)}</strong>
          </RowBetween>
        </div>
        <button onClick={onConfirm} disabled={submitting} style={primaryCta(!submitting)}>
          {submitting ? 'Processando...' : `Confirmar e pagar · ${formatBRL(total)}`}
        </button>
        <button onClick={onReview} disabled={submitting} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text-sec)', padding: 6 }}>
          Revisar itens
        </button>
      </div>
    </div>
  )
}

// ── helpers de apresentação ──
interface CheckoutResponse {
  marketOrderId: string
  status: string
  totalValue: number
  creditsApplied: number
  moneyAmount: number
  scheduledDate: string
  deliveryTime: string | null
  breadQty: number
  payment?: {
    method: 'pix' | 'card'
    paymentId: string
    status: 'pending' | 'approved'
    pixCopyPaste?: string
    pixQrCodeUrl?: string
  }
}

function itemsLabel(products: number, bread: number): string {
  const parts: string[] = []
  if (products > 0) parts.push(`${products} ${products === 1 ? 'item' : 'itens'}`)
  if (bread > 0) parts.push(`${bread} 🥖`)
  return parts.join(' + ') || 'Cestinha'
}

function whenLabel(dateStr: string, slot?: DeliverySlot): string {
  const today = brtDateStr(new Date(), 0)
  const tomorrow = brtDateStr(new Date(), 1)
  const d = parseDate(dateStr)
  const dm = `${d.getDate()}/${d.getMonth() + 1}`
  const day = dateStr === today ? 'hoje' : dateStr === tomorrow ? 'amanhã' : dm
  const s = slot ? ` · ${slot.label ?? SLOT_LABEL[slot.name] ?? slot.name}` : ''
  return `${day}${s}`
}

const backBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }
const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)' }
const footerBar: React.CSSProperties = { position: 'fixed', left: 0, right: 0, bottom: 'calc(56px + env(safe-area-inset-bottom))', background: 'var(--color-app-bg)', borderTop: '1px solid var(--color-border-2)', padding: '12px 20px' }
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-accent)', padding: '10px 2px 2px' }

function primaryCta(enabled: boolean): React.CSSProperties {
  return { width: '100%', minHeight: 52, borderRadius: 'var(--radius-btn)', border: 'none', background: 'var(--color-espresso)', color: 'var(--color-primary-btn-text)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.45 }
}
function dateCard(active: boolean, enabled: boolean): React.CSSProperties {
  return { flex: '0 0 auto', width: 54, padding: '9px 0 8px', borderRadius: 14, border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`, background: active ? 'var(--color-gold-soft)' : 'var(--color-surface)', cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }
}
function slotPill(active: boolean, disabled: boolean): React.CSSProperties {
  return { flex: 1, padding: '12px 0', borderRadius: 16, border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`, background: active ? 'var(--color-gold-soft)' : 'var(--color-surface)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: 14 }}>{children}</div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', margin: '0 0 9px' }}>{title}</p>
      {children}
    </div>
  )
}
function RowBetween({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>{children}</div>
}
function MethodBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ flex: 1, minHeight: 44, borderRadius: 'var(--radius-btn)', border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)', background: active ? 'var(--color-surface)' : 'transparent', color: active ? 'var(--color-accent)' : 'var(--color-text-sec)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
      {label}
    </button>
  )
}
function StatusBox({ tone, text, ctaLabel, onCta }: { tone: 'bad' | 'warn'; text: string; ctaLabel: string; onCta: () => void }) {
  const bg = tone === 'warn' ? 'var(--color-gold-soft)' : 'var(--color-surface-2)'
  const border = tone === 'warn' ? 'var(--color-gold)' : 'var(--color-border)'
  return (
    <div style={{ width: '100%', background: bg, border: `1.5px solid ${border}`, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)', margin: 0, lineHeight: 1.45 }}>{text}</p>
      <button onClick={onCta} style={{ alignSelf: 'flex-start', minHeight: 44, padding: '10px 20px', borderRadius: 'var(--radius-btn)', border: 'none', background: 'var(--color-espresso)', color: '#FAF5EC', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{ctaLabel}</button>
    </div>
  )
}
