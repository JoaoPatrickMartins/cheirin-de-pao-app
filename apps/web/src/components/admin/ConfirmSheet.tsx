// ConfirmSheet — bottom-sheet de confirmação reutilizável para ações sensíveis
// do admin (desativar, etc.). Padrão visual do diálogo de bloqueio de cliente.

interface ConfirmSheetProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  if (!open) return null

  const confirmBg = tone === 'danger' ? 'var(--color-accent)' : 'var(--color-gold)'
  const confirmColor = tone === 'danger' ? '#FFFFFF' : '#1E1207'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
        padding: '0 0 env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 32px',
          width: '100%',
          maxWidth: 480,
        }}
      >
        <h2
          id="confirm-sheet-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-text-sec)',
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: description ? 0 : 24 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 14,
              border: '1.5px solid var(--color-border)',
              background: 'transparent',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-text)',
              cursor: busy ? 'default' : 'pointer',
              minHeight: 44,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 14,
              border: 'none',
              background: confirmBg,
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              color: confirmColor,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.6 : 1,
              minHeight: 44,
            }}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
