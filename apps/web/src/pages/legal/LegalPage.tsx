import { useNavigate } from 'react-router'
import { BackButton, Btn, Card, Notice } from '../../components/auth/SocialAuthUI'
import { ProfileMenuRow } from '../../components/client/ProfileMenuRow'
import { Icon } from '../../components/brand/Icon'
import {
  DELETION_INTRO,
  DELETION_STEPS,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DRAFT,
  LEGAL_UPDATED_AT,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  type LegalSection,
} from '../../content/legal'
import { supportWhatsappUrl } from '../../lib/support'
import { COURIER_TERMS, COURIER_TERMS_DATE, COURIER_TERMS_INTRO, COURIER_TERMS_SECTIONS } from '../../content/courierTerms'

/**
 * Páginas públicas (handoff L9): Política de Privacidade, Termos de Uso, Exclusão de dados e o Termo
 * do Entregador Parceiro (plano-termos-legais §6 · T-T10).
 * Abrem logado ou não — o Google e a LGPD pedem URL pública. Texto em content/legal.ts (rascunho).
 */

function useBack() {
  const navigate = useNavigate()
  // Veio de dentro do app (login, cadastro, Perfil): volta. Abriu direto (link externo): vai à raiz.
  return () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
}

function LegalShell({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  const back = useBack()
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--color-app-bg)' }}>
      <div style={{ padding: '8px 24px 0' }}>
        <BackButton onClick={back} />
      </div>
      <article style={{ flex: 1, padding: '22px 24px 32px', maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--color-accent)' }}>
          CHEIRIN DE PÃO
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, letterSpacing: '-0.03em', color: 'var(--color-text)', lineHeight: 1.1, margin: '8px 0 0' }}>
          {title}
        </h1>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', marginTop: 10, fontWeight: 600 }}>
          {updated ?? `Atualizado em ${LEGAL_UPDATED_AT}`}
        </div>
        {LEGAL_DRAFT && (
          <div style={{ marginTop: 16 }}>
            <Notice title="Versão provisória">Este texto ainda está em revisão e pode mudar.</Notice>
          </div>
        )}
        {children}
        <div
          style={{
            marginTop: 30,
            paddingTop: 18,
            borderTop: '1px solid var(--color-border)',
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            color: 'var(--color-text-sec)',
            lineHeight: 1.7,
          }}
        >
          Dúvidas? Fale com a gente:
          <br />
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          <br />
          <a href={supportWhatsappUrl()} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
            WhatsApp do suporte
          </a>
        </div>
      </article>
    </div>
  )
}

export function Sections({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((sec) => (
        <section key={sec.title} style={{ marginTop: 26 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
            {sec.title}
          </h2>
          {sec.paragraphs.map((p) => (
            <p key={p} style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text)', margin: '8px 0 0', textWrap: 'pretty' }}>
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Política de Privacidade">
      <Sections sections={PRIVACY_SECTIONS} />
    </LegalShell>
  )
}

export function TermsPage() {
  return (
    <LegalShell title="Termos de Uso">
      <Sections sections={TERMS_SECTIONS} />
    </LegalShell>
  )
}

export function CourierTermsPage() {
  return (
    <LegalShell title={COURIER_TERMS.title} updated={`Versão ${COURIER_TERMS.version} · ${COURIER_TERMS_DATE}`}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text)', marginTop: 20, marginBottom: 0 }}>{COURIER_TERMS_INTRO}</p>
      <Sections sections={COURIER_TERMS_SECTIONS} />
    </LegalShell>
  )
}

export function DataDeletionPage() {
  return (
    <LegalShell title="Exclusão de dados">
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text)', marginTop: 20, marginBottom: 0 }}>{DELETION_INTRO}</p>
      <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, padding: 0 }}>
        {DELETION_STEPS.map((step, i) => (
          <li
            key={step.title}
            style={{
              display: 'flex',
              gap: 13,
              alignItems: 'flex-start',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-2)',
              borderRadius: 18,
              padding: 14,
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                background: 'var(--color-espresso)',
                color: 'var(--color-gold)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontFamily: 'var(--font-body)' }}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)' }}>{step.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', marginTop: 3, lineHeight: 1.5 }}>{step.text}</div>
            </div>
          </li>
        ))}
      </ol>
      <div style={{ marginTop: 22 }}>
        <Btn
          full
          size="lg"
          icon="chat"
          onClick={() => window.open(supportWhatsappUrl('Olá! Quero excluir minha conta e meus dados do Cheirin de Pão.'), '_blank', 'noopener,noreferrer')}
        >
          Falar com o suporte no WhatsApp
        </Btn>
      </div>
    </LegalShell>
  )
}

/** Perfil › Ajuda › Privacidade e termos (hub das 3 páginas). */
export function LegalHubScreen() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px 14px' }}>
        <button
          type="button"
          onClick={() => navigate('/client/perfil')}
          aria-label="Voltar"
          style={{ background: 'var(--color-surface-2)', border: 'none', width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--color-text)', flexShrink: 0 }}
        >
          <Icon name="arrowL" size={20} />
        </button>
        <h1 style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
          Privacidade e termos
        </h1>
      </div>
      <div style={{ padding: '0 20px' }}>
        <Card pad={0} style={{ padding: '6px 16px' }}>
          <ProfileMenuRow icon="shield" label="Política de Privacidade" onClick={() => navigate('/privacidade')} />
          <div style={{ height: 1, background: 'var(--color-border-2)', margin: '0 4px' }} />
          <ProfileMenuRow icon="doc" label="Termos de Uso" onClick={() => navigate('/termos')} />
          <div style={{ height: 1, background: 'var(--color-border-2)', margin: '0 4px' }} />
          <ProfileMenuRow icon="trash" label="Exclusão de dados" description="Como pedir para apagar sua conta" onClick={() => navigate('/exclusao-de-dados')} />
        </Card>
      </div>
    </div>
  )
}
