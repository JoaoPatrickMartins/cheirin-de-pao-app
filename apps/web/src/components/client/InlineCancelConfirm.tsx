interface InlineCancelConfirmProps {
  /** Pergunta + consequência do cancelamento. */
  message: string
  error?: string | null
  busy?: boolean
  onConfirm: () => void
  onBack: () => void
}

/**
 * InlineCancelConfirm — confirmação de cancelamento embutida no próprio card (sem modal).
 *
 * Padrão único usado pelo histórico do cliente: vale tanto para pedido de pão quanto para
 * Cestinha ("Além do Pãozin"), para que a lista unificada tenha um só desenho de confirmação.
 */
export function InlineCancelConfirm({
  message,
  error,
  busy = false,
  onConfirm,
  onBack,
}: InlineCancelConfirmProps) {
  return (
    <div style={{ marginTop: 12, background: 'var(--color-surface-2)', borderRadius: 12, padding: 12 }}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)', margin: '0 0 10px', lineHeight: 1.45 }}>
        {message}
      </p>
      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: '0 0 8px' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{
            flex: 1,
            minHeight: 42,
            borderRadius: 'var(--radius-btn)',
            border: 'none',
            background: 'var(--color-bad, #C2410C)',
            color: '#fff',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Cancelando...' : 'Sim, cancelar'}
        </button>
        <button
          onClick={onBack}
          disabled={busy}
          style={{
            flex: 1,
            minHeight: 42,
            borderRadius: 'var(--radius-btn)',
            border: '1.5px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          Voltar
        </button>
      </div>
    </div>
  )
}

/** Botão "Cancelar ..." (outline) que abre a confirmação embutida. */
export const inlineCancelBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  marginTop: 12,
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--color-bad, #C2410C)',
  border: '1.5px solid var(--color-bad, #C2410C)',
  borderRadius: 'var(--radius-btn)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}
