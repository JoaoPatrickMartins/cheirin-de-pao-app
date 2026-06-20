/**
 * ScheduleScreen — tela de agenda semanal do cliente
 *
 * Permite configurar quantidade de pãezinhos por dia da semana, horário de entrega,
 * lembrete de reconfiguração semanal e exibe cobertura de créditos.
 * Suporta modo single-slot (1 horário) e multi-slot (2 horários por dia).
 *
 * Requirements: SCHED-02, SCHED-04, SCHED-05, SCHED-06, MSCHED-01, MSCHED-03
 * Source: screens-order.jsx linhas 173–253, 04-UI-SPEC.md seções 1–6, 14-UI-SPEC.md
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useSchedule, WeeklyQty } from '../../hooks/useSchedule'
import { Icon } from '../../components/brand/Icon'
import StepperInline from '../../components/client/StepperInline'
import DeliveryTimeChips, { DeliverySlot } from '../../components/client/DeliveryTimeChips'
import BannerCobertura from '../../components/client/BannerCobertura'
import { apiFetch } from '../../lib/apiFetch'

// Dados dos 7 dias da semana
const DAYS = [
  { label: 'Seg', key: 'seg' as const },
  { label: 'Ter', key: 'ter' as const },
  { label: 'Qua', key: 'qua' as const },
  { label: 'Qui', key: 'qui' as const },
  { label: 'Sex', key: 'sex' as const },
  { label: 'Sáb', key: 'sab' as const },
  { label: 'Dom', key: 'dom' as const },
]

const DEFAULT_WEEKLY_QTY: WeeklyQty = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }

export function ScheduleScreen() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const creditBalance = user?.creditBalance ?? 0
  const showCondoBanner = user?.condominiumJustChanged === true

  const {
    weeklyQty,
    deliveryTime,
    notifyReconfigure,
    setWeeklyQty,
    setDeliveryTime,
    setNotifyReconfigure,
    days,
    setDays,
    saveSchedule,
    isLoading,
    isSaving,
    consumoSemanal,
    cobre,
  } = useSchedule(creditBalance)

  const [slots, setSlots] = useState<DeliverySlot[]>([])
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  // D-05: isMultiSlot quando há 2+ slots ativos no condomínio
  const activeSlots = slots.filter((s) => s.isActive)
  const isMultiSlot = activeSlots.length >= 2

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const res = await apiFetch('/client/condominium/slots')
        if (res.ok) {
          const data = (await res.json()) as DeliverySlot[]
          setSlots(data)
          // D-13: inicializar days zerado para condo multi-slot sem schedule.days preexistente
          const activos = data.filter((s) => s.isActive)
          if (activos.length >= 2 && Object.keys(days).length === 0) {
            const initDays: Record<string, WeeklyQty> = {}
            activos.forEach((slot) => {
              initDays[slot.time] = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }
            })
            setDays(initDays)
          }
        } else {
          console.warn('[ScheduleScreen] GET /client/condominium/slots retornou status', res.status)
        }
      } catch (err) {
        console.warn('[ScheduleScreen] Erro ao buscar slots de entrega:', err)
      }
    }
    fetchSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    if (isSaving) return
    const result = await saveSchedule(slots)  // D-12: passa slots para determinar modo
    if (result.ok) {
      updateUser({ condominiumJustChanged: false })
    }
    setToast({
      message: result.ok ? 'Agenda salva!' : (result.error ?? 'Não conseguimos salvar. Tente novamente.'),
      ok: result.ok,
    })
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toast de feedback */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            borderRadius: 12,
            padding: '12px 16px',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          }}
        >
          {toast.message}
        </div>
      )}

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
          Agenda semanal
        </h1>
      </div>

      {/* Banner: mudança de condomínio */}
      {showCondoBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#F3DDA6',
            borderLeft: '3px solid var(--color-accent)',
            borderRadius: 12,
            padding: '12px 16px',
            margin: '0 16px 16px',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          <Icon name="alert" size={18} color="var(--color-accent)" />
          <span>Você mudou de condomínio. Configure sua nova agenda semanal.</span>
        </div>
      )}

      {/* Área scrollável */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 20px',
          paddingBottom: 90,
        }}
      >
        {/* Subtexto introdutório — condicional por modo */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--color-text-sec)',
            lineHeight: 1.5,
            marginBottom: 16,
            marginTop: 0,
          }}
        >
          {isMultiSlot
            ? 'Quantos pães em cada horário por dia. A gente entrega no horário certo, todo dia, sem você precisar fazer nada.'
            : 'Quantos pães em cada dia. A gente entrega sozinho, todo dia, no horário escolhido.'}
        </p>

        {/* Conteúdo principal — bifurcação single-slot vs multi-slot */}
        {isMultiSlot ? (
          /* MODO MULTI-SLOT: 2 seções com headers de horário */
          isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 64,
                    borderRadius: 18,
                    background: 'var(--color-surface-2)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    marginTop: i === 7 ? 24 : 0,
                  }}
                />
              ))}
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.5; }
                }
              `}</style>
            </div>
          ) : (
            <div>
              {activeSlots.map((slot, idx) => (
                <div key={slot.time} style={{ marginTop: idx > 0 ? 24 : 0 }}>
                  {/* Separador entre seções (exceto a primeira) */}
                  {idx > 0 && (
                    <div
                      style={{
                        borderTop: '1px solid var(--color-border-2)',
                        marginBottom: 16,
                      }}
                    />
                  )}

                  {/* Header pill da seção — D-06 */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--color-surface-2)',
                      borderRadius: 12,
                      padding: '8px 12px',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {slot.name === 'manha' ? '☀️ Manhã' : '🌙 Tarde'} · {slot.time}
                    </span>
                  </div>

                  {/* 7 day-rows para este slot */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {DAYS.map(({ label, key }) => {
                      const v = (days[slot.time] ?? DEFAULT_WEEKLY_QTY)[key]
                      return (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            background: 'var(--color-surface)',
                            borderRadius: 18,
                            border: '1px solid var(--color-border-2)',
                            padding: '12px 16px',
                            opacity: v === 0 ? 0.66 : 1,
                            transition: 'opacity .15s',
                          }}
                        >
                          <div style={{ width: 44, flexShrink: 0 }}>
                            <p
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontWeight: 700,
                                fontSize: 'var(--text-base)',
                                color: 'var(--color-text)',
                                margin: 0,
                                lineHeight: 1.2,
                              }}
                            >
                              {label}
                            </p>
                            <p
                              style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-text-ter)',
                                margin: 0,
                                marginTop: 2,
                              }}
                            >
                              {v === 0 ? 'folga' : `${v} pães`}
                            </p>
                          </div>

                          <div style={{ flex: 1 }} />

                          <StepperInline
                            min={0}
                            max={12}
                            value={v}
                            onChange={(newV) =>
                              setDays({
                                ...days,
                                [slot.time]: { ...(days[slot.time] ?? DEFAULT_WEEKLY_QTY), [key]: newV },
                              })
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* MODO SINGLE-SLOT: layout original inalterado */
          <>
            {/* Chips de horário de entrega */}
            <DeliveryTimeChips slots={slots} value={deliveryTime} onChange={setDeliveryTime} />

            {/* Lista de 7 Day-Rows */}
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 64,
                      borderRadius: 18,
                      background: 'var(--color-surface-2)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ))}
                <style>{`
                  @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                  }
                `}</style>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DAYS.map(({ label, key }) => {
                  const v = weeklyQty[key]
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        background: 'var(--color-surface)',
                        borderRadius: 18,
                        border: '1px solid var(--color-border-2)',
                        padding: '12px 16px',
                        opacity: v === 0 ? 0.66 : 1,
                        transition: 'opacity .15s',
                      }}
                    >
                      {/* Coluna de label */}
                      <div style={{ width: 44, flexShrink: 0 }}>
                        <p
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 15,
                            color: 'var(--color-text)',
                            margin: 0,
                            lineHeight: 1.2,
                          }}
                        >
                          {label}
                        </p>
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            color: 'var(--color-text-ter)',
                            margin: 0,
                            marginTop: 2,
                          }}
                        >
                          {v === 0 ? 'folga' : `${v} pães`}
                        </p>
                      </div>

                      {/* Espaçador */}
                      <div style={{ flex: 1 }} />

                      {/* StepperInline */}
                      <StepperInline
                        min={0}
                        max={12}
                        value={v}
                        onChange={(newV) => setWeeklyQty({ ...weeklyQty, [key]: newV })}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Card "Lembrar de reconfigurar" */}
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border-2)',
            padding: 16,
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 13,
          }}
        >
          {/* Ícone container */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'var(--color-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="repeat" size={20} color="var(--color-accent)" />
          </div>

          {/* Textos */}
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 14.5,
                color: 'var(--color-text)',
                margin: 0,
              }}
            >
              Lembrar de reconfigurar
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--color-text-ter)',
                margin: '2px 0 0 0',
              }}
            >
              Aviso no domingo à noite p/ ajustar a semana
            </p>
          </div>

          {/* Switch toggle */}
          <button
            onClick={() => setNotifyReconfigure(!notifyReconfigure)}
            aria-label={notifyReconfigure ? 'desativar lembrete' : 'ativar lembrete'}
            style={{
              width: 48,
              height: 28,
              borderRadius: 999,
              border: 'none',
              background: notifyReconfigure ? 'var(--color-gold)' : 'var(--color-border)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background .2s',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 3,
                left: notifyReconfigure ? 23 : 3,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: notifyReconfigure ? 'var(--color-espresso)' : 'var(--color-surface)',
                transition: 'left .2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>

        {/* BannerCobertura */}
        <BannerCobertura
          semana={consumoSemanal}
          saldo={creditBalance}
          cobre={cobre}
          onCombos={() => navigate('/client/creditos')}
          onAutoBuy={() => navigate('/client/creditos/recorrente')}
        />
      </div>

      {/* Footer fixo */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '14px 20px',
          paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--color-border-2)',
          background: 'var(--color-app-bg)',
        }}
      >
        {/* Linha de resumo */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-sec)',
              margin: 0,
            }}
          >
            Consumo semanal
          </p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'var(--text-xl)',
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            {/* D-07: multi-slot omite horário no footer */}
            {isMultiSlot ? `${consumoSemanal} pães` : `${consumoSemanal} pães · ${deliveryTime}`}
          </p>
        </div>

        {/* Botão "Salvar agenda" */}
        <button
          onClick={handleSave}
          disabled={isSaving}
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
            cursor: isSaving ? 'default' : 'pointer',
            opacity: isSaving ? 0.65 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'opacity .15s',
          }}
        >
          {isSaving ? (
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
              Salvando...
            </>
          ) : (
            <>
              <Icon name="check" size={18} color="var(--color-primary-btn-text)" />
              Salvar agenda
            </>
          )}
        </button>
      </div>
    </div>
  )
}
