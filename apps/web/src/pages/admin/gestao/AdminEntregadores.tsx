import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { EntregadorForm, termsPendingFor, type CourierAdminView } from './EntregadorForm'
import { CRAvatar, CRTag } from '../../../components/courier/kit'
import { PAY_MODE_LABELS, VEHICLE_LABELS, type PayMode, type VehicleType } from '@cheirin-de-pao/shared'
import { CourierRouteScreen } from '../../../components/admin/CourierRouteScreen'
import { CourierPayouts } from './CourierPayouts'
import { CourierReports } from './CourierReports'
import type { SlotOption } from '../../../lib/slots'

// ------------------------------------------------------------------ tipos
type Entregador = CourierAdminView & { isBlocked: boolean }

/** "Moto · por entrega" · "Bicicleta · sem modalidade". */
function resumo(e: Entregador): string {
  const v = e.vehicle?.tipo ? VEHICLE_LABELS[e.vehicle.tipo as VehicleType] : 'Sem veículo'
  const m = e.pay?.modalidade ? PAY_MODE_LABELS[e.pay.modalidade as PayMode].label : 'sem modalidade'
  return `${v} · ${m}`
}

type SubTelaSub = null | 'criar' | 'editar' | 'pagamentos' | 'reportes'

interface AdminEntregadoresProps {
  onBack: () => void
}

// ------------------------------------------------------------------ componente
export function AdminEntregadores({ onBack }: AdminEntregadoresProps) {
  const [sub, setSub] = useState<SubTelaSub>(null)
  const [editing, setEditing] = useState<Entregador | null>(null)
  const [entregadores, setEntregadores] = useState<Entregador[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // A4: rota do entregador (rota salva, sugestão, alterações) por turno.
  const [routeFor, setRouteFor] = useState<{ courier: Entregador; slotId?: string } | null>(null)
  const [slots, setSlots] = useState<SlotOption[]>([])
  // A8: propostas de pagamento abertas (atalho no topo da lista).
  const [payoutsOpen, setPayoutsOpen] = useState<number | null>(null)
  // Problemas e ocorrências abertos (E11/E12).
  const [reportsOpen, setReportsOpen] = useState<number | null>(null)

  useEffect(() => {
    if (sub !== null) return
    let alive = true
    void (async () => {
      try {
        const res = await apiFetch('/admin/courier-payouts/summary')
        if (!res.ok || !alive) return
        const open = ((await res.json()) as { open?: unknown } | null)?.open
        if (alive) setPayoutsOpen(typeof open === 'number' ? open : null)
      } catch {
        // sem o número, o atalho continua abrindo
      }
    })()
    void (async () => {
      try {
        const res = await apiFetch('/admin/courier-reports/summary')
        if (!res.ok || !alive) return
        const open = ((await res.json()) as { open?: unknown } | null)?.open
        if (alive) setReportsOpen(typeof open === 'number' ? open : null)
      } catch {
        // idem
      }
    })()
    return () => {
      alive = false
    }
  }, [sub])

  useEffect(() => {
    if (!routeFor || slots.length > 0) return
    void (async () => {
      try {
        const res = await apiFetch('/admin/settings/slots')
        if (res.ok) setSlots(((await res.json()) as { slots: SlotOption[] }).slots ?? [])
      } catch {
        // sem turnos: a tela abre no turno padrão
      }
    })()
  }, [routeFor, slots.length])

  const fetchEntregadores = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/admin/couriers')
      if (res.ok) {
        setEntregadores((await res.json()) as Entregador[])
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchEntregadores()
  }, [fetchEntregadores])

  if (routeFor) {
    const options = slots.map((s) => ({ slotId: s.slotId, label: s.label, emoji: s.emoji }))
    const first = routeFor.slotId ?? options[0]?.slotId ?? 'manha'
    return <CourierRouteScreen courierId={routeFor.courier.id} slotId={first} slots={options} onBack={() => setRouteFor(null)} key={first} />
  }

  if (sub === 'pagamentos') return <CourierPayouts onBack={() => setSub(null)} />
  if (sub === 'reportes') return <CourierReports onBack={() => setSub(null)} />

  if (sub === 'criar') {
    return (
      <EntregadorForm
        onBack={() => setSub(null)}
        onSaved={() => {
          setSub(null)
          void fetchEntregadores()
        }}
      />
    )
  }

  if (sub === 'editar' && editing) {
    return (
      <EntregadorForm
        entregador={editing}
        onOpenRoute={(slotId) => setRouteFor({ courier: editing, slotId })}
        onBack={() => {
          setSub(null)
          setEditing(null)
        }}
        onSaved={() => {
          setSub(null)
          setEditing(null)
          void fetchEntregadores()
        }}
      />
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px 14px',
        }}
      >
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            width: 36,
            height: 36,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          Entregadores
        </h2>
      </div>

      {/* Conteúdo */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px' }}>
        <GoldBtn icon="plus" onClick={() => setSub('criar')}>
          Cadastrar entregador
        </GoldBtn>

        {/* A8: pagamentos da semana */}
        <button
          type="button"
          onClick={() => setSub('pagamentos')}
          style={{
            marginTop: 12,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 16,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-body)',
          }}
        >
          <Icon name="wallet" size={19} color="var(--color-accent)" />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>Pagamentos</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-sec)' }}>
              {payoutsOpen === null
                ? 'Propostas da semana e histórico'
                : payoutsOpen === 0
                  ? 'Nenhuma proposta a aprovar'
                  : `${payoutsOpen} ${payoutsOpen === 1 ? 'proposta' : 'propostas'} a aprovar`}
            </span>
          </span>
          <Icon name="chevR" size={16} color="var(--color-text-ter)" />
        </button>

        {/* E11/E12: problemas e ocorrências dos entregadores */}
        <button
          type="button"
          onClick={() => setSub('reportes')}
          style={{
            marginTop: 8,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 16,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-body)',
          }}
        >
          <Icon name="alert" size={19} color={reportsOpen ? 'var(--color-warn)' : 'var(--color-accent)'} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>Problemas e ocorrências</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-sec)' }}>
              {reportsOpen ? `${reportsOpen} ${reportsOpen === 1 ? 'aberto' : 'abertos'}` : 'Reportados pelos entregadores'}
            </span>
          </span>
          <Icon name="chevR" size={16} color="var(--color-text-ter)" />
        </button>

        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {entregadores.map((e) => (
              <EntregadorCard
                key={e.id}
                entregador={e}
                onEdit={() => {
                  setEditing(e)
                  setSub('editar')
                }}
                onRoute={() => setRouteFor({ courier: e })}
                onToggle={(newActive) => {
                  setEntregadores((prev) =>
                    prev.map((x) => (x.id === e.id ? { ...x, isBlocked: !newActive } : x)),
                  )
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ EntregadorCard
interface EntregadorCardProps {
  entregador: Entregador
  onEdit: () => void
  onRoute: () => void
  onToggle: (newActive: boolean) => void
}

function EntregadorCard({ entregador: e, onEdit, onRoute, onToggle }: EntregadorCardProps) {
  const [localActive, setLocalActive] = useState(!e.isBlocked)

  const handleToggle = async () => {
    const prev = localActive
    const next = !prev
    setLocalActive(next)
    onToggle(next)
    // Reverte também quando o servidor recusa (403/404/500) — antes só revertia em falha de
    // rede, e a tela mostrava o entregador desativado sem ele ter sido desativado.
    let ok = false
    try {
      const res = await apiFetch(`/admin/couriers/${e.id}/toggle`, { method: 'PATCH' })
      ok = res.ok
    } catch {
      ok = false
    }
    if (!ok) {
      setLocalActive(prev)
      onToggle(prev)
    }
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Linha principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar: foto do crachá ou iniciais */}
        <div style={{ opacity: localActive ? 1 : 0.5, transition: 'opacity 0.2s ease', flexShrink: 0 }}>
          <CRAvatar name={e.name} photoUrl={e.photoUrl} size={44} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {e.name}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-text-ter)',
              margin: '2px 0 0',
            }}
          >
            {localActive ? resumo(e) : 'Desativado'}
          </p>
          {localActive && (e.offToday || e.routeSuggestion || termsPendingFor(e)) && (
            <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
              {e.offToday && (
                <CRTag icon="dayoff" tone="good" size="sm">
                  de folga hoje
                </CRTag>
              )}
              {e.routeSuggestion && (
                <CRTag icon="route" tone="gold" size="sm">
                  sugestão de rota nova
                </CRTag>
              )}
              {termsPendingFor(e) && (
                <CRTag icon="doc" tone="warn" size="sm">
                  termo pendente
                </CRTag>
              )}
            </div>
          )}
        </div>

        {/* Rota do entregador (A4) */}
        <button
          type="button"
          aria-label={`Rota de ${e.name}`}
          onClick={onRoute}
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="route" size={17} color="var(--color-text-sec)" />
        </button>

        {/* Botão editar */}
        <button
          type="button"
          aria-label={`Editar entregador ${e.name}`}
          onClick={onEdit}
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="edit" size={17} color="var(--color-text-sec)" />
        </button>

        {/* Switch */}
        <SwitchToggle on={localActive} onChange={() => void handleToggle()} />
      </div>

      {/* Footer */}
      {(e.cpf || e.phone) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--color-border-2)',
          }}
        >
          {e.cpf && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="card" size={13} color="var(--color-text-ter)" />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-ter)',
                }}
              >
                {e.cpf}
              </span>
            </div>
          )}
          {e.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="phone" size={13} color="var(--color-text-ter)" />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-ter)',
                }}
              >
                {e.phone}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ primitivas locais
interface GoldBtnProps {
  icon: string
  onClick: () => void
  children: React.ReactNode
}

function GoldBtn({ icon, onClick, children }: GoldBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        minHeight: 44,
        background: 'var(--color-espresso)',
        color: '#FAF5EC',
        border: 'none',
        borderRadius: 14,
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '-0.01em',
      }}
    >
      <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} color="#FAF5EC" />
      {children}
    </button>
  )
}

interface SwitchToggleProps {
  on: boolean
  onChange: () => void
}

function SwitchToggle({ on, onChange }: SwitchToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 99,
        border: 'none',
        background: on ? 'var(--color-gold)' : 'var(--color-border)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
