import { Outlet, Navigate, useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { ClientTabBar } from '../../components/client/ClientTabBar'
import { useOneSignalRegister } from '../../hooks/useOneSignalRegister'
import { useOneSignalDeepLink } from '../../hooks/useOneSignalDeepLink'
import { NotifProvider } from '../../contexts/NotifContext'
import { OnboardingOverlay } from '../../components/client/OnboardingOverlay'
import { AppTour } from '../../components/client/AppTour'
import { GanchoConsentModal } from '../../components/client/GanchoConsentModal'
import { hasSeenOnboarding, slidesDone, markSlidesDone, markOnboardingSeen } from '../../lib/onboarding'
import { apiFetch } from '../../lib/apiFetch'

// Fluxo de primeiro acesso: telas explicativas → tour do app → done.
type OnboardingPhase = 'slides' | 'tour' | 'done'

export function ClientLayout() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<OnboardingPhase>('done')
  // Consentimento do gancho de porta — pedido após o primeiro pedido do cliente.
  const [needsHookConsent, setNeedsHookConsent] = useState(false)
  // Registra o player_id do OneSignal no backend — executado apenas quando autenticado (JWT disponível)
  useOneSignalRegister()
  // Habilita deep link de push: navega para /client/creditos quando additionalData.screen === 'creditos'
  useOneSignalDeepLink()

  // Detecta primeiro acesso (por conta). slides_done → retoma direto no tour após reload.
  useEffect(() => {
    if (user?.role !== 'CLIENT') return
    if (hasSeenOnboarding(user.id)) {
      setPhase('done')
      return
    }
    setPhase(slidesDone(user.id) ? 'tour' : 'slides')
  }, [user])

  // Re-disparo manual (Perfil → Ajuda → Rever tutorial).
  useEffect(() => {
    const replay = () => setPhase('slides')
    window.addEventListener('cdp:replay-onboarding', replay)
    return () => window.removeEventListener('cdp:replay-onboarding', replay)
  }, [])

  // Verifica se o cliente precisa consentir o gancho (fez ao menos 1 pedido e ainda
  // não solicitou). Roda no mount e ao evento cdp:refresh-hook (disparado logo após um
  // pedido, para o modal surgir na hora). Falha silenciosa: não bloqueia o app.
  useEffect(() => {
    if (user?.role !== 'CLIENT') return
    let cancelled = false
    const check = async () => {
      try {
        const res = await apiFetch('/client/hook-request')
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { needsConsent?: boolean }
        if (!cancelled) setNeedsHookConsent(!!data.needsConsent)
      } catch {
        // silencioso — sem consentimento pendente exibido
      }
    }
    void check()
    window.addEventListener('cdp:refresh-hook', check)
    return () => {
      cancelled = true
      window.removeEventListener('cdp:refresh-hook', check)
    }
  }, [user])

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'CLIENT') return <Navigate to="/" replace />
  // 1º acesso sem senha: força a definição antes de usar o app.
  if (user.hasPassword === false) return <Navigate to="/set-password" replace />

  // "Começar" ou "Pular" nas telas: marca slides e segue para o tour (fluxo "Tour sempre").
  function finishSlides() {
    if (!user) return
    markSlidesDone(user.id)
    setPhase('tour')
    navigate('/client/home')
  }
  // Concluir/pular o tour: marca o primeiro acesso como concluído.
  function finishTour() {
    if (!user) return
    markOnboardingSeen(user.id)
    setPhase('done')
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      <NotifProvider>
        <Outlet />
        <ClientTabBar />
        {phase === 'slides' && <OnboardingOverlay onFinish={finishSlides} />}
        {phase === 'tour' && <AppTour onFinish={finishTour} />}
        {/* Gancho: só depois do onboarding (fase 'done') e enquanto não confirmado. */}
        <GanchoConsentModal
          isOpen={phase === 'done' && needsHookConsent}
          onConfirmed={() => setNeedsHookConsent(false)}
        />
      </NotifProvider>
    </div>
  )
}
