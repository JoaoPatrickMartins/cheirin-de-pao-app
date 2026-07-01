// Fase B do primeiro acesso — Tour do App (coach-marks + spotlight) sobre a Home real.
//
// Usa driver.js (lib leve, vanilla) que trata posicionamento, scroll, resize, foco
// e teclado — resolvendo o bug de medição manual do mockup. Estilizado com os
// tokens da marca via appTour.css. Ao concluir, exibe um badge de boas-vindas e
// então chama onFinish (que marca onboardingDone). "Pular"/Esc encerram direto.

import { useEffect, useRef, useState } from 'react'
import { driver, type Config, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './appTour.css'
import { useAuth } from '../../hooks/useAuth'
import { getTourStep, setTourStep } from '../../lib/onboarding'
import { Icon } from '../brand/Icon'

interface TourStop {
  sel: string
  title: string
  body: string
}

const TOUR_STOPS: TourStop[] = [
  { sel: 'saldo', title: 'Seu saldo, em pães', body: 'Pães disponíveis na sua conta para agendar entregas.' },
  { sel: 'comprar-paes', title: 'Comprar pães', body: 'Sem pães? Compre aqui em segundos, por Pix ou cartão.' },
  { sel: 'entrega-hoje', title: 'Sua entrega do dia', body: 'Acompanhe por aqui quando o pão está a caminho e quando chega.' },
  { sel: 'pedido-avulso', title: 'Avulso ou agenda', body: 'Precisa de pão só num dia? Faça um pedido avulso, único, sem compromisso.' },
  { sel: 'tab-agenda', title: 'Monte sua agenda', body: 'Escolha os dias da semana e pronto — o pão chega sozinho.' },
  { sel: 'tab-perfil', title: 'Recarga automática', body: 'No Perfil (ou na aba Pães) você ativa a recarga automática — seu saldo renova sozinho e você nunca fica sem.' },
]

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Aguarda o anchor da 1ª parada existir (Home lazy + animação de entrada) antes de iniciar.
function waitForElement(sel: string, cb: () => void, tries = 0): void {
  if (typeof document !== 'undefined' && document.querySelector(sel)) cb()
  else if (tries < 60) requestAnimationFrame(() => waitForElement(sel, cb, tries + 1))
  else cb()
}

interface AppTourProps {
  onFinish: () => void
}

export function AppTour({ onFinish }: AppTourProps) {
  const { user } = useAuth()
  const [showBadge, setShowBadge] = useState(false)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  useEffect(() => {
    const reduce = prefersReducedMotion()
    const completed = { current: false }

    const config: Config = {
      showProgress: false, // usamos progresso próprio (no topo) + dots (no rodapé)
      nextBtnText: '› Próximo',
      prevBtnText: 'Anterior',
      doneBtnText: 'Concluir',
      showButtons: ['next', 'previous'],
      allowClose: true, // Esc encerra
      overlayColor: 'rgba(20,12,4,0.62)',
      overlayClickBehavior: 'nextStep', // clicar no backdrop avança
      disableActiveInteraction: true, // não navegar ao tocar o elemento destacado
      animate: !reduce,
      smoothScroll: !reduce,
      stagePadding: 6,
      stageRadius: 30, // raio do recorte do spotlight
      popoverClass: 'cdp-tour',
      steps: TOUR_STOPS.map((s) => ({
        element: `[data-tour="${s.sel}"]`,
        popover: { title: s.title, description: s.body },
      })),
      onPopoverRender: (popover, opts) => {
        const total = TOUR_STOPS.length
        const idx = opts.state.activeIndex ?? 0

        // Evita duplicar ao reutilizar o popover entre passos
        popover.wrapper.querySelector('.cdp-tour-top')?.remove()
        popover.footer.querySelector('.cdp-tour-dots')?.remove()

        // Topo: "x de N" (esquerda) + "Pular" (direita)
        const top = document.createElement('div')
        top.className = 'cdp-tour-top'
        const progress = document.createElement('span')
        progress.className = 'cdp-tour-progress'
        progress.textContent = `${idx + 1} de ${total}`
        const skip = document.createElement('button')
        skip.type = 'button'
        skip.className = 'cdp-tour-skip'
        skip.textContent = 'Pular'
        skip.addEventListener('click', () => opts.driver.destroy())
        top.append(progress, skip)
        popover.wrapper.insertBefore(top, popover.title)

        // Rodapé: dots de progresso (à esquerda dos botões)
        const dots = document.createElement('div')
        dots.className = 'cdp-tour-dots'
        for (let i = 0; i < total; i++) {
          const dot = document.createElement('span')
          if (i === idx) dot.classList.add('is-active')
          dots.append(dot)
        }
        popover.footer.insertBefore(dots, popover.footerButtons)

        // "Anterior" só a partir do 2º passo
        popover.previousButton.style.display = idx === 0 ? 'none' : ''
      },
      onHighlighted: (_el, _step, opts) => {
        if (user) setTourStep(user.id, opts.state.activeIndex ?? 0)
      },
      onNextClick: (_el, _step, opts) => {
        if (opts.driver.isLastStep()) {
          completed.current = true
          opts.driver.destroy()
        } else {
          opts.driver.moveNext()
        }
      },
      onPrevClick: (_el, _step, opts) => opts.driver.movePrevious(),
      onDestroyed: () => {
        if (completed.current) {
          // Badge de boas-vindas antes de finalizar (mantém AppTour montado ~1.8s).
          setShowBadge(true)
          window.setTimeout(() => onFinishRef.current(), 1800)
        } else {
          onFinishRef.current()
        }
      },
    }

    const driverObj: Driver = driver(config)
    const startIndex = user ? Math.min(getTourStep(user.id), TOUR_STOPS.length - 1) : 0

    let cancelled = false
    waitForElement(`[data-tour="${TOUR_STOPS[0].sel}"]`, () => {
      if (!cancelled) driverObj.drive(startIndex)
    })

    return () => {
      cancelled = true
      if (driverObj.isActive()) driverObj.destroy()
    }
    // Monta uma única vez por fase de tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!showBadge) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(68px + env(safe-area-inset-bottom))',
        zIndex: 10002,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          maxWidth: 360,
          background: 'var(--color-espresso)',
          color: 'var(--color-primary-btn-text)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-strong)',
          padding: '13px 16px',
        }}
      >
        <Icon name="check" size={18} color="var(--color-gold)" stroke={2.6} />
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.3,
          }}
        >
          Bem-Vindo ao Cheirin de Pão!
        </span>
      </div>
    </div>
  )
}
