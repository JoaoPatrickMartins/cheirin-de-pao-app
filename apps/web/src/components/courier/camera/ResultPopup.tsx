import { useEffect, useRef } from 'react'
import { blockLabel } from '@cheirin-de-pao/shared'
import { Icon, type Ic } from '../../brand/Icon'
import { CRBig, CRCesta, CRTag, CR_BODY, CR_DISPLAY } from '../kit'
import { brtTime, type StopSummary } from '../../../lib/courierApi'

/**
 * E4 · Pop-up de resultado do scan ⭐ — o entregador bate o olho e confere que o saquinho certo
 * está na porta certa: apto e bloco em destaque máximo.
 *
 * - Sucesso: contagem de ~3 s e segue sozinho (tocar adianta).
 * - Sem sinal (Onda 4): a entrega ficou GUARDADA no aparelho — mesmo avanço do sucesso, em âmbar.
 * - Erros (já confirmada, outra rota, não encontrado, falha): NÃO fecham sozinhos — "Entendi".
 * Usado sobre a câmera (`dark`) e sobre a lista (confirmação manual), para as duas formas de
 * confirmar terem a mesma resposta.
 */

export type ResultKind = 'ok' | 'offline' | 'already' | 'other' | 'notfound' | 'error'

export interface ResultPopupProps {
  kind: ResultKind
  summary?: StopSummary | null
  /** Texto do 409 vindo da API ("Essa entrega já foi confirmada" / "…marcada como não entregue"). */
  message?: string
  dark?: boolean
  /** Segundos até seguir sozinho (só no sucesso). */
  seconds?: number
  /** O que vem depois da contagem ("Próximo cupom" agora; "Foto da entrega" na Onda 3). */
  nextHint?: string
  nextIcon?: keyof typeof Ic
  onNext: () => void
  onClose: () => void
  onTypeCode?: () => void
  /** A7: parada com gancho na rota — pergunta "Deixou o gancho também?" antes de seguir. */
  onHook?: (delivered: boolean) => void
}

/** "Bloco 2 · Lado A" (vazio quando não há bloco nem complemento). */
function locLine(s: StopSummary): string {
  return [s.block ? blockLabel(s.block) : null, s.complement].filter(Boolean).join(' · ')
}

export function ResultPopup({
  kind,
  summary,
  message,
  dark = true,
  seconds = 3,
  nextHint = 'Próximo cupom',
  nextIcon = 'camera',
  onNext,
  onClose,
  onTypeCode,
  onHook,
}: ResultPopupProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const ok = kind === 'ok'
  // Gancho na rota (A7): a pergunta segura o pop-up até a resposta (não avança sozinho).
  const askHook = (ok || kind === 'offline') && !!summary?.hookToDeliver && !!onHook
  // Confirmada (no servidor ou guardada sem sinal): segue sozinho para a foto.
  const advances = (ok || kind === 'offline') && !askHook
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext

  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  // Sucesso segue sozinho; erro nunca.
  useEffect(() => {
    if (!advances) return
    const t = setTimeout(() => onNextRef.current(), seconds * 1000)
    return () => clearTimeout(t)
  }, [advances, seconds])

  const failedAlready = kind === 'already' && summary?.status === 'NOT_DELIVERED'
  // Parada só de gancho: o gancho é a entrega — sem a pergunta "deixou o gancho também?".
  const hookOnly = summary?.kind === 'HOOK'
  const head: Record<ResultKind, [string, keyof typeof Ic, string]> = {
    ok: ['var(--color-good)', 'check', hookOnly ? 'Gancho entregue' : 'Entrega confirmada'],
    offline: ['var(--color-amber)', 'cloudOff', 'Confirmada · sem sinal'],
    already: ['var(--color-amber)', 'clock', failedAlready ? 'Já resolvida' : 'Já confirmada'],
    other: ['var(--color-warn)', 'ban', 'Não é da sua rota'],
    notfound: ['var(--color-warn)', 'search', 'Não achamos esse cupom'],
    error: ['var(--color-warn)', 'cloudOff', 'Não conseguimos confirmar'],
  }
  const [headBg, headIcon, headText] = head[kind]
  const showStop = (advances || askHook || kind === 'already') && !!summary
  const when = brtTime(failedAlready ? summary?.failedAt : summary?.deliveredAt)
  const loc = summary ? locLine(summary) : ''

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: dark ? 'rgba(5,3,1,0.55)' : 'rgba(20,12,4,0.5)',
        fontFamily: CR_BODY,
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-label={headText}
        className="cdp-pop"
        onClick={advances ? onNext : undefined}
        style={{
          outline: 'none',
          width: '100%',
          maxWidth: 440,
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          borderRadius: 28,
          overflow: 'hidden',
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.6)',
          cursor: advances ? 'pointer' : 'default',
        }}
      >
        <div style={{ background: headBg, color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: 99, background: 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name={headIcon} size={26} color="#fff" stroke={3} aria-hidden="true" />
          </span>
          <span style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{headText}</span>
        </div>

        <div style={{ padding: '18px 22px 20px' }}>
          {kind === 'already' && (
            <p style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 12px' }}>
              {failedAlready
                ? `Essa parada já foi marcada como não entregue${when ? ` às ${when}` : ''}.`
                : `${message && !failedAlready ? message : 'Essa entrega já foi confirmada'}${when ? ` às ${when}` : ''}.`}
            </p>
          )}
          {kind === 'offline' && (
            <p
              style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-note-gold-ink)', background: 'var(--color-note-gold)', borderRadius: 12, padding: '10px 12px', margin: '0 0 14px', lineHeight: 1.4 }}
            >
              Sem sinal agora. Guardamos a entrega e enviamos sozinhos.
            </p>
          )}
          {kind === 'other' && (
            <p style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600, margin: 0 }}>Esse cupom é de outra rota. Separe o saquinho e avise a operação.</p>
          )}
          {kind === 'notfound' && (
            <p style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600, margin: 0 }}>
              O QR não corresponde a nenhum pedido de hoje. Tente de novo ou digite o código do cupom.
            </p>
          )}
          {kind === 'error' && (
            <p style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600, margin: 0 }}>Sem conexão agora. Confira o sinal e tente de novo.</p>
          )}

          {showStop && summary && (
            <div style={{ opacity: kind === 'already' ? 0.8 : 1 }}>
              <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: kind === 'already' ? 40 : 56, letterSpacing: '-0.035em', lineHeight: 0.95 }}>
                {summary.apartment ? `Apto ${summary.apartment}` : summary.clientName}
              </div>
              {loc && <div style={{ fontFamily: CR_DISPLAY, fontWeight: 700, fontSize: 22, color: 'var(--color-accent)', marginTop: 6, letterSpacing: '-0.01em' }}>{loc}</div>}
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>{summary.clientName}</div>
              <div style={{ fontSize: 14, color: 'var(--color-text-sec)', fontWeight: 600 }}>{summary.condominiumName}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' }}>
                {summary.quantity > 0 && (
                  <span style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 18, marginRight: 4 }}>
                    {summary.quantity === 1 ? '1 pão' : `${summary.quantity} pães`} <span aria-hidden="true">🥖</span>
                  </span>
                )}
                <CRCesta items={summary.marketItems} />
                {hookOnly && (
                  <CRTag emoji="🪝" tone="dark">
                    Gancho de porta
                  </CRTag>
                )}
              </div>
              {(advances || askHook) && (summary.isFirstOrder || summary.hasHook || summary.hookToDeliver) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {summary.isFirstOrder && <CRTag emoji="✨" tone="gold">1ª entrega</CRTag>}
                  {summary.hasHook && <CRTag emoji="🪝" tone="neutral">tem gancho</CRTag>}
                  {summary.hookToDeliver && <CRTag emoji="🪝" tone="dark">+ gancho para entregar</CRTag>}
                </div>
              )}
            </div>
          )}

          {askHook && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--color-border-2)' }}>
              <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', marginBottom: 12 }}>🪝 Deixou o gancho também?</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <CRBig variant="primary" icon="check" style={{ flex: 1 }} onClick={() => onHook!(true)}>
                  Sim
                </CRBig>
                <CRBig variant="ghost" style={{ flex: 1.3, fontSize: 15 }} onClick={() => onHook!(false)}>
                  Ficou para outro dia
                </CRBig>
              </div>
            </div>
          )}

          {!advances && !askHook && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
              {kind === 'notfound' && onTypeCode && (
                <CRBig variant="ghost" icon="keyboard" onClick={onTypeCode}>Digitar código</CRBig>
              )}
              <CRBig variant="primary" onClick={onClose}>Entendi</CRBig>
            </div>
          )}
        </div>

        {advances && (
          <div style={{ padding: '0 22px 18px' }}>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: ok ? 'var(--color-good)' : 'var(--color-amber)',
                  width: '100%',
                  transformOrigin: 'left',
                  animation: `cdp-count ${seconds}s linear forwards`,
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: 13.5, color: 'var(--color-text-sec)', fontWeight: 700 }}>
              <Icon name={nextIcon} size={15} color="var(--color-accent)" aria-hidden="true" />
              {nextHint} em {seconds} s<span style={{ flex: 1 }} />
              Toque para seguir
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
