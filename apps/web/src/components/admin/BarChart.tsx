interface BarChartItem {
  label: string
  value: number
  highlight?: boolean
}

interface BarChartProps {
  data: BarChartItem[]
  height?: number
}

export function BarChart({ data, height = 96 }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        height,
      }}
    >
      {data.map((item, i) => {
        const barHeight = Math.max((item.value / max) * (height - 20), 4)
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: barHeight,
                  background: item.highlight ? 'var(--color-gold)' : 'var(--color-surface-2)',
                  borderRadius: 7,
                  transition: 'height 0.3s ease',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--color-text-ter)',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
