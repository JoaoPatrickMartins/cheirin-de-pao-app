import { Icon } from '../brand/Icon'

export type CourierTab = 'list' | 'route' | 'done'

interface SegmentedControlProps {
  value: CourierTab
  onChange: (v: CourierTab) => void
}

export function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  const tabs: { key: CourierTab; icon: 'list' | 'route' | 'check'; label: string }[] = [
    { key: 'list', icon: 'list', label: 'Lista' },
    { key: 'route', icon: 'route', label: 'Rota' },
    { key: 'done', icon: 'check', label: 'Realizadas' },
  ]

  return (
    <div
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
              transition: 'background 0.15s, box-shadow 0.15s',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              color: isActive ? 'var(--color-text)' : 'var(--color-text-sec)',
            }}
          >
            <Icon
              name={tab.icon}
              size={17}
              color={isActive ? 'var(--color-text)' : 'var(--color-text-sec)'}
            />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
