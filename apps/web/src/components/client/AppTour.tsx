// Fase B do primeiro acesso — Tour do App (coach-marks + spotlight) sobre a Home real.
//
// Usa driver.js (lib leve, vanilla) que trata posicionamento, scroll, resize, foco
// e teclado — resolvendo o bug de medição manual do mockup. Estilizado com os
// tokens da marca via appTour.css. Ao concluir, mostra o card final de boas-vindas
// (TourEndCard): "Saber mais sobre o Cheirin" leva à página pública /sobre/, "Começar a usar"
// fecha. Os dois chamam onFinish (que marca onboardingDone). "Pular"/Esc encerram direto.

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
  { sel: 'saldo', title: 'Seu saldo de pãezins', body: 'Pãezins são a moeda do app: cada um vale um pão fresquinho na sua porta.' },
  { sel: 'comprar-paes', title: 'Comprar pãezins', body: 'Sem pãezins? Compre aqui em segundos, por Pix ou cartão.' },
  { sel: 'entrega-hoje', title: 'Sua entrega do dia', body: 'Acompanhe por aqui quando o pão está a caminho e quando chega.' },
  { sel: 'pedido-avulso', title: 'Avulso ou agenda', body: 'Precisa de pão só num dia? Faça um pedido avulso, único, sem compromisso.' },
  { sel: 'tab-agenda', title: 'Monte sua agenda', body: 'Escolha os dias da semana e pronto — o pão chega sozinho.' },
  { sel: 'tab-perfil', title: 'Recarga automática', body: 'No Perfil (ou na aba Pãezins) você ativa a recarga automática — seu saldo renova sozinho e você nunca fica sem.' },
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
  /** `'sobre'`: a pessoa escolheu "Saber mais" no card final — quem chama grava e abre a /sobre/. */
  onFinish: (next?: 'sobre') => void
}

export function AppTour({ onFinish }: AppTourProps) {
  const { user } = useAuth()
  const [showEnd, setShowEnd] = useState(false)
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
          // Card final de boas-vindas: o AppTour fica montado até a pessoa escolher.
          setShowEnd(true)
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

  if (!showEnd) return null

  return <TourEndCard onLearnMore={() => onFinishRef.current('sobre')} onStart={() => onFinishRef.current()} />
}

interface TourEndCardProps {
  onLearnMore: () => void
  onStart: () => void
}

/**
 * Fim do tutorial — boas-vindas + convite para a página "Sobre" (plano-pagina-sobre.md, D-13).
 * Mesmo padrão do modal do gancho: fundo escurecido, card de 22, título na fonte display.
 * "Começar a usar" (botão principal), Esc e toque no fundo fecham; "Saber mais" (link embaixo) fica em
 * "Abrindo…" até a página abrir.
 */
function TourEndCard({ onLearnMore, onStart }: TourEndCardProps) {
  const [leaving, setLeaving] = useState(false)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primaryRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !leaving) onStart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leaving, onStart])

  const learnMore = () => {
    if (leaving) return
    setLeaving(true)
    onLearnMore()
  }

  return (
    <div
      className="cdp-tour-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cdp-tour-end-title"
      aria-describedby="cdp-tour-end-text"
      onClick={(e) => {
        if (e.target === e.currentTarget && !leaving) onStart()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10002,
        background: 'rgba(20,12,4,0.62)', // o mesmo fundo do tour
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="cdp-tour-end-card"
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--color-surface)',
          borderRadius: 22,
          boxShadow: 'var(--shadow-strong)',
          padding: '24px 22px 14px',
          textAlign: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 52,
            height: 52,
            margin: '0 auto',
            borderRadius: 16,
            background: 'var(--color-espresso)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="check" size={24} color="var(--color-gold)" stroke={2.6} />
        </div>
        <h2
          id="cdp-tour-end-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: '16px 0 8px',
          }}
        >
          Bem-vindo ao Cheirin de Pão!
        </h2>
        <p
          id="cdp-tour-end-text"
          style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-sec)', margin: '0 0 18px' }}
        >
          Quer entender melhor como tudo funciona? Veja como os pãezins, a agenda e o gancho trabalham juntos para o
          pão chegar sozinho.
        </p>
        {/* "Começar a usar" é a ação principal (o tutorial acabou, a pessoa quer usar o app); "Saber
            mais" fica como link discreto embaixo. */}
        <button
          ref={primaryRef}
          type="button"
          onClick={onStart}
          disabled={leaving}
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
            cursor: leaving ? 'default' : 'pointer',
            opacity: leaving ? 0.5 : 1,
          }}
        >
          Começar a usar
        </button>
        <button
          type="button"
          onClick={learnMore}
          disabled={leaving}
          style={{
            width: '100%',
            minHeight: 44,
            marginTop: 6,
            background: 'none',
            border: 'none',
            color: 'var(--color-text-sec)',
            fontFamily: 'var(--font-body)',
            fontSize: 14.5,
            fontWeight: 700,
            cursor: leaving ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {leaving ? 'Abrindo…' : 'Saber mais sobre o Cheirin'}
          {!leaving && <Icon name="arrowR" size={16} stroke={2.2} />}
        </button>
      </div>
    </div>
  )
}
