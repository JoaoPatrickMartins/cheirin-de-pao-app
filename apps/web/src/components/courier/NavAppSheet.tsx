import { useState } from 'react'
import { CRBig, CRChoice, CRSheet, CR_BODY } from './kit'
import { availableNavApps, getPreferredNavApp, NAV_APP_LABELS, setPreferredNavApp, type NavApp } from '../../lib/navLinks'
import type { Ic } from '../brand/Icon'

const ICONS: Record<NavApp, keyof typeof Ic> = { google: 'pin', waze: 'navigate', apple: 'locate' }

/**
 * E9 · "Abrir com qual app?" — 1º toque em Navegar. Lembrar a escolha (T-11).
 * Com `actionLabel` (Perfil › Preferências), só escolhe e salva — sem abrir nada.
 */
export function NavAppSheet({ onOpen, onClose, actionLabel }: { onOpen: (app: NavApp) => void; onClose: () => void; actionLabel?: string }) {
  const apps = availableNavApps()
  const [sel, setSel] = useState<NavApp>(() => {
    const saved = getPreferredNavApp()
    return saved && apps.includes(saved) ? saved : apps[0]
  })
  const [remember, setRemember] = useState(true)
  return (
    <CRSheet title="Abrir com qual app?" sub="O app de mapas do celular faz a navegação até o prédio." onClose={onClose}>
      <div role="radiogroup" aria-label="App de mapas" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {apps.map((a) => (
          <CRChoice key={a} icon={ICONS[a]} on={sel === a} onClick={() => setSel(a)}>
            {NAV_APP_LABELS[a]}
          </CRChoice>
        ))}
      </div>
      {!actionLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px', fontFamily: CR_BODY }}>
          <span id="cdp-nav-remember" style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>
            Lembrar minha escolha
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={remember}
            aria-labelledby="cdp-nav-remember"
            onClick={() => setRemember((v) => !v)}
            style={{ width: 44, height: 26, borderRadius: 99, border: 'none', background: remember ? 'var(--color-gold)' : 'var(--color-border)', position: 'relative', cursor: 'pointer', padding: 0 }}
          >
            <span style={{ position: 'absolute', top: 3, left: remember ? 21 : 3, width: 20, height: 20, borderRadius: 99, background: '#fff', transition: 'left 0.2s' }} />
          </button>
        </div>
      )}
      {actionLabel && <div style={{ height: 16 }} />}
      <CRBig
        icon={actionLabel ? 'check' : 'external'}
        onClick={() => {
          if (remember || actionLabel) setPreferredNavApp(sel)
          onOpen(sel)
        }}
      >
        {actionLabel ?? `Abrir ${NAV_APP_LABELS[sel]}`}
      </CRBig>
      {!actionLabel && (
        <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--color-text-ter)', marginTop: 10, fontWeight: 600, fontFamily: CR_BODY }}>
          Dá para trocar depois em Perfil › Preferências.
        </div>
      )}
    </CRSheet>
  )
}
