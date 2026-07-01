// Fase A do primeiro acesso — telas explicativas (carrossel de 3 slides).
//
// Overlay full-screen sobre a Home. Swipe (drag) + botões Voltar/Próximo, "Pular"
// no topo e "Começar" no último slide. Ao concluir OU pular, chama onFinish — no
// fluxo "Tour sempre" os dois caminhos levam ao tour (ver ClientLayout).

import { useState } from 'react'
import { motion, MotionConfig, type PanInfo } from 'framer-motion'
import { StepDots } from '../auth/StepDots'
import { Icon } from '../brand/Icon'
import { BreadMark } from '../brand/BreadMark'
import { SLIDES, StepVisual } from './onboardingSlides'

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]
const SWIPE_THRESHOLD = 45 // px — mesmo limiar do handoff

interface OnboardingOverlayProps {
  onFinish: () => void
}

export function OnboardingOverlay({ onFinish }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0)
  const isLast = step === SLIDES.length - 1

  function next() {
    if (isLast) onFinish()
    else setStep((s) => Math.min(SLIDES.length - 1, s + 1))
  }
  function prev() {
    setStep((s) => Math.max(0, s - 1))
  }
  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x <= -SWIPE_THRESHOLD && step < SLIDES.length - 1) setStep(step + 1)
    else if (info.offset.x >= SWIPE_THRESHOLD && step > 0) setStep(step - 1)
  }

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-label="Boas-vindas ao Cheirin de Pão"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70, // acima da ClientTabBar (z-index 50)
          background: 'var(--color-app-bg)',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Topo: logo (esquerda) + Pular (direita) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 0' }}>
          <BreadMark size={32} color="var(--color-gold)" />
          <button
            onClick={onFinish}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 10px',
              minHeight: 44,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-text-ter)',
            }}
          >
            Pular
          </button>
        </div>

        {/* Carrossel */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <motion.div
            style={{ display: 'flex', width: '100%', height: '100%', cursor: 'grab' }}
            animate={{ x: `-${step * 100}%` }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
          >
            {SLIDES.map((slide) => (
              <div
                key={slide.kind}
                style={{
                  flex: '0 0 100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                  gap: 22,
                  padding: '28px 24px 0',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: '100%' }}>
                  <StepVisual kind={slide.kind} />
                </div>
                <div>
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 28,
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                      color: 'var(--color-text)',
                      margin: '0 0 8px',
                    }}
                  >
                    {slide.title}
                  </h2>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 15,
                      lineHeight: 1.5,
                      color: 'var(--color-text-sec)',
                      margin: 0,
                    }}
                  >
                    {slide.body}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Rodapé: dots + navegação */}
        <div style={{ padding: '8px 24px 22px' }}>
          <StepDots currentStep={step} totalSteps={SLIDES.length} />
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {step > 0 && (
              <motion.button
                onClick={prev}
                whileTap={{ scale: 0.97 }}
                style={{
                  flexShrink: 0,
                  minHeight: 48,
                  padding: '0 20px',
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text)',
                  border: 'none',
                  borderRadius: 'var(--radius-btn)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name="arrowL" size={18} color="var(--color-text)" stroke={2.2} />
                Voltar
              </motion.button>
            )}
            <motion.button
              onClick={next}
              whileHover={{ y: -1, filter: 'brightness(1.08)' }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                flex: 1,
                minHeight: 52,
                background: 'var(--color-espresso)',
                color: 'var(--color-primary-btn-text)',
                border: 'none',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'var(--font-body)',
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
              }}
            >
              {isLast ? 'Começar' : 'Próximo'}
            </motion.button>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}
