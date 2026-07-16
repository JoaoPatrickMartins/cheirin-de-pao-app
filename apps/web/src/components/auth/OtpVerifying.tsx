/**
 * OtpVerifying — feedback de carregamento premium exibido enquanto o código OTP
 * é verificado (assim que o 4º dígito é preenchido). Substitui os campos do
 * OtpInput com um crossfade suave.
 *
 * Composição (alta fidelidade com a identidade da casa):
 *  - Anel dourado girando (conic-gradient mascarado → anel fino) = progresso.
 *  - Marca do app: pãozinho quentinho respirando, com três fumacinhas subindo em
 *    loop escalonado — o "cheirin de pão" literal, feito animação.
 *  - Legenda "Verificando código" com reticências animadas.
 *
 * Acessibilidade: role="status" + aria-live comunicam o carregamento a leitores de
 * tela. Sob prefers-reduced-motion (regra global em globals.css) as animações
 * congelam no estado inicial e a legenda preserva o significado.
 *
 * Estilos/keyframes: ver bloco "Login OTP" em src/styles/globals.css (prefixo cdp-).
 */
export function OtpVerifying() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Verificando código"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        minHeight: 72,
        paddingTop: 6,
        animation: 'cdp-otp-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) both',
      }}
    >
      <div style={{ position: 'relative', width: 84, height: 84, display: 'grid', placeItems: 'center' }}>
        {/* Halo dourado suave */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(227, 172, 63, 0.20), transparent 70%)',
          }}
        />

        {/* Anel girando (progresso) */}
        <div className="cdp-otp-ring" aria-hidden />

        {/* Disco cremoso com o pãozinho e a fumacinha */}
        <div
          style={{
            position: 'relative',
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-soft)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <svg width="42" height="42" viewBox="0 0 100 100" aria-hidden>
            {/* Fumacinhas — sobem, somem e reiniciam em loop escalonado */}
            <path
              className="cdp-steam cdp-steam-1"
              d="M50 46 C45 37 55 32 50 22"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              className="cdp-steam cdp-steam-2"
              d="M36 50 C32 43 39 39 36 32"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              className="cdp-steam cdp-steam-3"
              d="M64 50 C60 43 67 39 64 32"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Pãozinho — respira sutilmente */}
            <path
              className="cdp-otp-loaf"
              d="M22 80 C22 58 34 48 50 48 C66 48 78 58 78 80"
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text-sec)',
          letterSpacing: '-0.01em',
        }}
      >
        Verificando código
        <span className="cdp-otp-dots" aria-hidden />
      </p>
    </div>
  )
}
