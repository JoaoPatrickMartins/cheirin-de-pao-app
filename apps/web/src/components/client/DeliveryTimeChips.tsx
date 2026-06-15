/**
 * DeliveryTimeChips — 4 chips de seleção de horário de entrega
 *
 * Seleção exclusiva (uma opção por vez). Chip ativo usa goldSoft + borda accent.
 * borderRadius: 13px (excepção de alta fidelidade do handoff — não 16px)
 *
 * Requirements: SCHED-02 (salvar deliveryTime no Schedule)
 * Source: screens-order.jsx linhas 193–197, 04-UI-SPEC.md seção 2
 */

const DELIVERY_TIMES = ['06:30', '07:00', '07:30', '08:00']

interface DeliveryTimeChipsProps {
  value: string
  onChange: (v: string) => void
}

export default function DeliveryTimeChips({ value, onChange }: DeliveryTimeChipsProps) {
  return (
    <div>
      {/* Label da seção */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 12.5,
          color: 'var(--color-text-sec)',
          margin: '0 0 9px 0',
        }}
      >
        Horário de entrega
      </p>

      {/* Container dos chips */}
      <div
        style={{
          display: 'flex',
          gap: 9,
          marginBottom: 18,
        }}
      >
        {DELIVERY_TIMES.map((time) => {
          const isActive = value === time
          return (
            <button
              key={time}
              onClick={() => onChange(time)}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 13,
                border: isActive
                  ? '1.5px solid var(--color-accent)'
                  : '1.5px solid var(--color-border)',
                background: isActive ? 'var(--color-gold-soft)' : 'var(--color-surface)',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'background .15s, border-color .15s, color .15s',
                minHeight: 44,
              }}
            >
              {time}
            </button>
          )
        })}
      </div>
    </div>
  )
}
