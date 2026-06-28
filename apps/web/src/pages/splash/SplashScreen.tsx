import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon } from '../../components/brand/Icon'

export function SplashScreen() {
  const { isInstallable, isIOS, isStandalone, triggerInstall } = useInstallPrompt()
  const [showIOSSheet, setShowIOSSheet] = useState(false)
  const navigate = useNavigate()

  const canInstall = isInstallable || (isIOS && !isStandalone)

  const handleInstall = () => {
    if (isInstallable) {
      triggerInstall()
    } else if (isIOS && !isStandalone) {
      setShowIOSSheet(true)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1E1207',
        color: '#FAF5EC',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow radial quente */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(120% 80% at 50% -10%, rgba(227,172,63,0.18), transparent 60%)',
        }}
      />

      {/* Bloco central — logo + nome, centralizado verticalmente */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 22,
          position: 'relative',
          padding: 32,
        }}
      >
        {/* App icon container */}
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: '30%',
            backgroundColor: '#160C04',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)',
          }}
        >
          <BreadMark size={86} color="#E3AC3F" reduced={false} />
        </div>

        {/* Nome + tagline */}
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: '-0.03em',
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            Cheirin de Pão
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: '0.26em',
              color: '#E3AC3F',
              marginTop: 8,
              marginBottom: 0,
              textTransform: 'uppercase',
            }}
          >
            PÃO FRESCO NA PORTA
          </p>
        </div>
      </div>

      {/* Rodapé — banner de instalação + ações */}
      <div style={{ position: 'relative', padding: '0 24px 16px' }}>
        {/* Banner de instalação — clicável, dispara o install do PWA */}
        {canInstall && <InstallBanner onClick={handleInstall} />}

        {/* Primary CTA — entrar */}
        <PrimaryButton onClick={() => navigate('/login')}>
          Entrar
        </PrimaryButton>

        {/* Secondary link — criar conta */}
        <button
          onClick={() => navigate('/register')}
          style={{
            width: '100%',
            marginTop: 12,
            background: 'none',
            border: 'none',
            color: '#C7B595',
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Criar conta
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

interface InstallBannerProps {
  onClick: () => void
}

function InstallBanner({ onClick }: InstallBannerProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        backgroundColor: hovered
          ? 'rgba(250,245,236,0.1)'
          : 'rgba(250,245,236,0.06)',
        border: '1px solid rgba(250,245,236,0.12)',
        borderRadius: 22,
        padding: 18,
        marginBottom: 16,
        cursor: 'pointer',
        transition: 'background-color .15s, transform .15s',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        {/* Ícone-mini */}
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            backgroundColor: '#160C04',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <BreadMark size={30} color="#E3AC3F" reduced={false} />
        </div>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 15,
              margin: 0,
            }}
          >
            Instale o App do Cheirin de Pão
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              color: '#C7B595',
              marginTop: 2,
              marginBottom: 0,
            }}
          >
            Acesso direto pela tela inicial, abre na hora e funciona até sem
            internet.
          </p>
        </div>
        <Icon name="download" size={22} color="#E3AC3F" />
      </div>
    </button>
  )
}

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
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        padding: '16px 22px',
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
