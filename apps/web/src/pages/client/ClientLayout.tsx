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
import { hasSeenOnboarding, slidesDone, markSlidesDone, markOnboardingSeen } from '../../lib/onboarding'

// Fluxo de primeiro acesso: telas explicativas → tour do app → done.
type OnboardingPhase = 'slides' | 'tour' | 'done'

export function ClientLayout() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<OnboardingPhase>('done')
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
      </NotifProvider>
    </div>
  )
}
