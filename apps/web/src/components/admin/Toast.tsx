// Toast — feedback flutuante reutilizável do admin. Padrão inline já usado em
// ClientDetailView. Use com o hook useToast abaixo.
import { useState, useCallback, useRef } from 'react'

export interface ToastState {
  message: string
  ok: boolean
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, ok = true) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ message, ok })
    timer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  return { toast, showToast }
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: toast.ok ? 'var(--color-espresso)' : 'var(--color-warn)',
        color: '#fff',
        borderRadius: 20,
        padding: '10px 20px',
        fontSize: 14,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        maxWidth: 'calc(100vw - 32px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {toast.message}
    </div>
  )
}
