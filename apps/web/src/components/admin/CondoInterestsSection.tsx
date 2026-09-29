import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'
import { RefCard, RefPill, RF_BODY } from '../client/referral/RefPrimitives'
import { RaBtn, RaInline, RaLabel, brtDay } from './referral/RaKit'

/** Resposta de `GET /admin/condominiums/interests`. */
interface InterestGroup {
  key: string
  name: string
  city: string
  count: number
  viaReferral: number
  handled: boolean
  lastAt: string
  contacts: Array<{ id: string; name: string; email: string | null; phone: string | null; createdAt: string; viaReferral: boolean }>
}

/** "19981234400" → "(19) 9 8123-4400" — o formato do handoff. */
function formatPhone(digits: string): string {
  let d = digits
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

/**
 * A7 — "Pedidos de novos condomínios" (handoff `RACondoInterests`), embutido em Gestão ›
 * Condomínios, abaixo da lista. Um grupo por condomínio (nome + cidade), com os contatos e o
 * "Marcar como tratado" / "Reabrir" do grupo inteiro. Tratado fica esmaecido.
 */
export function CondoInterestsSection() {
  const [groups, setGroups] = useState<InterestGroup[] | null>(null)
  const [open, setOpen] = useState(0)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/admin/condominiums/interests')
        if (res.ok && !cancelled) setGroups(((await res.json()) as { groups: InterestGroup[] }).groups)
      } catch {
        // silencioso — sem os dados, a seção não aparece e a lista de condomínios segue normal
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!groups) return null

  const toggleHandled = async (g: InterestGroup) => {
    setBusyKey(g.key)
    setError(null)
    try {
      const res = await apiFetch('/admin/condominiums/interests/handled', {
        method: 'PATCH',
        body: JSON.stringify({ groupKey: g.key, handled: !g.handled }),
      })
      if (!res.ok) throw new Error('falha')
      setGroups((cur) => cur?.map((x) => (x.key === g.key ? { ...x, handled: !g.handled } : x)) ?? cur)
    } catch {
      setError('Não foi possível atualizar o pedido. Tente novamente.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 20 }}>
      <RaLabel hint="Clientes que não acharam o condomínio no cadastro.">Pedidos de novos condomínios</RaLabel>
      {groups.length === 0 && (
        <p style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-ter)', margin: '0 4px' }}>Nenhum pedido por enquanto.</p>
      )}
      {error && <RaInline>{error}</RaInline>}
      {groups.map((g, i) => {
        const isOpen = open === i
        const panelId = `condo-interest-${i}`
        return (
          <RefCard key={g.key} pad={0} style={{ opacity: g.handled ? 0.6 : 1 }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              style={{
                width: '100%',
                minHeight: 64,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: RF_BODY,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-accent)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="building" size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)' }}>{g.name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-sec)', fontWeight: 600 }}>
                    {g.city} · {g.count} {g.count === 1 ? 'pedido' : 'pedidos'}
                  </span>
                  {g.viaReferral > 0 && (
                    <RefPill tone="gold">
                      <Icon name="gift" size={11} stroke={2.4} />
                      {g.viaReferral} por indicação
                    </RefPill>
                  )}
                  {g.handled && (
                    <RefPill tone="good">
                      <Icon name="check" size={11} stroke={2.6} />
                      Tratado
                    </RefPill>
                  )}
                </div>
              </div>
              <span style={{ display: 'flex', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                <Icon name="chevD" size={18} color="var(--color-text-ter)" />
              </span>
            </button>
            {isOpen && (
              <div id={panelId} style={{ padding: '0 14px 14px' }}>
                {g.contacts.map((p) => (
                  <div
                    key={p.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--color-border-2)', fontFamily: RF_BODY }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--color-text)' }}>
                        {p.name}
                        {/* "por indicação", e não o "indicado" do handoff: é uma pessoa específica (V-41) */}
                        {p.viaReferral && <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: 12 }}> · por indicação</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', wordBreak: 'break-word' }}>
                        {p.email ?? (p.phone ? formatPhone(p.phone) : '—')}
                      </div>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>{brtDay(p.createdAt)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10 }}>
                  <RaBtn
                    full
                    variant={g.handled ? 'soft' : 'ghost'}
                    icon="check"
                    disabled={busyKey === g.key}
                    onClick={() => void toggleHandled(g)}
                  >
                    {g.handled ? 'Reabrir' : 'Marcar como tratado'}
                  </RaBtn>
                </div>
              </div>
            )}
          </RefCard>
        )
      })}
    </section>
  )
}
