import { useState } from 'react'
import { Icon, type Ic } from '../brand/Icon'
import { CRIconBtn, CR_BODY } from './kit'
import type { CondoAccess as Access } from '../../lib/courierApi'

function Line({ icon, k, v }: { icon: keyof typeof Ic; k: string; v: string | null }) {
  if (!v) return null
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 0' }}>
      <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}>
        <Icon name={icon} size={17} color="var(--color-accent)" stroke={2.1} aria-hidden="true" />
      </span>
      <div style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--color-text)' }}>
        <span style={{ color: 'var(--color-text-sec)', fontWeight: 600 }}>{k} </span>
        <b style={{ fontWeight: 700 }}>{v}</b>
      </div>
    </div>
  )
}

/**
 * E7 · Bloco "Acesso" do prédio, dentro do acordeão: portaria, portão, onde parar, observações e a
 * foto da entrada (definidos pelo admin no A6), "Sugerir correção" e "Navegar até aqui".
 */
export function CondoAccessBlock({
  access,
  onSuggest,
  onNavigate,
}: {
  access: Access | null | undefined
  onSuggest?: () => void
  onNavigate?: () => void
}) {
  const [viewer, setViewer] = useState(false)
  const none = !access
  const portaria = access?.portaria ? `${access.portaria}${access.temPorteiro === true ? ' · com porteiro' : access.temPorteiro === false ? ' · sem porteiro' : ''}` : access?.temPorteiro === true ? 'com porteiro' : access?.temPorteiro === false ? 'sem porteiro' : null
  return (
    <div style={{ margin: '10px 14px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: '12px 14px', fontFamily: CR_BODY }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: none ? 4 : 6 }}>
        <Icon name="gate" size={16} color="var(--color-text-sec)" stroke={2.1} aria-hidden="true" />
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-sec)' }}>ACESSO</span>
        {onSuggest && (
          <button type="button" onClick={onSuggest} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', padding: '6px 0', minHeight: 32 }}>
            {none ? 'Sugerir' : 'Sugerir correção'}
          </button>
        )}
      </div>
      {none ? (
        <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)' }}>Nenhuma dica ainda. Conhece a entrada? Sugira para a operação.</div>
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Line icon="building" k="Portaria:" v={portaria} />
            <Line icon="lock" k="Portão:" v={access.portao} />
            <Line icon="moto" k="Parar:" v={access.parar} />
            <Line icon="doc" k="Obs.:" v={access.obs} />
          </div>
          {access.fotoUrl && (
            <button
              type="button"
              aria-label="Ver a foto da entrada"
              onClick={() => setViewer(true)}
              style={{ position: 'relative', width: 78, height: 96, borderRadius: 12, overflow: 'hidden', border: 'none', padding: 0, flexShrink: 0, cursor: 'pointer', background: 'var(--color-surface-2)' }}
            >
              <img src={access.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span style={{ position: 'absolute', right: 5, bottom: 5, width: 24, height: 24, borderRadius: 8, background: 'rgba(30,18,7,0.7)', display: 'grid', placeItems: 'center' }}>
                <Icon name="search" size={13} color="#fff" stroke={2.4} aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      )}
      {onNavigate && (
        <button
          type="button"
          onClick={onNavigate}
          style={{ marginTop: 10, width: '100%', height: 46, borderRadius: 14, border: 'none', background: 'var(--color-espresso)', color: '#FAF5EC', fontWeight: 800, fontSize: 14.5, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
        >
          <Icon name="navigate" size={17} color="var(--color-gold)" stroke={2.2} aria-hidden="true" />
          Navegar até aqui
        </button>
      )}
      {viewer && access?.fotoUrl && (
        <div role="dialog" aria-modal="true" aria-label="Foto da entrada" style={{ position: 'fixed', inset: 0, zIndex: 170, background: 'rgba(7,4,2,0.94)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 'calc(10px + env(safe-area-inset-top, 0px)) 16px 10px', display: 'flex', justifyContent: 'flex-end' }}>
            <CRIconBtn icon="x" tone="dark" label="Fechar" onClick={() => setViewer(false)} />
          </div>
          <img src={access.fotoUrl} alt="Entrada do prédio" style={{ flex: 1, minHeight: 0, width: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
