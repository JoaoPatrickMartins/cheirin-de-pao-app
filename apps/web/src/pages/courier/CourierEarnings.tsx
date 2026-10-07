import { useEffect, useState } from 'react'
import { PAY_MODE_LABELS, type PayMode } from '@cheirin-de-pao/shared'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon } from '../../components/brand/Icon'
import { CRLabel, CRNote, CRSkel, CRTag, crMoney, CR_DISPLAY } from '../../components/courier/kit'
import { CourierPage, CRCard } from '../../components/courier/CourierPage'
import { supportWhatsappUrl } from '../../lib/support'
import { ddmm, fetchEarnings, FUEL_REASON_TEXT, fuelFormula, type CourierEarnings as Earnings } from '../../lib/courierApi'

const period = (a: string, b: string) => `${ddmm(a)}–${ddmm(b)}`

/** "142 entregas × R$ 1,50" · "8 rotas × R$ 25,00" · "semanal fixo". */
function baseText(mode: string | null, units: number, valor: number | null): string {
  if (mode === 'PER_DELIVERY') return `${units} ${units === 1 ? 'entrega' : 'entregas'} × ${crMoney(valor ?? 0)}`
  if (mode === 'PER_ROUTE') return `${units} ${units === 1 ? 'rota' : 'rotas'} × ${crMoney(valor ?? 0)}`
  return 'semanal fixo'
}

function StatusTag({ e }: { e: Earnings['extrato'][number] }) {
  if (e.status === 'PAGO')
    return (
      <CRTag icon="check" tone="good" size="sm">
        pago{e.paidAt ? ` ${ddmm(e.paidAt)}` : ''}
      </CRTag>
    )
  if (e.status === 'A_PAGAR')
    return (
      <CRTag icon="clock" tone="gold" size="sm">
        a pagar{e.dueDate ? ` · ${ddmm(e.dueDate)}` : ''}
      </CRTag>
    )
  return (
    <CRTag icon="clock" size="sm">
      em análise
    </CRTag>
  )
}

/**
 * E13 · Meus ganhos (só leitura): a modalidade, a semana em andamento estimada e o extrato das
 * semanas. O valor final é sempre o que a operação aprovar.
 */
export function CourierEarnings({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Earnings | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    void fetchEarnings().then((r) => {
      if (!alive) return
      if (r.ok) setData(r.data)
      else setError(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const mode = data?.pay?.modalidade ?? null
  const c = data?.current
  const fuelOk = !!c && c.fuelBasis.reason === null
  // Sem o switch "Meus ganhos" do A5 (H-7): o combustível aparece só como valor — sem km nem conta.
  const fuelDetail = data?.fuelDetailVisible === true

  const extrato = data && data.extrato.length > 0 && (
    <>
      <CRLabel style={{ marginTop: 6 }}>Extrato</CRLabel>
      <CRCard>
        {data.extrato.map((e, i) => {
          const mudou = e.final !== e.estimated
          return (
            <div key={e.weekStart} style={{ padding: '14px 16px', borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{period(e.weekStart, e.weekEnd)}</span>
                <StatusTag e={e} />
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 600, flexWrap: 'wrap' }}>
                <span>Remuneração {crMoney(e.remuneration)}</span>
                {e.fuel > 0 && <span>Combustível {crMoney(e.fuel)}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {mudou && <span style={{ fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 600 }}>estimado {crMoney(e.estimated)} →</span>}
                <span style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 19, color: 'var(--color-text)' }}>
                  {e.status === 'PAGO' ? 'pago' : e.status === 'A_PAGAR' ? 'final' : 'estimado'} {crMoney(e.final)}
                </span>
              </div>
            </div>
          )
        })}
      </CRCard>
    </>
  )

  return (
    <CourierPage title="Meus ganhos" onBack={onClose}>
      {!data && error && <CRNote tone="gold">Não deu para carregar seus ganhos agora. Tente de novo em instantes.</CRNote>}
      {!data && !error && (
        <>
          <CRSkel h={240} r={24} />
          <CRSkel h={120} r={18} />
        </>
      )}

      {data && c && !mode && (
        <>
          <CRCard pad={22}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: 20, background: 'var(--color-gold-soft)', color: 'var(--color-accent)', display: 'grid', placeItems: 'center', margin: '0 auto' }}>
                <Icon name="wallet" size={28} aria-hidden="true" />
              </div>
              <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 21, color: 'var(--color-text)', marginTop: 14 }}>Forma de pagamento não definida</div>
              <div style={{ fontSize: 14, color: 'var(--color-text-sec)', marginTop: 6, lineHeight: 1.5 }}>A operação ainda não cadastrou como você recebe. Fale com ela para acertar.</div>
              <a
                href={supportWhatsappUrl('Olá! Sou entregador e preciso acertar a minha forma de pagamento.')}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 16, height: 58, borderRadius: 18, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontWeight: 800, fontSize: 16.5, textDecoration: 'none' }}
              >
                <Icon name="chat" size={22} stroke={2.3} aria-hidden="true" />
                Falar com a operação
              </a>
            </div>
          </CRCard>
          {fuelOk && c.fuel > 0 && (
            <CRNote icon="fuel">
              Mesmo assim, o combustível estimado das suas rotas entra na proposta da semana:{' '}
              {fuelDetail && c.km !== null ? `~${String(c.km).replace('.', ',')} km · ` : ''}≈ {crMoney(c.fuel)}.
            </CRNote>
          )}
          {extrato}
        </>
      )}

      {data && c && mode && (
        <>
          <div style={{ background: 'var(--color-espresso)', color: '#FAF5EC', borderRadius: 24, padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -30, bottom: -50, opacity: 0.1 }} aria-hidden="true">
              <BreadMark size={170} color="var(--color-gold)" />
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '5px 11px', borderRadius: 99, background: 'rgba(227,172,63,0.16)', color: 'var(--color-gold)', fontSize: 13, fontWeight: 800 }}>
                <Icon name="coin" size={14} stroke={2.3} aria-hidden="true" />
                Você recebe {PAY_MODE_LABELS[mode as PayMode]?.label ?? mode} · {crMoney(data.pay?.valor ?? 0)}
              </span>
              <div style={{ fontSize: 13, color: '#C7B595', fontWeight: 700, marginTop: 16 }}>Semana {period(c.weekStart, c.weekEnd)} · em andamento</div>
              <div style={{ fontSize: 12, color: '#C7B595', fontWeight: 800, letterSpacing: '0.08em', marginTop: 10 }}>A RECEBER (ESTIMADO)</div>
              <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 44, letterSpacing: '-0.03em', color: 'var(--color-gold)', lineHeight: 1.05 }}>~{crMoney(c.total)}</div>
              <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ display: 'flex', padding: '10px 0 4px', fontSize: 14, gap: 8 }}>
                  <span style={{ flex: 1, color: '#C7B595', fontWeight: 600 }}>
                    Remuneração
                    <br />
                    <span style={{ fontSize: 12.5 }}>{baseText(mode, c.units, data.pay?.valor ?? null)}</span>
                  </span>
                  <b style={{ fontWeight: 800 }}>{crMoney(c.remuneration)}</b>
                </div>
                {fuelOk && (fuelDetail || c.fuel > 0) && (
                  <div style={{ display: 'flex', padding: '8px 0 0', fontSize: 14, gap: 8 }}>
                    <span style={{ flex: 1, color: '#C7B595', fontWeight: 600 }}>
                      Combustível estimado
                      {fuelDetail && c.km !== null && (
                        <>
                          <br />
                          <span style={{ fontSize: 12.5 }}>{fuelFormula(c.km, c.fuelBasis)}</span>
                        </>
                      )}
                    </span>
                    <b style={{ fontWeight: 800 }}>≈ {crMoney(c.fuel)}</b>
                  </div>
                )}
              </div>
            </div>
          </div>
          <CRNote icon="alert">O valor final é o que a operação aprovar no fechamento da semana.</CRNote>
          {c.fuelBasis.reason && c.fuelBasis.reason !== 'SEM_KM' && <CRNote icon="fuel">{FUEL_REASON_TEXT[c.fuelBasis.reason]}</CRNote>}
          {c.openRuns > 0 && (
            <CRNote icon="route" tone="gold">
              {c.openRuns === 1 ? '1 rota foi iniciada e não encerrada' : `${c.openRuns} rotas foram iniciadas e não encerradas`} — só rota encerrada conta no cálculo.
            </CRNote>
          )}
          {extrato}
        </>
      )}
    </CourierPage>
  )
}
