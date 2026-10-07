import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { CRAvatar, CRBig, CRLabel, CRNote, CRSheet, CRTag } from '../courier/kit'

interface RouteCourier {
  id: string
  name: string
  photoUrl: string | null
}

interface RouteOption {
  date: string
  slotId: string
  slotLabel: string
  slotEmoji: string
  slotTime: string
  /** Vai junto com o pão (pedido ou agenda); false = parada só de gancho. */
  withBread: boolean
  /** O pão do dia já saiu: o entregador é o da parada, sem escolha. */
  courierLocked: boolean
  /** O entregador fixo ou o sugerido. */
  courier: RouteCourier | null
  /** De folga, fora da escala ou com a rota do turno encerrada. */
  unavailableCourierIds: string[]
}

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const dayChip = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number)
  return `${WD[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]} ${String(dd).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const shortName = (n: string) => {
  const p = n.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]
}

/**
 * A7 · "Enviar na rota". Hoje e os próximos 6 dias, nos turnos do condomínio do cliente. Com pão
 * no dia, o gancho vai na parada dele; sem pão, vai sozinho, numa parada própria
 * (plano-gancho-sozinho-na-rota). Pão já despachado = entregador fixo; nos outros casos o admin
 * escolhe quem leva, com a sugestão de quem atende o condomínio já marcada.
 */
export function HookRouteSheet({ hookId, clientName, place, onClose, onSent }: { hookId: string; clientName: string; place: string; onClose: () => void; onSent: () => void }) {
  const [options, setOptions] = useState<RouteOption[] | null>(null)
  const [couriers, setCouriers] = useState<RouteCourier[]>([])
  const [date, setDate] = useState<string | null>(null)
  const [slotId, setSlotId] = useState<string | null>(null)
  const [courierId, setCourierId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await apiFetch(`/admin/hook-requests/${hookId}/route-options`)
        const body = res.ok ? ((await res.json()) as { options?: RouteOption[]; couriers?: RouteCourier[] }) : null
        if (!alive) return
        const list = body?.options ?? []
        setOptions(list)
        setCouriers(body?.couriers ?? [])
        if (list[0]) {
          setDate(list[0].date)
          setSlotId(list[0].slotId)
          setCourierId(list[0].courier?.id ?? null)
        }
      } catch {
        if (alive) setOptions([])
      }
    })()
    return () => {
      alive = false
    }
  }, [hookId])

  const dates = useMemo(() => [...new Set((options ?? []).map((o) => o.date))], [options])
  const slots = (options ?? []).filter((o) => o.date === date)
  const chosen = slots.find((o) => o.slotId === slotId) ?? null

  // Quem pode levar neste dia/turno: o sugerido primeiro, depois os outros em ordem alfabética.
  const available = useMemo(() => {
    if (!chosen || chosen.courierLocked) return []
    const list = couriers.filter((c) => !chosen.unavailableCourierIds.includes(c.id))
    const suggested = chosen.courier?.id
    return [...list.filter((c) => c.id === suggested), ...list.filter((c) => c.id !== suggested)]
  }, [chosen, couriers])

  /** Troca de opção: o entregador volta para a sugestão daquele dia/turno. */
  const pick = (o: RouteOption | undefined) => {
    setSlotId(o?.slotId ?? null)
    setCourierId(o?.courier?.id ?? null)
    setError(null)
  }

  const who = chosen?.courierLocked ? chosen.courier?.id ?? null : courierId
  const ready = !!chosen && (chosen.courierLocked || (!!courierId && available.some((c) => c.id === courierId)))

  const send = async () => {
    if (!chosen || !ready) return
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch(`/admin/hook-requests/${hookId}/route`, {
        method: 'POST',
        body: JSON.stringify({ date: chosen.date, slotId: chosen.slotId, ...(chosen.courierLocked || !who ? {} : { courierId: who }) }),
      })
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Não deu para enviar. Tente de novo.')
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu para enviar. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const first = clientName.trim().split(/\s+/)[0]
  return (
    <CRSheet title="Enviar na rota" sub={`${clientName} · ${place}`} onClose={onClose} busy={busy}>
      {!options && <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-ter)', fontSize: 13 }}>Carregando…</div>}
      {options && options.length === 0 && <CRNote icon="calendar">O condomínio do cliente não tem turno de entrega nos próximos 7 dias. O gancho continua na fila.</CRNote>}
      {options && options.length > 0 && (
        <>
          <CRLabel>Data</CRLabel>
          {/* 7 dias: rolam de lado no celular. */}
          <div role="radiogroup" aria-label="Data" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -2px', padding: '0 2px 2px' }}>
            {dates.map((d) => {
              const on = d === date
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setDate(d)
                    pick(options.find((o) => o.date === d))
                  }}
                  style={{ flex: 'none', minWidth: 84, height: 48, padding: '0 12px', borderRadius: 14, fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-body)', background: on ? 'var(--color-text)' : 'var(--color-surface)', color: on ? 'var(--color-app-bg)' : 'var(--color-text)', border: `1.5px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`, cursor: 'pointer' }}
                >
                  {dayChip(d)}
                </button>
              )
            })}
          </div>
          <CRLabel style={{ marginTop: 14 }}>Turno</CRLabel>
          <div role="radiogroup" aria-label="Turno" style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 13, padding: 4 }}>
            {slots.map((o) => {
              const on = o.slotId === slotId
              return (
                <button
                  key={o.slotId}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(o)}
                  style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-body)', background: on ? 'var(--color-surface)' : 'transparent', color: on ? 'var(--color-text)' : 'var(--color-text-sec)', boxShadow: on ? 'var(--shadow-soft)' : 'none', cursor: 'pointer' }}
                >
                  {o.slotEmoji ? `${o.slotEmoji} ` : ''}
                  {o.slotLabel}
                </button>
              )
            })}
          </div>

          {chosen && (
            <div style={{ marginTop: 10, fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: chosen.withBread ? 'var(--color-text-sec)' : 'var(--color-accent)' }}>
              {chosen.withBread ? `🥖 Vai junto com o pão ${first ? `de ${first}` : 'do cliente'}` : '🪝 Só o gancho: parada própria na rota'}
            </div>
          )}

          {chosen?.courierLocked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'var(--color-surface-2)', fontFamily: 'var(--font-body)' }}>
              {chosen.courier ? (
                <>
                  <CRAvatar name={chosen.courier.name} photoUrl={chosen.courier.photoUrl} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)' }}>{shortName(chosen.courier.name)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)' }}>Entregador da rota do cliente</div>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, fontSize: 13, color: 'var(--color-text-sec)' }}>Entregador da rota do cliente.</div>
              )}
            </div>
          ) : (
            chosen && (
              <>
                <CRLabel style={{ marginTop: 14 }}>Quem leva</CRLabel>
                {available.length === 0 ? (
                  <CRNote icon="alert" tone="gold">
                    Nenhum entregador disponível neste turno.
                  </CRNote>
                ) : (
                  <div role="radiogroup" aria-label="Quem leva" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {available.map((c) => {
                      const on = c.id === courierId
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setCourierId(c.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '8px 12px', borderRadius: 14, textAlign: 'left', fontFamily: 'var(--font-body)', background: on ? 'var(--color-gold-soft)' : 'var(--color-surface)', border: `1.5px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`, cursor: 'pointer' }}
                        >
                          <CRAvatar name={c.name} photoUrl={c.photoUrl} size={34} />
                          <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortName(c.name)}</span>
                          {c.id === chosen.courier?.id && (
                            <CRTag tone="gold" size="sm">
                              Sugerido
                            </CRTag>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
                {chosen.withBread && (
                  <CRNote icon="route" style={{ marginTop: 10 }}>
                    Se o pão sair com outro entregador na divisão, o gancho vai junto com o pão.
                  </CRNote>
                )}
              </>
            )
          )}

          <CRNote icon="hook" style={{ marginTop: 12 }}>
            {chosen && !chosen.withBread
              ? `O entregador leva só o gancho até ${first ? first : 'o cliente'} e confirma se deixou.`
              : `O gancho entra na parada ${first ? `de ${first}` : 'do cliente'}. O entregador confirma se deixou.`}
          </CRNote>
          {error && (
            <CRNote tone="danger" style={{ marginTop: 10 }}>
              {error}
            </CRNote>
          )}
          <div style={{ height: 14 }} />
          <CRBig icon="route" disabled={!ready || busy} onClick={() => void send()}>
            {busy
              ? 'Enviando…'
              : !chosen
                ? 'Escolha o dia e o turno'
                : !ready
                  ? 'Escolha quem leva'
                  : chosen.withBread
                    ? `Enviar na rota de ${ddmm(chosen.date)}`
                    : `Enviar só o gancho em ${ddmm(chosen.date)}`}
          </CRBig>
        </>
      )}
    </CRSheet>
  )
}
