import { useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'
import { StepVisual } from './onboardingSlides'

interface GanchoConsentModalProps {
  isOpen: boolean
  /** Chamado após o servidor registrar a solicitação (hookRequestedAt preenchido). */
  onConfirmed: () => void
}

/** Um dos 3 pontos rápidos que reforçam como o gancho funciona (eco do tutorial). */
function Ponto({ icon, children }: { icon: 'gift' | 'check' | 'bag'; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 9,
          background: 'var(--color-surface-2)',
          display: 'grid',
          placeItems: 'center',
          marginTop: 1,
        }}
      >
        <Icon name={icon} size={16} color="var(--color-accent)" stroke={2} />
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.4, color: 'var(--color-text-sec)' }}>
        {children}
      </span>
    </li>
  )
}

/**
 * GanchoConsentModal — consentimento obrigatório do gancho de porta.
 *
 * Exibido pelo ClientLayout após o cliente fazer o primeiro pedido (needsConsent).
 * É obrigatório: não fecha por backdrop/ESC e não tem botão de dispensar — só sai
 * quando o cliente confirma o recebimento (POST /client/hook-request). Reaparece
 * enquanto não confirmado. Modelado em CancelOrderDialog (tokens + isLoading/error).
 */
export function GanchoConsentModal({ isOpen, onConfirmed }: GanchoConsentModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/client/hook-request', { method: 'POST' })
      if (res.ok) {
        onConfirmed()
        return
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Não foi possível confirmar. Tente novamente.')
    } catch {
      setError('Falha na conexão. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gancho-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 22,
          padding: 22,
          width: '100%',
          maxWidth: 360,
          maxHeight: 'calc(100dvh - 40px)',
          overflowY: 'auto',
        }}
      >
        <StepVisual kind="gancho" />

        <h2
          id="gancho-modal-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            margin: '18px 0 8px',
          }}
        >
          Falta só o gancho!
        </h2>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-sec)', margin: '0 0 16px' }}>
          Para entregar seu pão do jeito certo, deixamos uma sacolinha na sua porta com um{' '}
          <strong style={{ color: 'var(--color-text)' }}>gancho do Cheirin de Pão</strong>. Assim, toda manhã o
          entregador pendura seus pães fresquinhos nele — sem tocar a campainha, sem te incomodar e sem nenhum
          trabalho pra você.
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Ponto icon="gift">Você recebe um gancho de acrílico transparente e super discreto.</Ponto>
          <Ponto icon="check">É só encaixar na porta — sem furar, sem danificar, sem ferramentas.</Ponto>
          <Ponto icon="bag">Seu pão fresquinho chega pendurado nele, prontinho quando você acordar.</Ponto>
        </ul>

        <button
          onClick={handleConfirm}
          disabled={isLoading}
          style={{
            width: '100%',
            minHeight: 52,
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-display)',
            fontSize: 15.5,
            fontWeight: 700,
            border: 'none',
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {!isLoading && <Icon name="check" size={20} color="var(--color-primary-btn-text)" stroke={2.4} />}
          {isLoading ? 'Confirmando...' : 'Confirmar recebimento do gancho'}
        </button>

        {error !== null && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-destructive)', margin: '12px 0 0', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
