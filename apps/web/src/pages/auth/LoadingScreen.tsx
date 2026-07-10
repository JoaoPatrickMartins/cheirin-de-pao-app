import { BreadMark } from '../../components/brand/BreadMark'

export function LoadingScreen() {
  return (
    <div
      aria-live="polite"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-app-bg)',
      }}
    >
      <BreadMark size={48} color="var(--color-gold)" />
    </div>
  )
}
