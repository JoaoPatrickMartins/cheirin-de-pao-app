interface Tab<T extends string> {
  key: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  tabs: Tab<T>[]
  value: T
  onChange: (v: T) => void
}

export function SegmentedControl<T extends string>({
  tabs,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label="Navegação segmentada"
      style={{
        background: 'var(--color-surface-2)',
        borderRadius: 13,
        padding: 4,
        display: 'flex',
        gap: 4,
      }}
    >
      {tabs.map((tab) => {
        const isActive = value === tab.key
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            style={{
              flex: 1,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: 'none',
              cursor: 'pointer',
              borderRadius: 10,
              background: isActive ? 'var(--color-surface)' : 'transparent',
              boxShadow: isActive ? 'var(--shadow-soft)' : 'none',
              transition: 'background 0.15s ease, box-shadow 0.15s ease',
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              fontWeight: 700,
              color: isActive ? 'var(--color-text)' : 'var(--color-text-sec)',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
