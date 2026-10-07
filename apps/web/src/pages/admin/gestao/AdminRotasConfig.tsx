import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon, Ic } from '../../../components/brand/Icon'
import { SwitchToggle } from '../../../components/admin/SwitchToggle'
import { CRNote, CRTag } from '../../../components/courier/kit'
import { DefaultRouteScreen } from '../../../components/admin/DefaultRouteScreen'
import { shortDate } from '../../../components/admin/route-kit'
import { fmtDuration } from '../../../lib/courierApi'

/** Configuração "Rotas e comprovante" (GET/PATCH /admin/settings/rotas). */
interface RouteConfig {
  base: { endereco: string; lat: number; lng: number } | null
  voltaBase: boolean
  minPorPorta: number
  precoGasolina: number | null
  precoEtanol: number | null
  /** GNV, por m³ (Onda 11). Ausente numa API antiga. */
  precoGnv?: number | null
  precoAtualizadoEm: string | null
  fotoClienteVisivel: boolean
  /** O que o entregador vê de km e combustível (Onda 10 · H-5/H-6). */
  entregadorVeCombNumeros: boolean
  entregadorVeCombFimRota: boolean
  entregadorVeCombGanhos: boolean
  storageConfigured: boolean
  /** Resumo da rota padrão (plano-rota-padrao). null = ainda não há; ausente numa API antiga. */
  rotaPadrao?: { count: number; km: number | null; durationMin: number | null; savedAt: string; toReview: number; outside: number } | null
}

type CourierFuelKey = 'entregadorVeCombNumeros' | 'entregadorVeCombFimRota' | 'entregadorVeCombGanhos'

/** Switches "O que o entregador vê": os três nascem desligados. */
const COURIER_FUEL_SWITCHES: Array<{ key: CourierFuelKey; title: string; desc: string }> = [
  { key: 'entregadorVeCombNumeros', title: 'Km e combustível em Meus números', desc: 'Soma estimada dos últimos 7 e 30 dias.' },
  { key: 'entregadorVeCombFimRota', title: 'Km e combustível no Fim da rota', desc: 'Estimado do turno, na tela de rota concluída.' },
  { key: 'entregadorVeCombGanhos', title: 'Conta do combustível em Meus ganhos', desc: 'km ÷ km/l × preço. Desligado, mostra só o valor que entra no pagamento.' },
]

const MIN_DOOR = { min: 0, max: 15 }
const PRICE = { min: 0.01, max: 20 }

/** "6,09" ⇄ 6.09. Vazio = não informado. */
const priceText = (v: number | null) => (v === null ? '' : v.toFixed(2).replace('.', ','))
function parsePrice(text: string): number | null | 'invalid' {
  const t = text.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < PRICE.min || n > PRICE.max) return 'invalid'
  return Math.round(n * 100) / 100
}
const dayLabel = (d: string | null) => (d ? d.split('-').reverse().slice(0, 2).join('/') : null)

const pinIcon = L.divIcon({
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<div style="width:34px;height:34px;border-radius:11px;background:#FAF5EC;border:2.5px solid #1E1207;display:grid;place-items:center;box-shadow:0 3px 8px rgba(0,0,0,.25)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E1207" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${Ic.pin}"/></svg></div>`,
})

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 16)
  }, [map, lat, lng])
  return null
}

/** Mapa da base com o pino arrastável (ajuste fino da posição). */
function BasePinMap({ lat, lng, onMove }: { lat: number; lng: number; onMove: (p: { lat: number; lng: number }) => void }) {
  return (
    <div style={{ height: 170, position: 'relative', zIndex: 0, isolation: 'isolate' }}>
      <MapContainer center={[lat, lng]} zoom={16} style={{ height: '100%', width: '100%' }} aria-label="Mapa da base de saída" zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>' />
        <Marker
          position={[lat, lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng()
              onMove({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 })
            },
          }}
        />
        <Recenter lat={lat} lng={lng} />
      </MapContainer>
    </div>
  )
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 4px 8px' }}>
        <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)', textTransform: 'uppercase' }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}

const card: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, overflow: 'hidden' }
const rowTitle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)' }
const rowDesc: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 2, lineHeight: 1.4 }

const kmText = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** Base e volta como o servidor as usa — a rota padrão só enxerga o que já foi salvo. */
const routeKey = (c: Pick<RouteConfig, 'base' | 'voltaBase'>) => JSON.stringify([c.base?.lat ?? null, c.base?.lng ?? null, c.voltaBase])

/** A5 · Gestão › Rotas e comprovante. */
export function AdminRotasConfig({ onBack, onOpenCondos }: { onBack: () => void; onOpenCondos?: () => void }) {
  const [cfg, setCfg] = useState<RouteConfig | null>(null)
  const [savedRouteKey, setSavedRouteKey] = useState<string | null>(null)
  const [showDefaultRoute, setShowDefaultRoute] = useState(false)
  const [gasolina, setGasolina] = useState('')
  const [etanol, setEtanol] = useState('')
  const [gnv, setGnv] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ label: string; lat: number; lng: number }>>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const searchSeq = useRef(0)

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch('/admin/settings/rotas')
        if (!res.ok) throw new Error()
        const data = (await res.json()) as RouteConfig
        setCfg(data)
        setSavedRouteKey(routeKey(data))
        setGasolina(priceText(data.precoGasolina))
        setEtanol(priceText(data.precoEtanol))
        setGnv(priceText(data.precoGnv ?? null))
        setQuery(data.base?.endereco ?? '')
      } catch {
        setLoadError(true)
      }
    })()
  }, [])

  const patch = (p: Partial<RouteConfig>) => {
    setSavedAt(null)
    setCfg((c) => (c ? { ...c, ...p } : c))
  }

  // Busca de endereço (Nominatim pelo servidor), com espera para não buscar a cada letra.
  useEffect(() => {
    const q = query.trim()
    if (!cfg || q.length < 3 || q === cfg.base?.endereco) {
      setResults([])
      return
    }
    const seq = ++searchSeq.current
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await apiFetch(`/admin/geocode?q=${encodeURIComponent(q)}`)
        const data = res.ok ? ((await res.json()) as { results: Array<{ label: string; lat: number; lng: number }> }) : { results: [] }
        if (seq === searchSeq.current) setResults(data.results)
      } catch {
        if (seq === searchSeq.current) setResults([])
      } finally {
        if (seq === searchSeq.current) setSearching(false)
      }
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const save = async () => {
    if (!cfg) return
    const g = parsePrice(gasolina)
    const e = parsePrice(etanol)
    const n = parsePrice(gnv)
    const range = `R$ ${PRICE.min.toFixed(2).replace('.', ',')} e R$ ${PRICE.max.toFixed(2).replace('.', ',')}`
    if (g === 'invalid' || e === 'invalid') {
      setError(`Preço do litro entre ${range}.`)
      return
    }
    if (n === 'invalid') {
      setError(`Preço do m³ do GNV entre ${range}.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch('/admin/settings/rotas', {
        method: 'PATCH',
        body: JSON.stringify({
          base: cfg.base,
          voltaBase: cfg.voltaBase,
          minPorPorta: cfg.minPorPorta,
          precoGasolina: g,
          precoEtanol: e,
          precoGnv: n,
          fotoClienteVisivel: cfg.fotoClienteVisivel,
          entregadorVeCombNumeros: cfg.entregadorVeCombNumeros,
          entregadorVeCombFimRota: cfg.entregadorVeCombFimRota,
          entregadorVeCombGanhos: cfg.entregadorVeCombGanhos,
        }),
      })
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Não foi possível salvar.')
      const data = (await res.json()) as RouteConfig
      setCfg(data)
      setSavedRouteKey(routeKey(data))
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  /** Volta da rota padrão: atualiza só o resumo do card, sem mexer no que foi digitado aqui. */
  const closeDefaultRoute = async () => {
    setShowDefaultRoute(false)
    try {
      const res = await apiFetch('/admin/settings/rotas')
      if (!res.ok) return
      const data = (await res.json()) as RouteConfig
      setCfg((c) => (c ? { ...c, rotaPadrao: data.rotaPadrao } : c))
    } catch {
      // o card fica com o resumo de antes
    }
  }

  if (showDefaultRoute) {
    return (
      <DefaultRouteScreen
        onBack={() => void closeDefaultRoute()}
        onOpenCondos={onOpenCondos}
      />
    )
  }

  const rp = cfg?.rotaPadrao ?? null
  const routeDirty = !!cfg && savedRouteKey !== null && routeKey(cfg) !== savedRouteKey

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{ background: 'var(--color-surface-2)', border: 'none', width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Rotas e comprovante</h2>
      </div>

      {loadError && (
        <div style={{ padding: '0 16px' }}>
          <CRNote icon="cloudOff" tone="danger">
            Não foi possível carregar a configuração. Tente de novo.
          </CRNote>
        </div>
      )}

      {cfg && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 110px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!cfg.storageConfigured && (
            <CRNote icon="alert" tone="danger">
              <b>Armazenamento de fotos não configurado.</b> As fotos das entregas não sobem e as paradas ficam “sem foto” até o S3 ser configurado no servidor.
            </CRNote>
          )}

          <Section title="Base de saída">
            <div style={card}>
              <div style={{ padding: 14, position: 'relative' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--color-border)', borderRadius: 12, padding: '0 12px', height: 46, background: 'var(--color-surface)' }}>
                  <Icon name="search" size={17} color="var(--color-text-ter)" aria-hidden="true" />
                  <input
                    aria-label="Buscar endereço da base"
                    placeholder="Buscar endereço da base"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14.5, color: 'var(--color-text)' }}
                  />
                  {searching && <span style={{ fontSize: 12, color: 'var(--color-text-ter)' }}>buscando…</span>}
                </label>
                {results.length > 0 && (
                  <div role="listbox" aria-label="Endereços encontrados" style={{ marginTop: 6, border: '1px solid var(--color-border-2)', borderRadius: 12, overflow: 'hidden' }}>
                    {results.map((r) => (
                      <button
                        key={`${r.lat},${r.lng}`}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => {
                          patch({ base: { endereco: r.label, lat: r.lat, lng: r.lng } })
                          setQuery(r.label)
                          setResults([])
                        }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderTop: '1px solid var(--color-border-2)', background: 'var(--color-surface)', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text)', cursor: 'pointer' }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {cfg.base ? (
                <>
                  <BasePinMap lat={cfg.base.lat} lng={cfg.base.lng} onMove={(p) => patch({ base: { ...cfg.base!, ...p } })} />
                  <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'var(--font-body)' }}>
                    <Icon name="pin" size={14} aria-hidden="true" />
                    <span style={{ flex: 1 }}>Arraste o pino para ajustar a posição exata.</span>
                    <button
                      type="button"
                      onClick={() => {
                        patch({ base: null })
                        setQuery('')
                      }}
                      style={{ border: 'none', background: 'none', color: 'var(--color-warn)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                    >
                      Remover base
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '0 14px 14px' }}>
                  <CRNote icon="alert" tone="gold">
                    Base não definida: a rota começa no primeiro prédio e não conta a ida.
                  </CRNote>
                </div>
              )}
            </div>
          </Section>

          <Section title="Rota padrão">
            <button
              type="button"
              onClick={() => setShowDefaultRoute(true)}
              style={{ ...card, width: '100%', textAlign: 'left', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--color-gold-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="route" size={20} color="var(--color-accent)" aria-hidden="true" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {rp ? (
                  <>
                    <span style={{ ...rowTitle, display: 'block' }}>
                      {rp.count} {rp.count === 1 ? 'prédio' : 'prédios'}
                      {rp.km !== null ? ` · ~${kmText(rp.km)} km` : ''}
                      {rp.durationMin !== null ? ` · ~${fmtDuration(rp.durationMin)}` : ''}
                    </span>
                    <span style={{ ...rowDesc, display: 'block' }}>Salva em {shortDate(rp.savedAt)} · base das rotas de todos os turnos</span>
                    {(rp.toReview > 0 || rp.outside > 0) && (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {rp.toReview > 0 && (
                          <CRTag icon="spark" tone="gold" size="sm">
                            {rp.toReview} para revisar
                          </CRTag>
                        )}
                        {rp.outside > 0 && (
                          <CRTag icon="pin" tone="danger" size="sm">
                            {rp.outside} fora do mapa
                          </CRTag>
                        )}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span style={{ ...rowTitle, display: 'block' }}>Sem rota padrão ainda</span>
                    <span style={{ ...rowDesc, display: 'block' }}>Monte a base das rotas dos entregadores: o sistema sugere a melhor ordem para todos os condomínios.</span>
                    <span style={{ display: 'inline-flex', marginTop: 8, padding: '7px 14px', borderRadius: 999, background: 'var(--color-gold)', color: 'var(--color-espresso)', fontWeight: 800, fontSize: 13 }}>Montar rota padrão</span>
                  </>
                )}
              </span>
              <Icon name="chevR" size={18} color="var(--color-text-ter)" aria-hidden="true" />
            </button>
            {routeDirty && (
              <CRNote icon="alert" tone="gold" style={{ marginTop: 8 }}>
                Salve antes de mexer na rota padrão: ela usa a base e a volta já salvas.
              </CRNote>
            )}
          </Section>

          <Section title="Cálculo da rota">
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--color-border-2)' }}>
                <div style={{ flex: 1 }}>
                  <div style={rowTitle}>Contar a volta à base no km</div>
                  <div style={rowDesc}>Entra no km e no combustível estimados.</div>
                </div>
                <SwitchToggle on={cfg.voltaBase} onChange={() => patch({ voltaBase: !cfg.voltaBase })} aria-label="Contar a volta à base no km" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={rowTitle}>Tempo médio por porta</div>
                  <div style={rowDesc}>Usado na hora prevista de cada prédio</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" aria-label="Menos um minuto" disabled={cfg.minPorPorta <= MIN_DOOR.min} onClick={() => patch({ minPorPorta: cfg.minPorPorta - 1 })} style={stepBtn}>
                    −
                  </button>
                  <span aria-label="Minutos por porta" style={{ minWidth: 24, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--color-text)' }}>
                    {cfg.minPorPorta}
                  </span>
                  <button type="button" aria-label="Mais um minuto" disabled={cfg.minPorPorta >= MIN_DOOR.max} onClick={() => patch({ minPorPorta: cfg.minPorPorta + 1 })} style={stepBtn}>
                    +
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 700, fontFamily: 'var(--font-body)' }}>min</span>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Preço do combustível"
            right={dayLabel(cfg.precoAtualizadoEm) ? <span style={{ fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 600, fontFamily: 'var(--font-body)' }}>atualizado em {dayLabel(cfg.precoAtualizadoEm)}</span> : null}
          >
            <div style={{ ...card, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(
                [
                  ['Gasolina', gasolina, setGasolina, 'litro', 'R$/l'],
                  ['Etanol', etanol, setEtanol, 'litro', 'R$/l'],
                  // GNV (Onda 11 · H-12): vendido por m³
                  ['GNV', gnv, setGnv, 'm³', 'R$/m³'],
                ] as const
              ).map(([label, value, set, per, unit]) => (
                <label key={label} style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)' }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 6 }}>{label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--color-border)', borderRadius: 12, padding: '0 10px', height: 46 }}>
                    <Icon name="fuel" size={16} color="var(--color-text-ter)" aria-hidden="true" />
                    <input
                      aria-label={`Preço do ${per} · ${label}`}
                      inputMode="decimal"
                      placeholder="—"
                      value={value}
                      onChange={(e) => {
                        setSavedAt(null)
                        set(e.target.value)
                      }}
                      style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 700 }}>{unit}</span>
                  </span>
                </label>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '6px 4px 0' }}>Sem preço, o app não calcula o combustível. O GNV é por m³ e vale para carro com GNV.</div>
          </Section>

          <Section title="Comprovante">
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={rowTitle}>Cliente vê a foto da entrega</div>
                  <div style={rowDesc}>Aparece no Acompanhamento e no Histórico por 90 dias. A obrigatoriedade é por entregador.</div>
                </div>
                <SwitchToggle on={cfg.fotoClienteVisivel} onChange={() => patch({ fotoClienteVisivel: !cfg.fotoClienteVisivel })} aria-label="Cliente vê a foto da entrega" />
              </div>
            </div>
          </Section>

          <Section title="O que o entregador vê">
            <div style={card}>
              {COURIER_FUEL_SWITCHES.map((sw, i) => (
                <div key={sw.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={rowTitle}>{sw.title}</div>
                    <div style={rowDesc}>{sw.desc}</div>
                  </div>
                  <SwitchToggle on={cfg[sw.key]} onChange={() => patch({ [sw.key]: !cfg[sw.key] })} aria-label={sw.title} />
                </div>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '6px 4px 0' }}>
              Vale para todos os entregadores. Você continua vendo tudo nos relatórios e nos pagamentos. A distância da rota aparece sempre.
            </div>
          </Section>

          {error && (
            <CRNote icon="alert" tone="danger">
              {error}
            </CRNote>
          )}
        </div>
      )}

      {cfg && (
        <div style={{ position: 'sticky', bottom: 0, padding: '12px 16px calc(20px + env(safe-area-inset-bottom, 0px))', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border-2)' }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            style={{
              width: '100%',
              minHeight: 52,
              borderRadius: 999,
              border: 'none',
              background: savedAt ? 'var(--color-good-soft)' : 'var(--color-espresso)',
              color: savedAt ? 'var(--color-good)' : '#fff',
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              fontSize: 15.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            <Icon name="check" size={18} color={savedAt ? 'var(--color-good)' : '#fff'} stroke={2.4} aria-hidden="true" />
            {saving ? 'Salvando…' : savedAt ? `Salvo às ${savedAt}` : 'Salvar'}
          </button>
        </div>
      )}
    </div>
  )
}

const stepBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 11,
  border: '1.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  fontSize: 18,
  fontWeight: 800,
  color: 'var(--color-text)',
  cursor: 'pointer',
}
