import { useEffect, useRef, useState } from 'react'
import { STOP_CODE_LENGTH, LEGACY_STOP_CODE_LENGTH, blockLabel } from '@cheirin-de-pao/shared'
import { CRBig, CRChoice, CRNote, CRSheet, CRSpin, CR_DISPLAY } from '../kit'
import { brtTime, type LookupMatch, type StopSummary } from '../../../lib/courierApi'

/**
 * E3 · Digitar código — o plano B do scanner (câmera falhou, QR borrado, sem câmera).
 *
 * O código do cupom são os 6 últimos caracteres do id do pedido (só 0-9 e A-F). O campo aceita só
 * esses caracteres e troca O por 0 — a confusão mais comum de quem lê um cupom térmico às 5 h.
 * Cupom impresso antes da virada tem 4 caracteres e também vale (T-1).
 */

export type CodeSubmitResult =
  | { kind: 'ok' }
  | { kind: 'notfound' }
  | { kind: 'already'; summary: StopSummary | null }
  | { kind: 'choices'; matches: LookupMatch[] }
  | { kind: 'error' }

export interface CodeSheetProps {
  /** Resolve o código: busca a parada e confirma. `pick` = parada escolhida numa lista ambígua. */
  onSubmit: (code: string, pick?: LookupMatch) => Promise<CodeSubmitResult>
  onClose: () => void
  dark?: boolean
}

function sanitize(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[^0-9A-F]/g, '')
    .slice(0, STOP_CODE_LENGTH)
}

function stopLine(s: StopSummary): string {
  return [s.apartment ? `Apto ${s.apartment}` : null, s.block ? blockLabel(s.block) : null, s.clientName].filter(Boolean).join(' · ')
}

export function CodeSheet({ onSubmit, onClose, dark = false }: CodeSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CodeSubmitResult | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const ready = value.length === STOP_CODE_LENGTH || value.length === LEGACY_STOP_CODE_LENGTH
  const err = result?.kind === 'notfound' || result?.kind === 'already' || result?.kind === 'error'
  const boxColor = result?.kind === 'notfound' || result?.kind === 'error' ? 'var(--color-warn)' : result?.kind === 'already' ? 'var(--color-accent)' : 'var(--color-text)'

  const submit = async (pick?: LookupMatch) => {
    if (!ready || busy) return
    setBusy(true)
    const r = await onSubmit(value, pick)
    setBusy(false)
    setResult(r)
  }

  return (
    <CRSheet title="Digitar código" sub="O código fica embaixo do QR do cupom." onClose={onClose} busy={busy} dark={dark}>
      <label style={{ position: 'relative', display: 'block' }}>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Código do cupom</span>
        <div aria-hidden="true" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 32, color: 'var(--color-text-ter)' }}>#</span>
          {Array.from({ length: STOP_CODE_LENGTH }).map((_, i) => {
            const ch = value[i]
            const cursor = !err && result?.kind !== 'ok' && i === value.length
            return (
              <div
                key={i}
                style={{
                  width: 44,
                  height: 58,
                  borderRadius: 14,
                  border: `2.5px solid ${ch ? boxColor : cursor ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: 'var(--color-surface-alt)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: CR_DISPLAY,
                  fontWeight: 800,
                  fontSize: 28,
                  color: 'var(--color-text)',
                }}
              >
                {ch ?? ''}
              </div>
            )
          })}
        </div>
        {/* Input real por cima das caixas: teclado nativo, colar e leitor de tela funcionam. */}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(sanitize(e.target.value))
            setResult(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={STOP_CODE_LENGTH}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, fontSize: 16, caretColor: 'transparent' }}
        />
      </label>

      <div style={{ minHeight: 64, paddingTop: 12 }} aria-live="polite">
        {value.length === LEGACY_STOP_CODE_LENGTH && !result && (
          <div style={{ fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 600, textAlign: 'center' }}>
            Cupom antigo tem 4 caracteres — também vale.
          </div>
        )}
        {result?.kind === 'notfound' && (
          <CRNote icon="alert" tone="danger">Não achamos esse código na sua rota. Confira as letras no cupom.</CRNote>
        )}
        {result?.kind === 'error' && <CRNote icon="cloudOff" tone="danger">Sem conexão agora. Tente de novo.</CRNote>}
        {result?.kind === 'already' && (
          <CRNote icon="clock" tone="gold">
            <b>
              {result.summary?.status === 'NOT_DELIVERED'
                ? `Essa parada já foi marcada como não entregue${brtTime(result.summary?.failedAt) ? ` às ${brtTime(result.summary?.failedAt)}` : ''}.`
                : `Essa entrega já foi confirmada${brtTime(result.summary?.deliveredAt) ? ` às ${brtTime(result.summary?.deliveredAt)}` : ''}.`}
            </b>
            {result.summary && (
              <>
                <br />
                {stopLine(result.summary)}
              </>
            )}
          </CRNote>
        )}
        {result?.kind === 'choices' && (
          <div role="radiogroup" aria-label="Qual parada?" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>Esse código bate com mais de uma parada. Qual é?</div>
            {result.matches.map((m) => (
              <CRChoice key={m.id} icon="building" onClick={() => void submit(m)} note={m.summary.condominiumName}>
                {stopLine(m.summary)}
              </CRChoice>
            ))}
          </div>
        )}
      </div>

      <CRBig
        variant="primary"
        icon={busy ? undefined : 'check'}
        disabled={!ready || busy}
        onClick={() => void submit()}
        right={busy ? <CRSpin color="var(--color-gold)" /> : null}
      >
        {busy ? 'Conferindo…' : 'Confirmar entrega'}
      </CRBig>
    </CRSheet>
  )
}
