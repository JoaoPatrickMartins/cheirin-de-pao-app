import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { VEHICLE_LABELS, vehicleUsesFuel, type VehicleType } from '@cheirin-de-pao/shared'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon } from '../../components/brand/Icon'
import { BadgeQR } from '../../components/courier/BadgeQR'
import { crInitials, CR_BODY, CR_DISPLAY } from '../../components/courier/kit'
import { useBadgeCode } from '../../hooks/useBadgeCode'
import { useWakeLock } from '../../hooks/useWakeLock'
import { supportWhatsappUrl } from '../../lib/support'
import type { CourierMe } from '../../lib/courierApi'

const TZ = 'America/Sao_Paulo'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
/** Largura do cartão no handoff (390 px de tela). */
const CARD_W = 326
const CARD_BORDER = '1px solid rgba(43,26,12,.07)'
const CARD_SHADOW = '0 1px 2px rgba(43,26,12,.05), 0 24px 48px -22px rgba(43,26,12,.34)'
/** Selo "de vidro" sobre a foto. */
const GLASS: CSSProperties = { background: 'rgba(255,253,249,.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 2px 8px -2px rgba(43,26,12,.25)' }

const since = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: TZ }).replace('.', '').replace(' de ', '/')
const dmy = (d: string) => d.split('-').reverse().join('/')

function clockParts(d: Date) {
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { hm: `${get('hour')}:${get('minute')}`, s: get('second') }
}

/** Mostrador circular da contagem (18 px). Volta ao início sem transição. */
function Dial({ left, size = 18 }: { left: number; size?: number }) {
  const r = size / 2 - 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={2.5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={`${(left / 30) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: left === 30 ? 'none' : 'stroke-dasharray 1s linear' }}
      />
    </svg>
  )
}

/** Anel da contagem em volta do QR grande: retângulo arredondado que começa no centro do topo. */
function ringPath(w: number, r: number, i: number) {
  const x = i
  const y = i
  const W = w - 2 * i
  const cx = w / 2
  return `M${cx},${y} H${x + W - r} A${r},${r} 0 0 1 ${x + W},${y + r} V${y + W - r} A${r},${r} 0 0 1 ${x + W - r},${y + W} H${x + r} A${r},${r} 0 0 1 ${x},${y + W - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--color-text-ter)' }}>{k}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', marginTop: 3, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  )
}

/** Furo do cartão (por onde passa a presilha). */
const Hole = () => (
  <div style={{ height: 32, display: 'grid', placeItems: 'center' }}>
    <span style={{ width: 46, height: 9, borderRadius: 99, background: 'var(--color-app-bg)', boxShadow: 'inset 0 1px 2px rgba(43,26,12,.2)' }} />
  </div>
)

/** Nome em 28 px; se não couber, reduz até 24 e depois quebra em 2 linhas (handoff §7 · T-31). */
function FitName({ name, muted }: { name: string; muted: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ size: number; wrap: boolean }>({ size: 28, wrap: false })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    for (const size of [28, 26, 24]) {
      el.style.fontSize = `${size}px`
      if (el.scrollWidth <= el.clientWidth) return setFit({ size, wrap: false })
    }
    setFit({ size: 24, wrap: true })
  }, [name])
  return (
    <div
      ref={ref}
      style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: fit.size, letterSpacing: '-0.035em', lineHeight: 1.05, color: muted ? 'var(--color-text-sec)' : 'var(--color-text)', whiteSpace: fit.wrap ? 'normal' : 'nowrap', overflow: 'hidden' }}
    >
      {name}
    </div>
  )
}

type BadgeState = 'ativo' | 'desativado' | 'vencido'

/**
 * E15 · Crachá digital v3 "Cordão" (plano do entregador, Onda 11 — handoff
 * `.projeto/design_handoff_cracha_v3`). Crachá de cordão na tela: a foto grande primeiro (é o que o
 * porteiro confere) e, no rodapé, o QR de validação que muda a cada 30 s com o código "0427 · K3WD"
 * (gerados no aparelho — sem sinal também). Tocar no QR vira o crachá e mostra o QR grande.
 *
 * - Validade na linha do "desde" (H-10). Vencido (H-3) e desativado: foto em cinza, sem QR,
 *   "Falar com a operação".
 * - O estado "Validado pela portaria" chega com o futuro perfil Portaria.
 * - A web não controla o brilho (V-54): só a tela acesa (wake lock) enquanto o crachá está aberto.
 */
export function CourierBadge({
  me,
  courierId,
  secret,
  offsetMs = 0,
  onClose,
}: {
  me: CourierMe
  courierId: string | null
  /** Segredo do QR (null = ainda não baixado neste aparelho ou crachá inativo). */
  secret: string | null
  /** Hora do servidor − hora do aparelho (T-26). */
  offsetMs?: number
  onClose: () => void
}) {
  useWakeLock(true)
  const state: BadgeState = me.badge.active ? 'ativo' : me.badge.reason === 'VENCIDO' ? 'vencido' : 'desativado'
  const off = state !== 'ativo'
  const { now, token, secondsLeft, unavailable } = useBadgeCode({ secret, courierId, offsetMs, enabled: !off })
  const [flip, setFlip] = useState(false)
  const canFlip = !off && !!token
  const toggle = () => canFlip && setFlip((f) => !f)
  const clock = clockParts(now)
  const matricula = me.badge.number ?? '----'

  const v = me.vehicle
  const vehicleText = v ? (vehicleUsesFuel(v.tipo) ? [VEHICLE_LABELS[v.tipo as VehicleType] ?? v.tipo, v.placa].filter(Boolean).join(' · ') : VEHICLE_LABELS[v.tipo as VehicleType] ?? v.tipo) : null
  const subtitle = `Entregador parceiro · desde ${since(me.since)}${me.badge.validUntil ? ` · válido até ${dmy(me.badge.validUntil)}` : ''}`

  const face: CSSProperties = { width: '100%', background: 'var(--color-badge-card)', borderRadius: 28, border: CARD_BORDER, boxShadow: CARD_SHADOW, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }
  const chip =
    state === 'ativo' ? (
      <span data-testid="badge-status" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 13px 0 11px', borderRadius: 99, color: 'var(--color-good)', fontSize: 13, fontWeight: 800, ...GLASS }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--color-good)', animation: 'cdp-badge-breath 2.8s ease-in-out infinite' }} />
        Ativo
      </span>
    ) : (
      <span data-testid="badge-status" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 13px 0 11px', borderRadius: 99, color: 'var(--color-warn)', fontSize: 13, fontWeight: 800, ...GLASS }}>
        <Icon name="ban" size={14} stroke={2.6} aria-hidden="true" />
        {state === 'vencido' ? 'Vencido' : 'Inativo'}
      </span>
    )

  const code = token ? (
    <>
      {matricula}
      <span style={{ color: 'var(--color-gold)' }}> · </span>
      <span key={token.code} style={{ display: 'inline-block', animation: 'cdp-badge-tick .25s ease-out both' }}>
        {token.code}
      </span>
    </>
  ) : null

  /** Rodapé sem QR: desativado, vencido, sem segredo neste aparelho ou sem Web Crypto. */
  const noQr = (title: string, sub: string, icon: 'lock' | 'cloudOff') => (
    <>
      <span style={{ width: 96, height: 96, borderRadius: 18, border: '1.5px dashed var(--color-border)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={26} color="var(--color-text-ter)" aria-hidden="true" />
      </span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-sec)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
      </div>
    </>
  )

  const footer =
    state === 'desativado'
      ? noQr('QR indisponível', 'Seu cadastro está desativado', 'lock')
      : state === 'vencido'
        ? noQr('QR indisponível', me.badge.validUntil ? `Seu crachá venceu em ${dmy(me.badge.validUntil)}` : 'Seu crachá venceu', 'lock')
        : unavailable
          ? noQr('QR indisponível', 'Este aparelho não gera o QR. Use o app pelo endereço oficial.', 'lock')
          : !token
            ? noQr('QR indisponível', secret ? 'Gerando o código…' : 'Abra o app com sinal uma vez para gerar o QR.', 'cloudOff')
            : (
                <>
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label="Virar o crachá e ampliar o QR"
                    style={{ width: 98, height: 98, borderRadius: 18, background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer', padding: 0 }}
                  >
                    <BadgeQR payload={token.payload} size={82} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-text)' }}>Validação da portaria</div>
                    <div data-testid="badge-code" style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.1em', marginTop: 6 }}>
                      {code}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', fontVariantNumeric: 'tabular-nums' }}>
                      <Dial left={secondsLeft} />
                      novo código em {secondsLeft} s
                    </div>
                  </div>
                </>
              )

  const ring = 248
  const ringD = ringPath(ring, 30, 1.5)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crachá digital"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        overflowX: 'hidden',
        overflowY: 'auto',
        background: 'radial-gradient(110% 55% at 50% 30%, var(--color-surface) 0%, var(--color-app-bg) 70%)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'env(safe-area-inset-top, 0px) 16px calc(16px + env(safe-area-inset-bottom, 0px))',
        fontFamily: CR_BODY,
      }}
    >
      {/* Cordão: passa por trás do cabeçalho até a presilha */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          height: 'calc(112px + env(safe-area-inset-top, 0px))',
          width: 24,
          transform: 'translateX(-50%)',
          background: off ? 'var(--color-surface-2)' : 'var(--color-gold-soft)',
          borderLeft: `1px solid ${off ? 'var(--color-border)' : 'rgba(176,112,42,.22)'}`,
          borderRight: `1px solid ${off ? 'var(--color-border)' : 'rgba(176,112,42,.22)'}`,
        }}
      />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, flexShrink: 0 }}>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', display: 'grid', placeItems: 'center', color: 'var(--color-text)', cursor: 'pointer' }}
        >
          <Icon name="x" size={20} stroke={2.2} aria-hidden="true" />
        </button>
        <span
          data-testid="badge-clock"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 13px', borderRadius: 99, background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', fontSize: 13.5, fontWeight: 800, color: off ? 'var(--color-text-ter)' : 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}
        >
          <Icon name="clock" size={15} color={off ? 'var(--color-text-ter)' : 'var(--color-accent)'} aria-hidden="true" />
          {off ? (
            'Sem validade'
          ) : (
            <>
              {clock.hm}:
              <span key={clock.s} style={{ display: 'inline-block', color: 'var(--color-accent)', animation: 'cdp-badge-tick .22s ease-out both' }}>
                {clock.s}
              </span>
            </>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14, flexShrink: 0 }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: CARD_W, transformOrigin: '50% -70px', animation: 'cdp-badge-swing 1.1s cubic-bezier(.3,.7,.3,1) both' }}>
          {/* Presilha */}
          <span
            aria-hidden="true"
            style={{ position: 'absolute', left: '50%', top: -16, transform: 'translateX(-50%)', width: 44, height: 24, borderRadius: 9, background: off ? 'var(--color-text-ter)' : 'var(--color-espresso)', zIndex: 3, display: 'grid', placeItems: 'center' }}
          >
            <span style={{ width: 20, height: 5, borderRadius: 3, background: off ? 'var(--color-surface-2)' : 'var(--color-gold)' }} />
          </span>
          <div style={{ perspective: 1400 }}>
            <div style={{ position: 'relative', transformStyle: 'preserve-3d', transition: 'transform .6s cubic-bezier(.2,.7,.2,1)', transform: flip ? 'rotateY(180deg)' : 'none' }}>
              {/* Frente */}
              <div style={face} aria-hidden={flip || undefined}>
                <Hole />
                <div
                  style={{ position: 'relative', margin: '0 12px', height: 'clamp(200px, 34vh, 272px)', borderRadius: 20, overflow: 'hidden', background: me.photoUrl ? 'var(--color-surface-2)' : 'var(--color-gold-soft)' }}
                >
                  {me.photoUrl ? (
                    <img
                      src={me.photoUrl}
                      alt={`Foto de ${me.name}`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: off ? 'grayscale(1)' : 'none', opacity: off ? 0.55 : 1 }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 112, letterSpacing: '-0.05em', color: 'var(--color-espresso)', opacity: off ? 0.55 : 1 }}
                    >
                      {crInitials(me.name)}
                    </div>
                  )}
                  <span aria-hidden="true" style={{ position: 'absolute', right: 12, top: 12, width: 34, height: 34, borderRadius: 11, background: 'var(--color-espresso)', display: 'grid', placeItems: 'center' }}>
                    <BreadMark size={19} color="var(--color-gold)" />
                  </span>
                  {!me.photoUrl && !off && (
                    <span style={{ position: 'absolute', left: 12, top: 12, display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, color: 'var(--color-note-gold-ink)', ...GLASS }}>
                      <Icon name="camera" size={15} color="var(--color-accent)" aria-hidden="true" />
                      Peça sua foto à operação
                    </span>
                  )}
                  <span style={{ position: 'absolute', left: 12, bottom: 12 }}>{chip}</span>
                </div>
                <div style={{ padding: '16px 20px 0' }}>
                  <FitName name={me.name} muted={off} />
                  <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', fontWeight: 600, marginTop: 4 }}>{subtitle}</div>
                </div>
                <div style={{ display: 'flex', gap: 22, padding: '14px 20px 18px' }}>
                  <KV k="CPF" v={me.cpfMasked ?? '—'} />
                  {vehicleText && <KV k="VEÍCULO" v={vehicleText} />}
                </div>
                <div
                  style={{ borderTop: '1px solid var(--color-border-2)', background: 'var(--color-surface-alt)', borderRadius: '0 0 28px 28px', padding: '14px 16px 16px', display: 'flex', alignItems: 'center', gap: 14, minHeight: 128 }}
                >
                  {footer}
                </div>
              </div>

              {/* Verso: QR ampliado */}
              {canFlip && (
                <div
                  aria-hidden={!flip || undefined}
                  style={{ ...face, position: 'absolute', inset: 0, transform: 'rotateY(180deg)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <Hole />
                  <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--color-espresso)', color: 'var(--color-gold)', display: 'grid', placeItems: 'center', fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 16 }}>
                      {crInitials(me.name)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 17, color: 'var(--color-text)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.name}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 600 }}>Entregador · Cheirin de Pão</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                    <button
                      type="button"
                      onClick={toggle}
                      aria-label="Voltar para a frente do crachá"
                      style={{ position: 'relative', width: ring, height: ring, display: 'grid', placeItems: 'center', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      <svg width={ring} height={ring} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
                        <path d={ringD} fill="none" stroke="var(--color-surface-2)" strokeWidth={3} />
                        <path
                          d={ringD}
                          fill="none"
                          stroke="var(--color-gold)"
                          strokeWidth={3}
                          strokeLinecap="round"
                          pathLength={100}
                          strokeDasharray={`${(secondsLeft / 30) * 100} 100`}
                          style={{ transition: secondsLeft === 30 ? 'none' : 'stroke-dasharray 1s linear' }}
                        />
                      </svg>
                      <div style={{ width: ring - 14, height: ring - 14, borderRadius: 24, background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', display: 'grid', placeItems: 'center' }}>
                        {token && <BadgeQR payload={token.payload} size={ring - 46} />}
                      </div>
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 600 }}>ou digite o código</div>
                  <div
                    style={{ marginTop: 8, fontFamily: MONO, fontSize: 21, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.14em', padding: '9px 18px', borderRadius: 12, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border-2)' }}
                  >
                    {code}
                  </div>
                  <div style={{ margin: '12px 0 20px', fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Novo código em {secondsLeft} s</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 16 }} />
      {off ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', textAlign: 'center', lineHeight: 1.45 }}>
            {state === 'vencido' ? 'A validade do seu crachá passou. A operação renova no seu cadastro.' : 'O crachá volta quando a operação reativar seu cadastro.'}
          </div>
          <a
            href={supportWhatsappUrl('Olá! Sou entregador e preciso falar sobre o meu crachá.')}
            target="_blank"
            rel="noopener noreferrer"
            style={{ height: 56, borderRadius: 16, background: 'var(--color-espresso)', color: 'var(--color-primary-btn-text)', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none' }}
          >
            <Icon name="chat" size={20} color="var(--color-gold)" stroke={2.2} aria-hidden="true" />
            Falar com a operação
          </a>
        </div>
      ) : (
        canFlip && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-sec)', flexShrink: 0 }}>
            <Icon name="repeat" size={15} color="var(--color-accent)" aria-hidden="true" />
            {flip ? 'Toque no QR para voltar à frente' : 'Toque no QR para virar o crachá'}
          </div>
        )
      )}
    </div>
  )
}
