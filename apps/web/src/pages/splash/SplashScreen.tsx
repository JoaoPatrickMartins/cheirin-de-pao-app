import { useState } from 'react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon } from '../../components/brand/Icon'

export function SplashScreen() {
  const { isInstallable, isIOS, isStandalone, triggerInstall } = useInstallPrompt()
  const [showIOSSheet, setShowIOSSheet] = useState(false)

  const handleCTA = () => {
    if (isInstallable) {
      triggerInstall()
    } else if (isIOS && !isStandalone) {
      setShowIOSSheet(true)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-5 relative overflow-hidden"
      style={{ backgroundColor: '#1E1207' }}
    >
      {/* Radial vinheta */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 256,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(227,172,63,0.15), transparent)',
        }}
      />

      {/* App icon container */}
      <div
        style={{
          width: 132,
          height: 132,
          borderRadius: '30%',
          backgroundColor: '#160C04',
          boxShadow: 'var(--shadow-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 64,
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <BreadMark size={86} color="#E3AC3F" reduced={false} />
      </div>

      {/* App name */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 32,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: '#FBF3E4',
          marginTop: 20,
          position: 'relative',
          zIndex: 1,
        }}
      >
        Cheirin de Pão
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.26em',
          color: '#E3AC3F',
          marginTop: 8,
          textTransform: 'uppercase',
          position: 'relative',
          zIndex: 1,
        }}
      >
        PÃO FRESCO NA PORTA
      </p>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Install card */}
      <div
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: 22,
          padding: 20,
          boxShadow: 'var(--shadow-soft)',
          marginBottom: 32,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 15,
            color: '#241608',
            marginBottom: 12,
            margin: '0 0 12px 0',
          }}
        >
          Instalar o Cheirin
        </p>

        {/* Primary CTA */}
        <PrimaryButton onClick={handleCTA}>
          Instalar e criar conta
        </PrimaryButton>

        {/* Secondary link */}
        <button
          onClick={() => {/* navigate to login — Phase 2 */}}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 44,
            background: 'transparent',
            color: '#B0702A',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          Já tenho conta — entrar
        </button>
      </div>

      {/* iOS install bottom sheet */}
      {showIOSSheet && (
        <IOSInstallSheet onDismiss={() => setShowIOSSheet(false)} />
      )}
    </div>
  )
}

/* ---------- Sub-components ---------- */

interface PrimaryButtonProps {
  onClick: () => void
  children: React.ReactNode
}

function PrimaryButton({ onClick, children }: PrimaryButtonProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: 44,
        backgroundColor: '#E3AC3F',
        color: '#1E1207',
        borderRadius: 'var(--radius-btn)',
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        padding: '13px 18px',
        border: 'none',
        cursor: 'pointer',
        transition: 'transform .15s, filter .15s',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        filter: hovered ? 'brightness(1.05)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

interface IOSInstallSheetProps {
  onDismiss: () => void
}

function IOSInstallSheet({ onDismiss }: IOSInstallSheetProps) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          zIndex: 40,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderRadius: '22px 22px 0 0',
          padding: 24,
          zIndex: 50,
          transform: 'translateY(0)',
          transition: 'transform 300ms ease-out',
        }}
      >
        {/* Sheet title */}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 21,
            letterSpacing: '-0.02em',
            color: '#241608',
            marginBottom: 20,
          }}
        >
          Adicionar à tela inicial
        </h2>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Step 1 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 44,
            }}
          >
            <Icon name="arrowU" size={24} color="#241608" />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: '#241608',
              }}
            >
              Toque no botão de compartilhar
            </span>
          </div>

          {/* Step 2 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 44,
            }}
          >
            <Icon name="list" size={24} color="#241608" />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: '#241608',
              }}
            >
              Role para baixo e toque em
            </span>
          </div>

          {/* Step 3 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 44,
              paddingLeft: 36,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: '#241608',
                fontWeight: 700,
              }}
            >
              &lsquo;Adicionar à Tela Inicial&rsquo;
            </span>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 44,
            marginTop: 16,
            background: 'transparent',
            color: '#B0702A',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Entendi
        </button>
      </div>
    </>
  )
}
