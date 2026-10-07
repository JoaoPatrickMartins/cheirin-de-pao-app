import { useState } from 'react'
import { Icon } from '../brand/Icon'
import { CRBig, CRNote, CR_BODY, CR_DISPLAY } from './kit'
import { COURIER_TERMS, COURIER_TERMS_DATE, COURIER_TERMS_INTRO, COURIER_TERMS_SECTIONS } from '../../content/courierTerms'

/** Texto do termo no estilo do app do entregador (gate e Perfil). */
export function CourierTermsBody() {
  return (
    <div style={{ fontFamily: CR_BODY }}>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--color-text)', margin: 0 }}>{COURIER_TERMS_INTRO}</p>
      {COURIER_TERMS_SECTIONS.map((sec) => (
        <section key={sec.title} style={{ marginTop: 20 }}>
          <h2 style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>{sec.title}</h2>
          {sec.paragraphs.map((p) => (
            <p key={p} style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-text)', margin: '6px 0 0' }}>
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}

/**
 * Aceite obrigatório do Termo do Entregador Parceiro (plano-termos-legais §6 · D-T2/T-T8): tela cheia
 * por cima de tudo no 1º acesso e a cada versão nova. Só libera o app depois de marcar "Li e aceito" e
 * o servidor gravar o aceite. "Sair" continua disponível. A API não recusa as ações de quem não
 * aceitou (a fila offline perderia entregas) — o bloqueio é aqui.
 */
export function TermsGate({
  updated,
  onAccept,
  onLogout,
}: {
  /** Já aceitou uma versão anterior: o texto mudou. */
  updated: boolean
  onAccept: () => Promise<string | null>
  onLogout: () => void
}) {
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    setBusy(true)
    setError(null)
    const err = await onAccept()
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={COURIER_TERMS.title}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--color-app-bg)', display: 'flex', flexDirection: 'column', fontFamily: CR_BODY }}
    >
      <div style={{ padding: 'calc(18px + env(safe-area-inset-top, 0px)) 20px 14px', borderBottom: '1px solid var(--color-border-2)', background: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--color-accent)' }}>
          <Icon name="doc" size={14} aria-hidden="true" />
          {updated ? 'O TERMO MUDOU' : 'ANTES DE COMEÇAR'}
        </div>
        <h1 style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', color: 'var(--color-text)', margin: '6px 0 0', lineHeight: 1.1 }}>{COURIER_TERMS.title}</h1>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600, marginTop: 6 }}>
          Versão {COURIER_TERMS.version} · {COURIER_TERMS_DATE} · {updated ? 'leia a versão nova para continuar' : 'leia e aceite para usar o app'}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px 24px' }}>
        <CourierTermsBody />
      </div>
      <div style={{ padding: '14px 20px calc(16px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--color-border-2)', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label="Li e aceito o Termo do Entregador Parceiro"
            onClick={() => setChecked((v) => !v)}
            style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, border: checked ? 'none' : '2px solid var(--color-border)', background: checked ? 'var(--color-espresso)' : 'var(--color-surface)', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}
          >
            {checked && <Icon name="check" size={16} color="var(--color-gold)" stroke={3} aria-hidden="true" />}
          </button>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.35 }} onClick={() => setChecked((v) => !v)}>
            Li e aceito o Termo do Entregador Parceiro
          </span>
        </div>
        {error && (
          <CRNote icon="cloudOff" tone="danger">
            {error}
          </CRNote>
        )}
        <CRBig icon="check" onClick={() => void accept()} disabled={!checked || busy}>
          {busy ? 'Salvando…' : 'Aceitar e continuar'}
        </CRBig>
        <button type="button" onClick={onLogout} style={{ border: 'none', background: 'none', color: 'var(--color-text-sec)', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 4 }}>
          Sair do app
        </button>
      </div>
    </div>
  )
}
