interface BreadMarkProps {
  size?: number
  color?: string
  reduced?: boolean
  side?: number
  strong?: number
}

export function BreadMark({
  size = 100,
  color = '#E3AC3F',
  reduced = false,
  side = 0.5,
  strong = 1,
}: BreadMarkProps) {
  if (reduced) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Cheirin de Pão">
        <path d="M20 80 C20 56 33 46 50 46 C67 46 80 56 80 80" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
        <path d="M50 46 C44 36 56 31 50 20" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Cheirin de Pão">
      <path d="M22 80 C22 58 34 48 50 48 C66 48 78 58 78 80" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" opacity={strong} />
      <path d="M50 48 C45 39 55 34 50 24" fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round" opacity={strong} />
      <path d="M36 52 C32 45 39 41 36 34" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" opacity={side} />
      <path d="M64 52 C60 45 67 41 64 34" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" opacity={side} />
    </svg>
  )
}
