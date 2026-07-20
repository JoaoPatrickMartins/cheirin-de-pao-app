/**
 * SingleScreen — tela de pedido único do cliente
 *
 * Agenda uma entrega única para uma data específica. O cliente escolhe a quantidade
 * e a data; se o saldo cobre o pedido, os créditos são reservados na hora
 * (POST /orders). Se faltar crédito, a tela cobra apenas a diferença (via Pix)
 * e o pedido é criado automaticamente assim que o pagamento é aprovado.
 *
 * Requirements: SCHED-01
 * Source: screens-order.jsx linhas 255–324, 04-UI-SPEC.md seções 7–12
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { Icon } from '../../components/brand/Icon'
import QuantityStepper from '../../components/client/QuantityStepper'
import { CutoffPopup } from '../../components/client/CutoffPopup'
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

// Sem teto funcional no pedido único — o cliente pode pedir o quanto precisar para
// atingir o mínimo do gancho grátis. Este valor é só um guardrail anti-abuso (casa com
// o `.max()` do Zod em orders.schema.ts).
const PEDIDO_UNICO_MAX = 100

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
  const [pedidoMinimo, setPedidoMinimo] = useState(1)
  const [slots, setSlots] = useState<DeliverySlot[]>([])
  const [slotsLoaded, setSlotsLoaded] = useState(false)
  // Data pré-selecionada em "amanhã"; o slot continua exigindo escolha explícita.
  const [quando, setQuando] = useState<string | null>(() => brtDateStr(new Date(), 1))
  const [deliveryTime, setDeliveryTime] = useState<string | null>(null)
  const [avulsoUnit, setAvulsoUnit] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cutoffDismissed, setCutoffDismissed] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Status do gancho — para o nudge "peça X pães e ganhe o gancho grátis".
  const [hookInfo, setHookInfo] = useState<{ hasHook: boolean; freeEligible: boolean; pedidoUnicoMin: number } | null>(null)
  // Diálogo de decisão exibido ao confirmar abaixo do mínimo do gancho grátis.
  const [showFreeHookPrompt, setShowFreeHookPrompt] = useState(false)

  // Preço por pão (avulso) + pedido mínimo — usados para cobrar a diferença e limitar a quantidade.
  useEffect(() => {
    apiFetch('/pricing')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { avulsoUnit?: number; pedidoMinimoUnico?: number } | null) => {
        if (data?.avulsoUnit !== undefined) setAvulsoUnit(data.avulsoUnit)
        if (typeof data?.pedidoMinimoUnico === 'number' && data.pedidoMinimoUnico >= 1) {
          setPedidoMinimo(data.pedidoMinimoUnico)
          // Sobe a quantidade para o mínimo se o cliente ainda não mexeu (começa em 1).
          setQtd((q) => (q < data.pedidoMinimoUnico! ? data.pedidoMinimoUnico! : q))
        }
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

  // Status do gancho — só é relevante para o nudge se o cliente ainda pode ganhar o grátis.
  useEffect(() => {
    apiFetch('/client/hook-request')
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { hasHook?: boolean; freeEligible?: boolean; pedidoUnicoMin?: number } | null) => {
        if (d && typeof d.pedidoUnicoMin === 'number') {
          setHookInfo({ hasHook: !!d.hasHook, freeEligible: !!d.freeEligible, pedidoUnicoMin: d.pedidoUnicoMin })
        }
      })
      .catch(() => {})
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

  // Aviso amigável de corte: horários do dia escolhido que já fecharam.
  const closedForDate = quando ? slotOptions.filter((o) => !o.available).map((o) => o.slot) : []
  const anyAvailableForDate = slotOptions.some((o) => o.available)
  const dateWord = quando === todayStr ? 'hoje' : quando === tomorrowStr ? 'amanhã' : 'essa data'
  const closedNotice =
    closedForDate.length > 0
      ? `${closedForDate
          .map(
            (s) =>
              `A ${(s.label ?? SLOT_LABEL[s.name] ?? s.name).toLowerCase()} de ${dateWord} já fechou (corte às ${s.cutoffTime}).`,
          )
          .join(' ')}${
          anyAvailableForDate
            ? ' Dá pra escolher outro horário aqui em cima pra receber seus pãezinhos. 🥖'
            : ' Escolha outra data pra receber seus pãezinhos fresquinhos. 🥖'
        }`
      : ''

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

  // Nudge do gancho grátis: só quando o cliente ainda não tem gancho e ainda não
  // qualificou por outra via (ex.: combo). O direito não expira — vale a 1ª vez que atingir.
  const podeGanharGratis = !!hookInfo && !hookInfo.hasHook && !hookInfo.freeEligible
  const freeThreshold = hookInfo?.pedidoUnicoMin ?? 0
  // Meta alcançável dentro do guardrail do pedido único.
  const completeTarget = Math.min(Math.max(freeThreshold, pedidoMinimo), PEDIDO_UNICO_MAX)
  const ganchoAlcancavel = podeGanharGratis && freeThreshold >= 1 && freeThreshold <= PEDIDO_UNICO_MAX
  const vaiGanharGratis = ganchoAlcancavel && qtd >= freeThreshold
  const abaixoDoLimite = ganchoAlcancavel && qtd < freeThreshold
  const faltamParaGancho = Math.max(0, freeThreshold - qtd)
  // Custo extra (em Pix) de completar até o mínimo do gancho, quando o saldo não cobre.
  const extraParaCompletar = Math.max(0, (avulsoUnit ?? 0) * (Math.max(0, completeTarget - creditBalance) - deficit))

  // Exige data + (slot, quando o condomínio tem slots). Aguarda o fetch de slots para
  // não habilitar prematuramente. Para pagar a diferença, precisa do preço avulso.
  const slotPendente = !slotsLoaded || (slots.length > 0 && !deliveryTime)
  const isDisabled =
    !quando || slotPendente || isSubmitting || (precisaPagar && avulsoUnit === null)

  // Saldo cobre o pedido inteiro → reserva direto via POST /orders.
  const handleReservar = async (quantity: number) => {
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          quantity,
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
            quantity,
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

  // Falta crédito → cobra a diferença via Pix; o pedido é criado após a aprovação do
  // pagamento (a tela de Pix chama finalizePendingOrder com este pendingOrder).
  const handlePagarEAgendar = async (quantity: number) => {
    const localDeficit = Math.max(0, quantity - creditBalance)
    const pendingOrder = {
      quantity,
      scheduledDate: quando ?? '',
      ...(deliveryTime ? { deliveryTime } : {}),
    }
    // Pix: cria o pagamento da diferença e segue para a tela de espera.
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await apiFetch('/payments/pix', {
        method: 'POST',
        // Envia a intenção do Pedido único junto: o servidor grava na metadata do MP e cria
        // a Order na aprovação do Pix mesmo com o app fechado. O front continua criando na
        // tela via finalizePendingOrder — idempotente por paymentId, sem duplicar.
        body: JSON.stringify({ customQuantity: localDeficit, order: pendingOrder }),
      })
      if (res.ok) {
        const { paymentId, pixCopyPaste, pixQrCodeUrl } = (await res.json()) as {
          paymentId: string
          pixCopyPaste: string
          pixQrCodeUrl: string
        }
        navigate('/client/creditos/pix', {
          state: { paymentId, pixQrCodeUrl, pixCopyPaste, comboQuantity: localDeficit, pendingOrder },
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

  // Executa o pedido para uma quantidade específica: reserva (saldo cobre) ou paga a diferença.
  const doSubmit = (quantity: number) => {
    if (quantity - creditBalance > 0) void handlePagarEAgendar(quantity)
    else void handleReservar(quantity)
  }

  const handleSubmit = () => {
    if (isDisabled) return
    // Abaixo do mínimo do gancho grátis → oferece completar antes de seguir.
    if (abaixoDoLimite) {
      setShowFreeHookPrompt(true)
      return
    }
    doSubmit(qtd)
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
      {/* Aviso flutuante de corte — some sozinho após alguns segundos ou no X */}
      <CutoffPopup
        open={closedForDate.length > 0 && !cutoffDismissed}
        onClose={() => setCutoffDismissed(true)}
      >
        {closedNotice}
      </CutoffPopup>

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
            <QuantityStepper min={pedidoMinimo} max={PEDIDO_UNICO_MAX} value={qtd} onChange={setQtd} showUnit />
          </div>
          {pedidoMinimo > 1 && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--color-text-ter)',
                margin: '14px 0 0',
              }}
            >
              Pedido mínimo de {pedidoMinimo} pães
            </p>
          )}

          {/* Nudge do gancho grátis — muda conforme a quantidade atinge (ou não) o mínimo. */}
          {vaiGanharGratis && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--color-good)',
                margin: '14px 0 0',
              }}
            >
              🎁 Este pedido te dá o gancho de porta grátis!
            </p>
          )}
          {abaixoDoLimite && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: '14px 0 0', lineHeight: 1.45 }}>
              🎁 Peça {freeThreshold}+ pães e ganhe o gancho de porta grátis
              {faltamParaGancho > 0 ? ` · faltam ${faltamParaGancho}` : ''}.{' '}
              <button
                type="button"
                onClick={() => setQtd(completeTarget)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: 'var(--color-accent)',
                }}
              >
                Completar
              </button>
            </p>
          )}
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

            {/* Pagamento via Pix (único método no pedido único) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 4,
                padding: '11px 12px',
                borderRadius: 'var(--radius-btn)',
                border: '1.5px solid var(--color-accent)',
                background: 'var(--color-surface-2)',
              }}
            >
              <Icon name="coin" size={18} color="var(--color-accent)" />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--color-accent)',
                }}
              >
                Pagamento via Pix
              </span>
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

      {/* Diálogo: oferecer completar até o mínimo do gancho grátis */}
      {showFreeHookPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gancho-prompt-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFreeHookPrompt(false)
          }}
        >
          <div style={{ background: 'var(--color-surface)', borderRadius: 22, padding: 22, width: '100%', maxWidth: 360 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background: 'var(--color-gold-soft)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 14px',
                fontSize: 28,
              }}
            >
              🎁
            </div>
            <h2
              id="gancho-prompt-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 19,
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
                textAlign: 'center',
                margin: '0 0 8px',
              }}
            >
              Ganhe o gancho grátis
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--color-text-sec)',
                textAlign: 'center',
                margin: '0 0 18px',
              }}
            >
              Peça pelo menos <strong style={{ color: 'var(--color-text)' }}>{freeThreshold} pães</strong> neste pedido e o
              gancho de porta vai junto, de graça. Você tem {qtd}
              {faltamParaGancho > 0 ? ` — faltam ${faltamParaGancho}` : ''}.
              {extraParaCompletar > 0 ? ` Completar adiciona ${formatBRL(extraParaCompletar)} via Pix.` : ''}
            </p>

            <button
              onClick={() => {
                setShowFreeHookPrompt(false)
                setQtd(completeTarget)
                doSubmit(completeTarget)
              }}
              style={{
                width: '100%',
                minHeight: 52,
                background: 'var(--color-espresso)',
                color: 'var(--color-primary-btn-text)',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'var(--font-display)',
                fontSize: 15.5,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                marginBottom: 10,
              }}
            >
              Completar para {completeTarget} pães
            </button>
            <button
              onClick={() => {
                setShowFreeHookPrompt(false)
                doSubmit(qtd)
              }}
              style={{
                width: '100%',
                minHeight: 48,
                background: 'transparent',
                color: 'var(--color-text-sec)',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'var(--font-body)',
                fontSize: 14.5,
                fontWeight: 700,
                border: '1.5px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              Continuar sem o gancho
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
