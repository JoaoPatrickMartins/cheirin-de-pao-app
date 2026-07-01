/**
 * SingleScreen — tela de pedido único do cliente
 *
 * Agenda uma entrega única para uma data específica. O cliente escolhe a quantidade
 * e a data; se o saldo cobre o pedido, os créditos são reservados na hora
 * (POST /orders). Se faltar crédito, a tela cobra apenas a diferença (Pix ou cartão
 * salvo) e o pedido é criado automaticamente assim que o pagamento é aprovado.
 *
 * Requirements: SCHED-01
 * Source: screens-order.jsx linhas 255–324, 04-UI-SPEC.md seções 7–12
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { Icon } from '../../components/brand/Icon'
import QuantityStepper from '../../components/client/QuantityStepper'
import { apiFetch } from '../../lib/apiFetch'
import { brtDateStr, isPastCutoffForDelivery } from '../../lib/cutoff'

interface DeliverySlot {
  name: string
  label?: string
  emoji?: string
  time: string
  cutoffTime: string
  isActive: boolean
}

// Fallback caso a API não traga label/emoji (slots legados)
const SLOT_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }

const formatBRL = (val: number) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--color-text-sec)',
  margin: '0 0 9px',
}

const WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const SLOT_EMOJI: Record<string, string> = { manha: '☀️', tarde: '🌙' }

/** Card de dia da régua deslizável. */
function dayCardStyle(active: boolean): React.CSSProperties {
  return {
    flex: '0 0 auto',
    width: 54,
    padding: '9px 0 8px',
    borderRadius: 14,
    border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-gold-soft)' : 'var(--color-surface)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    transition: 'background .15s, border-color .15s',
  }
}

/** Pílula de slot (manhã/tarde). */
function slotPillStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '12px 0',
    borderRadius: 16,
    border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-gold-soft)' : 'var(--color-surface)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    transition: 'background .15s, border-color .15s',
  }
}

export function SingleScreen() {
  const navigate = useNavigate()
  const { user, updateCreditBalance } = useAuth()
  const creditBalance = user?.creditBalance ?? 0

  const [qtd, setQtd] = useState(1)
  const [slots, setSlots] = useState<DeliverySlot[]>([])
  const [slotsLoaded, setSlotsLoaded] = useState(false)
  // Data pré-selecionada em "amanhã"; o slot continua exigindo escolha explícita.
  const [quando, setQuando] = useState<string | null>(() => brtDateStr(new Date(), 1))
  const [deliveryTime, setDeliveryTime] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix')
  const [avulsoUnit, setAvulsoUnit] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Preço por pão (avulso) — usado para cobrar a diferença quando falta crédito.
  useEffect(() => {
    apiFetch('/pricing')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { avulsoUnit?: number } | null) => {
        if (data?.avulsoUnit !== undefined) setAvulsoUnit(data.avulsoUnit)
      })
      .catch(() => {})
  }, [])

  // Slots de entrega do condomínio (manhã/tarde) para o seletor "Para quando?".
  useEffect(() => {
    apiFetch('/client/condominium/slots')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DeliverySlot[]) =>
        setSlots(Array.isArray(data) ? data.filter((s) => s.isActive) : []),
      )
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoaded(true))
  }, [])

  // Eixos de "Para quando?": data (hoje..+30d) × slot, com disponibilidade por corte.
  const now = new Date()
  const todayStr = brtDateStr(now, 0)
  const tomorrowStr = brtDateStr(now, 1)
  const maxStr = brtDateStr(now, 30)
  // "Hoje" só é ofertado se algum slot ainda está aberto hoje; sem slots, o piso é amanhã.
  const minStr = slots.length > 0 ? todayStr : tomorrowStr

  const slotAvailable = (slot: DeliverySlot, dateStr: string) =>
    !isPastCutoffForDelivery(slot.time, slot.cutoffTime, dateStr, now)
  const showHoje = slots.some((s) => slotAvailable(s, todayStr))

  const slotOptions = slots.map((slot) => ({
    slot,
    available: quando ? slotAvailable(slot, quando) : false,
  }))

  // Régua de dias: do piso (hoje se houver slot aberto, senão amanhã) por 14 dias.
  // Garante que uma data distante escolhida no calendário também apareça selecionada.
  const todayMonth = parseDate(todayStr).getMonth()
  const floorOffset = showHoje ? 0 : 1
  const stripDates: string[] = []
  for (let i = floorOffset; i < floorOffset + 14; i++) stripDates.push(brtDateStr(now, i))
  if (quando && !stripDates.includes(quando) && quando >= minStr && quando <= maxStr) {
    stripDates.push(quando)
    stripDates.sort()
  }
  const dayLabel = (d: string) =>
    d === todayStr ? 'Hoje' : d === tomorrowStr ? 'Amanhã' : WEEKDAY[parseDate(d).getDay()]

  const escolherData = (dateStr: string) => {
    setQuando(dateStr)
    // Se o slot já escolhido não está mais disponível na nova data, limpa a seleção.
    if (deliveryTime) {
      const slot = slots.find((s) => s.time === deliveryTime)
      if (slot && !slotAvailable(slot, dateStr)) setDeliveryTime(null)
    }
  }

  // Abre o seletor nativo de data. showPicker() é o método correto (o .click() não abre
  // o calendário quando o input está escondido); cai para .click() em navegadores antigos.
  const openDatePicker = () => {
    const el = dateInputRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker()
        return
      } catch {
        // alguns contextos lançam (ex.: sem gesto do usuário) — usa o fallback
      }
    }
    el.click()
  }

  const usaSaldo = Math.min(qtd, creditBalance)
  const deficit = Math.max(0, qtd - creditBalance)
  const precisaPagar = deficit > 0
  const totalPagar = (avulsoUnit ?? 0) * deficit

  // Exige data + (slot, quando o condomínio tem slots). Aguarda o fetch de slots para
  // não habilitar prematuramente. Para pagar a diferença, precisa do preço avulso.
  const slotPendente = !slotsLoaded || (slots.length > 0 && !deliveryTime)
  const isDisabled =
    !quando || slotPendente || isSubmitting || (precisaPagar && avulsoUnit === null)

  const pendingOrder = {
    quantity: qtd,
    scheduledDate: quando ?? '',
    ...(deliveryTime ? { deliveryTime } : {}),
  }

  // Saldo cobre o pedido inteiro → reserva direto via POST /orders.
  const handleReservar = async () => {
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          quantity: qtd,
          scheduledDate: quando,
          ...(deliveryTime ? { deliveryTime } : {}),
        }),
      })
      if (res.status === 201) {
        const data = (await res.json()) as { creditBalance?: number }
        if (data.creditBalance !== undefined) updateCreditBalance(data.creditBalance)
        navigate('/client/creditos/sucesso', {
          state: {
            kind: 'order',
            quantity: qtd,
            scheduledDate: quando,
            deliveryTime: deliveryTime ?? undefined,
          },
        })
      } else if (res.status === 400) {
        setErrorMsg('Créditos insuficientes para este pedido.')
      } else {
        setErrorMsg('Não conseguimos criar o pedido. Tente novamente.')
      }
    } catch {
      setErrorMsg('Não conseguimos criar o pedido. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Falta crédito → cobra a diferença; o pedido é criado após a aprovação do pagamento
  // (telas de Pix/Cartão chamam finalizePendingOrder com este pendingOrder).
  const handlePagarEAgendar = async () => {
    if (paymentMethod === 'card') {
      navigate('/client/creditos/cartao', {
        state: {
          customQuantity: deficit,
          amount: totalPagar,
          quantity: deficit,
          pendingOrder,
        },
      })
      return
    }

    // Pix: cria o pagamento da diferença e segue para a tela de espera.
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await apiFetch('/payments/pix', {
        method: 'POST',
        body: JSON.stringify({ customQuantity: deficit }),
      })
      if (res.ok) {
        const { paymentId, pixCopyPaste, pixQrCodeUrl } = (await res.json()) as {
          paymentId: string
          pixCopyPaste: string
          pixQrCodeUrl: string
        }
        navigate('/client/creditos/pix', {
          state: { paymentId, pixQrCodeUrl, pixCopyPaste, comboQuantity: deficit, pendingOrder },
        })
      } else {
        const err = (await res.json()) as { error?: string }
        setErrorMsg(err.error ?? 'Não conseguimos iniciar o pagamento. Tente novamente.')
      }
    } catch {
      setErrorMsg('Não conseguimos iniciar o pagamento. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    if (isDisabled) return
    if (precisaPagar) void handlePagarEAgendar()
    else void handleReservar()
  }

  const ctaLabel = precisaPagar
    ? `Pagar ${formatBRL(totalPagar)} e agendar`
    : 'Reservar e confirmar'

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 20px 14px',
          paddingTop: 'calc(6px + env(safe-area-inset-top))',
          background: 'var(--color-app-bg)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: 'none',
            background: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} color="var(--color-text)" />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 21,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Pedido único
        </h1>
      </div>

      {/* Área scrollável */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 20px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Subtexto introdutório */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--color-text-sec)',
            lineHeight: 1.5,
            marginBottom: 18,
            marginTop: 0,
          }}
        >
          Agende uma entrega avulsa para uma data. Use seus créditos ou pague só a
          diferença na hora.
        </p>

        {/* Card QuantityStepper */}
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border-2)',
            padding: 22,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--color-text-sec)',
              letterSpacing: '0.04em',
              margin: 0,
              marginBottom: 16,
              textTransform: 'uppercase',
            }}
          >
            QUANTOS PÃES?
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* warn === accent no tema claro (#B0702A) — cor mantida pelo componente em ambos os estados */}
            <QuantityStepper min={1} max={20} value={qtd} onChange={setQtd} showUnit />
          </div>
        </div>

        {/* Bloco inferior — preenche o espaço livre e fica perto do botão */}
        <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Para quando? — régua de dias deslizável + calendário para datas distantes */}
          <div>
            <p style={sectionLabel}>Para quando?</p>
            <style>{`.date-strip::-webkit-scrollbar{display:none}`}</style>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <div
                className="date-strip"
                style={{
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  flex: 1,
                  scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {stripDates.map((d) => {
                  const active = quando === d
                  const mes = parseDate(d).getMonth()
                  const accent = active ? 'var(--color-accent)' : 'var(--color-text)'
                  return (
                    <button key={d} onClick={() => escolherData(d)} style={dayCardStyle(active)}>
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 11,
                          fontWeight: 600,
                          color: active ? 'var(--color-accent)' : 'var(--color-text-ter)',
                          lineHeight: 1,
                        }}
                      >
                        {dayLabel(d)}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 18,
                          fontWeight: 800,
                          color: accent,
                          lineHeight: 1.15,
                        }}
                      >
                        {parseDate(d).getDate()}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 9.5,
                          fontWeight: 600,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                          color: active ? 'var(--color-accent)' : 'var(--color-text-ter)',
                          lineHeight: 1,
                          visibility: mes !== todayMonth ? 'visible' : 'hidden',
                        }}
                      >
                        {MONTHS[mes]}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={openDatePicker}
                aria-label="Escolher outra data"
                style={{
                  flex: '0 0 auto',
                  width: 48,
                  borderRadius: 14,
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name="calendar" size={20} color="var(--color-text)" />
              </button>
              <input
                ref={dateInputRef}
                type="date"
                min={minStr}
                max={maxStr}
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  border: 0,
                  opacity: 0,
                  pointerEvents: 'none',
                }}
                onChange={(e) => {
                  if (e.target.value) escolherData(e.target.value)
                }}
              />
            </div>
          </div>

          {/* Horário — slots do dia escolhido, habilitados conforme o corte de cada slot */}
          {slots.length > 0 && (
            <div>
              <p style={sectionLabel}>Horário</p>
              <div style={{ display: 'flex', gap: 10 }}>
                {slotOptions.map(({ slot, available }) => {
                  const selected = deliveryTime === slot.time
                  return (
                    <button
                      key={slot.time}
                      disabled={!available}
                      onClick={available ? () => setDeliveryTime(slot.time) : undefined}
                      style={slotPillStyle(selected, !available)}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 700,
                          fontSize: 14,
                          color: selected ? 'var(--color-accent)' : 'var(--color-text)',
                          lineHeight: 1.2,
                        }}
                      >
                        {(slot.emoji ?? SLOT_EMOJI[slot.name]) ? `${slot.emoji ?? SLOT_EMOJI[slot.name]} ` : ''}
                        {slot.label ?? SLOT_LABEL[slot.name] ?? slot.name}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 12,
                          color: 'var(--color-text-ter)',
                          lineHeight: 1.2,
                        }}
                      >
                        {available ? slot.time : `Corte às ${slot.cutoffTime}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        {/* Banner de erro backend */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 16,
              padding: '13px 14px',
            }}
          >
            <Icon name="alert" size={18} color="var(--color-accent)" />
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                color: 'var(--color-text)',
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              {errorMsg}
            </p>
          </div>
        )}

        {precisaPagar ? (
          /* PaymentCard — saldo não cobre: usa o que tem e paga a diferença */
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-2)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Saldo usado */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Icon name="wallet" size={20} color="var(--color-accent)" />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
                  {usaSaldo > 0 ? `Usa ${usaSaldo} do seu saldo` : 'Você não tem créditos'}
                </p>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--color-text)', margin: 0 }}>
                {usaSaldo} 🥖
              </p>
            </div>

            {/* Diferença a comprar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Icon name="plus" size={20} color="var(--color-accent)" />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
                  Comprar {deficit} {deficit === 1 ? 'pão' : 'pães'}
                </p>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--color-text)', margin: 0 }}>
                {avulsoUnit === null ? '—' : formatBRL(totalPagar)}
              </p>
            </div>

            {/* Toggle de método de pagamento */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {(['pix', 'card'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    borderRadius: 'var(--radius-btn)',
                    border:
                      paymentMethod === m
                        ? '1.5px solid var(--color-accent)'
                        : '1.5px solid var(--color-border)',
                    background: paymentMethod === m ? 'var(--color-surface-2)' : 'transparent',
                    color: paymentMethod === m ? 'var(--color-accent)' : 'var(--color-text-sec)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  {m === 'pix' ? 'Pix' : 'Cartão'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* CreditCard — saldo cobre o pedido */
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-2)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Lado esquerdo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Icon name="wallet" size={20} color="var(--color-accent)" />
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--color-text)',
                    margin: 0,
                  }}
                >
                  Usar créditos
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    color: 'var(--color-text-ter)',
                    margin: '2px 0 0 0',
                  }}
                >
                  Sobram {creditBalance - qtd} de {creditBalance} créditos
                </p>
              </div>
            </div>

            {/* Lado direito */}
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--color-text)',
                margin: 0,
                flexShrink: 0,
              }}
            >
              {qtd} 🥖
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--color-border-2)',
          background: 'var(--color-app-bg)',
        }}
      >
        <button
          onClick={handleSubmit}
          disabled={isDisabled}
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
            cursor: isDisabled ? 'default' : 'pointer',
            opacity: isDisabled ? 0.45 : 1,
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
              {ctaLabel}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
