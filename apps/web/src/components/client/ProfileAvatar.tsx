interface ProfileAvatarProps {
  name?: string
  size?: number
}

// Iniciais a partir do nome (primeira + última palavra). Fallback para "?".
function initialsFromName(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Avatar de perfil: iniciais do usuário sobre fundo espresso, com toque de marca
 * — anel dourado + selo de pãozinho no canto. Personaliza por usuário e reforça
 * a identidade do app ao mesmo tempo.
 */
export function ProfileAvatar({ name, size = 64 }: ProfileAvatarProps) {
  const badge = Math.round(size * 0.34)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--color-espresso)',
          border: '2px solid var(--color-gold)',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size * 0.4,
          letterSpacing: '0.01em',
          color: 'var(--color-primary-btn-text)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        {initialsFromName(name)}
      </div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: badge,
          height: badge,
          borderRadius: '50%',
          background: 'var(--color-gold)',
          border: '2px solid var(--color-app-bg)',
          display: 'grid',
          placeItems: 'center',
          fontSize: badge * 0.62,
          lineHeight: 1,
        }}
      >
        🥖
      </div>
    </div>
  )
}
