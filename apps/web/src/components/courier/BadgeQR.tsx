import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import { BreadMark } from '../brand/BreadMark'

/**
 * QR de validação do crachá v3 (Onda 11 · T-28): a matriz vem do `qrcode-generator` com correção H
 * (a marca no centro cobre parte dos módulos); o desenho é do handoff — módulos arredondados, os três
 * "olhos" em anel e a marca espresso no meio. Alto contraste: espresso sobre branco.
 */
export function BadgeQR({ payload, size }: { payload: string; size: number }) {
  const { n, dark } = useMemo(() => {
    const q = qrcode(0, 'H')
    q.addData(payload)
    q.make()
    const count = q.getModuleCount()
    const eye = (x: number, y: number) => (x < 7 && y < 7) || (x >= count - 7 && y < 7) || (x < 7 && y >= count - 7)
    const cells: Array<[number, number]> = []
    for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (q.isDark(y, x) && !eye(x, y)) cells.push([x, y])
    return { n: count, dark: cells }
  }, [payload])
  const ink = 'var(--color-espresso)'
  const Eye = ({ x, y }: { x: number; y: number }) => (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.8} fill="none" stroke={ink} strokeWidth={1} />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={1} fill={ink} />
    </g>
  )
  const logo = size * 0.2
  return (
    <div key={payload} style={{ width: size, height: size, position: 'relative', animation: 'cdp-badge-qr .32s cubic-bezier(.2,.7,.2,1) both' }}>
      <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label="QR de validação do crachá" data-payload={payload} style={{ display: 'block' }}>
        {dark.map(([x, y]) => (
          <rect key={`${x}.${y}`} x={x + 0.1} y={y + 0.1} width={0.8} height={0.8} rx={0.28} fill={ink} />
        ))}
        <Eye x={0} y={0} />
        <Eye x={n - 7} y={0} />
        <Eye x={0} y={n - 7} />
      </svg>
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: logo, height: logo, borderRadius: size * 0.06, background: ink, display: 'grid', placeItems: 'center', boxShadow: `0 0 0 ${size * 0.02}px var(--color-surface)` }}
      >
        <BreadMark size={size * 0.12} color="var(--color-gold)" />
      </div>
    </div>
  )
}
