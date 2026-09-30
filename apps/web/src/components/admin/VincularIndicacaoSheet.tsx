import { useEffect, useRef, useState } from 'react'
import { normalizeReferralCode } from '@cheirin-de-pao/shared'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'
import { RF_BODY } from '../client/referral/RefPrimitives'
import { RaBtn, RaInline, RaSheet, RaSheetTitle, RaSpinner, firstNameOf } from './referral/RaKit'

interface CodeCheck {
  valid: boolean
  self: boolean
  owner: { name: string; condo: string | null } | null
}

type Outcome = 'PENDING' | 'ON_HOLD' | 'REWARDED' | 'EXPIRED' | 'NONE'

/** Código com cara de completo (prefixo + 4) — antes disso não vale conferir. */
const MIN_CODE_LENGTH = 5

/**
 * Sheet "Vincular indicação" (handoff `RALinkSheet`) — para quem esqueceu o código no cadastro.
 * Confere o código enquanto o admin digita e só libera o Confirmar com um código válido. Uma vez
 * só: depois de vincular, a linha "Indicação de" toma o lugar da ação.
 *
 * Os textos não usam artigo antes do nome ("se a Maria…"): o sistema não sabe o gênero de ninguém
 * (V-7, V-13, V-18).
 */
export function VincularIndicacaoSheet({
  clientId,
  clientName,
  onClose,
  onLinked,
}: {
  clientId: string
  clientName: string
  onClose: () => void
  /** Vinculou — o detalhe recarrega a linha "Indicação de" e o card. */
  onLinked: () => void
}) {
  const [code, setCode] = useState('')
  const [check, setCheck] = useState<CodeCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [linking, setLinking] = useState(false)
  const [done, setDone] = useState<{ outcome: Outcome; referrer: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const name = firstNameOf(clientName) || 'O cliente'
  const normalized = normalizeReferralCode(code)

  // Confere com espera curta enquanto digita; a resposta velha (código já trocado) é descartada.
  useEffect(() => {
    setCheck(null)
    setError(null)
    if (normalized.length < MIN_CODE_LENGTH) return
    const mine = ++seq.current
    const t = setTimeout(() => {
      setChecking(true)
      void (async () => {
        try {
          const res = await apiFetch(`/admin/clients/${clientId}/referral-code-check?code=${encodeURIComponent(normalized)}`)
          if (!res.ok) throw new Error('falha')
          const data = (await res.json()) as CodeCheck
          if (mine === seq.current) setCheck(data)
        } catch {
          if (mine === seq.current) setError('Não conseguimos conferir o código. Tente de novo.')
        } finally {
          if (mine === seq.current) setChecking(false)
        }
      })()
    }, 400)
    return () => clearTimeout(t)
  }, [normalized, clientId])

  const confirm = async () => {
    if (!check?.valid || linking) return
    setLinking(true)
    setError(null)
    try {
      const res = await apiFetch(`/admin/clients/${clientId}/referral`, {
        method: 'POST',
        body: JSON.stringify({ code: normalized }),
      })
      const body = (await res.json().catch(() => null)) as
        | { error?: string; outcome?: Outcome; referredBy?: { name: string } }
        | null
      if (!res.ok) {
        setError(body?.error ?? 'Não foi possível vincular. Tente novamente.')
        return
      }
      setDone({ outcome: body?.outcome ?? 'PENDING', referrer: body?.referredBy?.name ?? check.owner?.name ?? '' })
      onLinked()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLinking(false)
    }
  }

  const titleId = 'ref-link-title'
  const invalid = check && !check.valid

  return (
    <RaSheet labelledBy={titleId} onClose={onClose} busy={linking}>
      <RaSheetTitle id={titleId}>Vincular indicação</RaSheetTitle>
      <div style={{ fontFamily: RF_BODY, fontSize: 13, color: 'var(--color-text-sec)', marginTop: -8, lineHeight: 1.45 }}>
        Para quem esqueceu de usar o código no cadastro. Só dá para vincular uma vez.
      </div>

      <label style={{ display: 'block' }}>
        <div style={{ fontFamily: RF_BODY, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7, letterSpacing: '0.01em' }}>
          Código de quem indicou
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--color-surface-alt)',
            border: `1.5px solid ${invalid ? 'var(--color-warn)' : check?.valid ? 'var(--color-good)' : 'var(--color-border)'}`,
            borderRadius: 14,
            padding: '12px 14px',
          }}
        >
          <Icon name="ticket" size={18} color="var(--color-text-ter)" stroke={2} />
          <input
            value={code}
            disabled={!!done}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            aria-invalid={!!invalid}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'var(--color-text)',
              fontFamily: RF_BODY,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          />
          {checking && <RaSpinner color="var(--color-accent)" />}
        </div>
      </label>

      <div aria-live="polite" style={{ display: 'contents' }}>
        {!done && check?.valid && check.owner && (
          <RaInline tone="gold">
            Código de <b>{check.owner.name}</b>
            {check.owner.condo ? ` (${check.owner.condo})` : ''}. Ao confirmar, a indicação entra como "Aguardando 1º pedido" — ou é
            recompensada na hora, se {name} já recebeu a 1ª entrega.
          </RaInline>
        )}
        {!done && invalid && !check.self && <RaInline>Código não encontrado. Confira as letras com o cliente.</RaInline>}
        {!done && invalid && check.self && <RaInline>Esse é o código de {name}. Ninguém pode indicar a si mesmo.</RaInline>}
        {error && <RaInline>{error}</RaInline>}
        {done && (
          <RaInline tone="good">
            Vinculado! Agora {name} aparece com a indicação de {done.referrer}.
            {done.outcome === 'REWARDED' && ' A recompensa já foi creditada.'}
            {done.outcome === 'ON_HOLD' && ' A indicação foi para análise.'}
          </RaInline>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <RaBtn full variant="soft" disabled={linking} onClick={onClose}>
          {done ? 'Fechar' : 'Cancelar'}
        </RaBtn>
        {!done && (
          <RaBtn full icon={linking ? undefined : 'check'} disabled={!check?.valid || linking} onClick={() => void confirm()}>
            {linking ? <RaSpinner /> : null}
            Confirmar
          </RaBtn>
        )}
      </div>
    </RaSheet>
  )
}
