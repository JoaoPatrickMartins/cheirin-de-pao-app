import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { CreditBalanceCard } from '../../components/client/CreditBalanceCard'
import { Icon } from '../../components/brand/Icon'
import { useOrderTracking } from '../../hooks/useOrderTracking'
import { useNotif } from '../../contexts/NotifContext'
import { useSchedule } from '../../hooks/useSchedule'
import { useCreditBalanceSync } from '../../hooks/useCreditBalanceSync'
import { useAutoRecharge } from '../../hooks/useAutoRecharge'
import { apiFetch } from '../../lib/apiFetch'

const SLOT_LABEL: Record<string, string> = { manha: 'manhã', tarde: 'tarde' }

// Mapa de índice do dia da semana (getDay()) para chave de WeeklyQty
const DAY_KEY_MAP: Record<number, keyof ReturnType<typeof useSchedule>['weeklyQty']> = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab',
}

// Abreviações exibidas nos cards de próximas entregas
const DAY_ABBR: Record<string, string> = {
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
  dom: 'Dom',
}

function getGreeting(): string {
  const hours = new Date().getHours()
  if (hours < 12) return 'Bom dia'
  if (hours < 18) return 'Boa tarde'
  return 'Boa noite'
}

// "Seg 22" a partir da data ISO de uma entrega futura
function formatDeliveryDay(iso: string): string {
  const d = new Date(iso)
  const key = DAY_KEY_MAP[d.getDay()]
  return `${DAY_ABBR[key]} ${d.getDate()}`
}

interface QuickAction {
  label: string
  icon: keyof typeof import('../../components/brand/Icon').Ic
  path: string
}

export function HomeScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // fallbackToNext: quando não há entrega hoje, mostra a próxima entrega futura
  const { order, isToday } = useOrderTracking({ fallbackToNext: true })
  const { unreadCount } = useNotif()
  // Slots cuja PRÓXIMA entrega já está fechada (corte passou) — por slot do condomínio
  const [closedSlots, setClosedSlots] = useState<Array<{ name: string; deliveryWhen: string }>>([])

  // Mantém o saldo sincronizado com o servidor (refresh de página + troca de aba)
  useCreditBalanceSync()

  const creditBalance = user?.creditBalance ?? 0

  // Dados reais de agendamento para NextDays (GET /schedules/me via useSchedule).
  // dailyQty soma todos os slots (multi-slot) ou usa weeklyQty (single-slot).
  const { dailyQty, isLoading: scheduleLoading } = useSchedule(creditBalance)

  // Status da recarga automática — quando ativa, o saldo zerado não é risco (o sistema recarrega).
  const { status: autoRecharge, loading: autoRechargeLoading } = useAutoRecharge()

  // Próximos 5 dias a partir de amanhã (BRT)
  const nextDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    const key = DAY_KEY_MAP[d.getDay()]
    return {
      abbr: DAY_ABBR[key],
      dayNum: d.getDate(),
      qty: dailyQty?.[key] ?? 0,
      key,
    }
  })

  const hasSchedule = Object.values(dailyQty).some((v) => v > 0)

  useEffect(() => {
    // Status de corte por slot do condomínio do cliente (autenticado)
    apiFetch('/settings/cutoff-status')
      .then((res) => (res.ok ? res.json() : { slots: [] }))
      .then((data: { slots?: Array<{ name: string; locked: boolean; deliveryWhen: string }> }) => {
        setClosedSlots(
          (data.slots ?? [])
            .filter((s) => s.locked)
            .map((s) => ({ name: s.name, deliveryWhen: s.deliveryWhen })),
        )
      })
      .catch(() => {
        // Falha silenciosa — não exibe banner em caso de erro de rede
        setClosedSlots([])
      })
  }, [])

  const firstName = user?.name?.split(' ')[0] ?? 'você'
  const greeting = getGreeting()

  const quickActions: QuickAction[] = [
    { label: 'Comprar créditos',     icon: 'coin',     path: '/client/creditos'            },
    { label: 'Avulso',               icon: 'edit',     path: '/client/creditos?tab=avulso' },
    { label: 'Minha agenda',         icon: 'calendar', path: '/client/agenda'              },
  ]

  return (
    <div
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Greeting + Bell */}
      <div
        style={{
          paddingTop: 8,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-ter)',
              margin: '0 0 4px',
              letterSpacing: '0.01em',
            }}
          >
            Condomínio
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 22,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            {greeting}, {firstName}
          </h1>
        </div>
        <button
          onClick={() => navigate('/client/notificacoes')}
          aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
          style={{
            position: 'relative',
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="bell" size={20} color="var(--color-accent)" />
          {unreadCount > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 9,
                right: 9,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--color-gold)',
              }}
            />
          )}
        </button>
      </div>

      {/* Aviso leve de prazo — abaixo do header; a próxima entrega do slot já fechou */}
      {closedSlots.length > 0 && (
        <div
          style={{
            background: 'var(--color-surface-2)',
            border: '1.5px solid var(--color-accent)',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            gap: 11,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--color-surface)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <Icon name="clock" size={17} color="var(--color-gold)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14.5,
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.01em',
              }}
            >
              Eita, foi por pouquin!
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 500,
                color: 'var(--color-text-sec)',
                lineHeight: 1.4,
              }}
            >
              {`${closedSlots
                .map((s) => `A ${SLOT_LABEL[s.name] ?? s.name} de ${s.deliveryWhen} já fechou.`)
                .join(' ')} Os próximos dias seguem tudo certin pra agendar! 🥖`}
            </span>
          </div>
        </div>
      )}

      {/* Credit Balance Card */}
      <CreditBalanceCard
        creditBalance={creditBalance}
        isLoading={false}
      />

      {/* TodayDelivery — funcional com 3 estados: SCHEDULED / OUT_FOR_DELIVERY / DELIVERED */}
      <div
        onClick={() => navigate('/client/pedidos')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/client/pedidos')}
        aria-label="Ver entrega de hoje"
        style={{
          background: order ? 'var(--color-espresso)' : 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-soft)',
          position: 'relative',
          overflow: 'hidden',
          opacity: order?.status === 'DELIVERED' ? 0.85 : 1,
        }}
      >
        {!order && (
          <>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--color-text-ter)',
                letterSpacing: '0.04em',
                margin: '0 0 8px',
                textTransform: 'uppercase' as const,
              }}
            >
              ENTREGA DE HOJE
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--color-text-sec)',
                margin: 0,
              }}
            >
              Nenhuma entrega agendada
            </p>
          </>
        )}
        {order && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon
                name={
                  order.status === 'SCHEDULED'
                    ? 'calendar'
                    : order.status === 'OUT_FOR_DELIVERY'
                      ? 'truck'
                      : 'check'
                }
                size={24}
                color="#E3AC3F"
              />
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#E3AC3F',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase' as const,
                    margin: '0 0 2px',
                  }}
                >
                  {!isToday
                    ? 'PRÓXIMA ENTREGA'
                    : order.status === 'SCHEDULED'
                      ? 'AGENDADO'
                      : order.status === 'OUT_FOR_DELIVERY'
                        ? 'SAINDO DO FORNO'
                        : 'ENTREGUE'}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 16,
                    color: '#FAF5EC',
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {order.quantity === 1 ? '1 pãozinho' : `${order.quantity} pãezinhos`}
                  {isToday
                    ? order.status === 'SCHEDULED'
                      ? ' · Hoje'
                      : ''
                    : ` · ${formatDeliveryDay(order.scheduledDate)}`}
                </p>
              </div>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 99,
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 11.5,
                background: order.status === 'OUT_FOR_DELIVERY'
                  ? 'var(--color-good-soft)'
                  : 'var(--color-surface-2)',
                color: order.status === 'OUT_FOR_DELIVERY'
                  ? 'var(--color-good)'
                  : 'var(--color-text-sec)',
              }}
            >
              {order.status === 'OUT_FOR_DELIVERY' && (
                <div
                  style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-good)', flexShrink: 0 }}
                />
              )}
              {order.status === 'SCHEDULED'
                ? 'Agendado'
                : order.status === 'OUT_FOR_DELIVERY'
                  ? 'A caminho'
                  : 'Entregue hoje'}
            </div>
          </div>
        )}
      </div>

      {/* Aviso de risco — só quando há agenda ativa, saldo zerado e SEM recarga automática
          (com recarga ligada o sistema cobre; sem agenda o card de saldo já basta). Fala a
          consequência ("perder entregas"), não o estado do saldo. */}
      {hasSchedule && creditBalance === 0 && !autoRechargeLoading && !autoRecharge?.active && (
        <div
          style={{
            background: 'var(--color-gold-soft)',
            border: '1.5px solid var(--color-gold)',
            borderRadius: 16,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="alert" size={20} color="var(--color-accent)" />
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--color-text)',
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Sua agenda está ativa, mas você está <strong>sem créditos</strong>. Adicione
              créditos para não perder as próximas entregas. 🥖
            </p>
          </div>
          <button
            onClick={() => navigate('/client/creditos')}
            style={{
              alignSelf: 'flex-start',
              minHeight: 44,
              padding: '8px 16px',
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'var(--color-gold)',
              color: 'var(--color-espresso)',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Comprar créditos
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-ter)',
            letterSpacing: '0.04em',
            margin: '0 0 14px',
            textTransform: 'uppercase' as const,
          }}
        >
          AÇÕES RÁPIDAS
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}
        >
          {quickActions.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '8px 4px',
                minHeight: 44,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'var(--color-surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name={action.icon} size={20} color="var(--color-accent)" stroke={2} />
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--color-text-sec)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Próximas Entregas — dados reais do agendamento semanal (GET /schedules/me) */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Próximas entregas
          </p>
          <button
            onClick={() => navigate('/client/agenda')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-accent)',
              padding: 0,
            }}
          >
            Editar agenda
          </button>
        </div>

        {scheduleLoading ? (
          /* Placeholder durante carregamento */
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 70,
                  borderRadius: 16,
                  background: 'var(--color-surface-2)',
                }}
              />
            ))}
          </div>
        ) : !hasSchedule ? (
          /* Sem agendamento configurado */
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-text-sec)',
              margin: 0,
            }}
          >
            Configure sua agenda para ver as próximas entregas
          </p>
        ) : (
          /* Cards dos próximos 5 dias com dados reais do weeklyQty */
          <div style={{ display: 'flex', gap: 8 }}>
            {nextDays.map((day) => (
              <div
                key={day.key + day.dayNum}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  padding: '12px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--color-surface-2)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--color-text-ter)',
                  }}
                >
                  {day.abbr}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    lineHeight: 1,
                  }}
                >
                  {day.dayNum}
                </span>
                {day.qty > 0 ? (
                  <div
                    style={{
                      background: 'var(--color-gold)',
                      borderRadius: 99,
                      padding: '2px 6px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: 'var(--color-espresso)',
                      }}
                    >
                      {day.qty} pão
                    </span>
                  </div>
                ) : (
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: 'var(--color-text-ter)',
                    }}
                  >
                    folga
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
