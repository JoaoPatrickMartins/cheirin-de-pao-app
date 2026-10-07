import { useState } from 'react'
import { FAILURE_LABELS, PROOF_RETENTION_DAYS, type FailureCode } from '@cheirin-de-pao/shared'
import { Icon } from '../brand/Icon'
import { CRLabel, CRNote, CRTag, CR_BODY } from '../courier/kit'
import { PhotoViewer } from '../PhotoViewer'
import { brtTime } from '../../lib/courierApi'

/** Comprovante no detalhe do pedido (`GET /admin/orders/:id`). A foto vem por URL assinada. */
export interface ProofDetail {
  /** PENDING (foto ainda subindo) | OK | NONE (exceção, com `note`) | SKIPPED (opcional, pulou). */
  status: string
  outcome: string
  required: boolean
  photoUrl: string | null
  photoAt: string | null
  note: string | null
  confirmedVia: string | null
  expired: boolean
  clientVisible?: boolean
}

const VIA_LABEL: Record<string, string> = { SCAN: 'pelo scan', CODE: 'pelo código', LIST: 'pela lista' }

/** Depois disso, "subindo" vira "não chegou" — o celular do entregador não mandou mais. */
const STALE_PENDING_MS = 2 * 60 * 60 * 1000

/** "Antônio Ribeiro" → "Antônio R." */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? ''
}

/** "Portaria não liberou — Porteiro não atendeu" → ["Portaria não liberou", "Porteiro não atendeu"]. */
function splitFailure(code: string | null, reason: string): [string, string | null] {
  const label = code && code in FAILURE_LABELS ? FAILURE_LABELS[code as FailureCode] : null
  if (label && reason.startsWith(`${label} — `)) return [label, reason.slice(label.length + 3)]
  if (label && (reason === label || !reason)) return [label, null]
  return [reason || label || 'Não entregue', null]
}

function untilLabel(photoAt: string): string {
  const d = new Date(new Date(photoAt).getTime() + PROOF_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
}

/**
 * A1 · Seção "Comprovante": foto, sem foto (exceção com motivo), pulada, subindo e não entrega
 * (com ou sem foto da porta). A foto abre em tela cheia.
 */
export function OrderProof({
  proof,
  delivered,
  at,
  courierName,
  failureCode,
  failureReason,
  place,
  onRefresh,
}: {
  proof: ProofDetail
  /** Desfecho do pedido: entregue (true) ou não entregue (false). */
  delivered: boolean
  /** deliveredAt / failedAt (ISO). */
  at: string | null
  courierName: string
  failureCode: string | null
  failureReason: string
  /** "Apto 101 · Bloco 1" — título do visualizador. */
  place: string
  /** Pede o detalhe de novo (URL assinada vencida). */
  onRefresh?: () => void
}) {
  const [viewing, setViewing] = useState(false)
  const time = brtTime(at)
  const who = courierName ? shortName(courierName) : 'O entregador'
  const via = proof.confirmedVia ? VIA_LABEL[proof.confirmedVia] : null
  const outcomeTag = delivered ? (
    <CRTag icon="check" tone="good">{time ? `Entregue ${time}` : 'Entregue'}</CRTag>
  ) : (
    <CRTag icon="x" tone="danger">{time ? `Não entregue ${time}` : 'Não entregue'}</CRTag>
  )
  const [failLabel, failText] = delivered ? [null, null] : splitFailure(failureCode, failureReason)
  const failure = !delivered && (
    <>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginTop: 8 }}>{failLabel}</div>
      {failText && <div style={{ fontSize: 13, color: 'var(--color-text-sec)', marginTop: 2, lineHeight: 1.4 }}>“{failText}”</div>}
    </>
  )
  const stale = proof.status === 'PENDING' && !!at && Date.now() - new Date(at).getTime() > STALE_PENDING_MS

  let body
  if (proof.status === 'OK' && proof.photoUrl) {
    body = (
      <div style={{ display: 'flex', gap: 12, alignItems: delivered ? 'center' : 'flex-start' }}>
        <button
          type="button"
          onClick={() => setViewing(true)}
          aria-label="Ver a foto em tela cheia"
          style={{ width: 96, height: 96, borderRadius: 14, overflow: 'hidden', border: 'none', padding: 0, flexShrink: 0, background: 'var(--color-surface-2)', cursor: 'pointer' }}
        >
          <img src={proof.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {outcomeTag}
          {delivered ? (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', fontWeight: 600, marginTop: 6 }}>
                por {who}
                {via ? ` · ${via}` : ''}
              </div>
              <button
                type="button"
                onClick={() => setViewing(true)}
                style={{ marginTop: 8, height: 36, padding: '0 12px', borderRadius: 11, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', fontWeight: 800, fontSize: 13, fontFamily: CR_BODY, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              >
                <Icon name="search" size={14} aria-hidden="true" />
                Ver em tela cheia
              </button>
            </>
          ) : (
            failure
          )}
        </div>
      </div>
    )
  } else if (proof.status === 'PENDING') {
    body = (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 96, height: 96, borderRadius: 14, background: 'var(--color-surface-2)', display: 'grid', placeItems: 'center', color: stale ? 'var(--color-amber-ink)' : 'var(--color-accent)', flexShrink: 0 }}>
          <Icon name={stale ? 'cloudOff' : 'cloudUp'} size={30} aria-hidden="true" />
        </div>
        <div style={{ flex: 1 }}>
          {outcomeTag}
          {failure}
          <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', marginTop: 8, lineHeight: 1.4 }}>
            {stale
              ? 'A foto não chegou do celular do entregador.'
              : 'A foto ainda está subindo do celular do entregador. Aparece aqui sozinha.'}
          </div>
        </div>
      </div>
    )
  } else {
    // NONE (exceção da obrigatória), SKIPPED (opcional) ou foto que não pode mais ser mostrada.
    const tag =
      proof.status === 'NONE' ? (
        <CRTag icon="ban" tone="danger">sem foto</CRTag>
      ) : proof.status === 'SKIPPED' ? (
        <CRTag icon="ban">foto pulada</CRTag>
      ) : (
        <CRTag icon="camera">{proof.expired ? 'foto apagada' : 'foto indisponível'}</CRTag>
      )
    body = (
      <div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {outcomeTag}
          {tag}
        </div>
        {failure}
        {proof.status === 'NONE' && (
          <>
            <div style={{ fontSize: 13.5, color: 'var(--color-text)', marginTop: 8 }}>
              <span style={{ color: 'var(--color-text-sec)' }}>Motivo da exceção:</span> <b>{proof.note || '—'}</b>
            </div>
            {proof.required && (
              <div style={{ fontSize: 12.5, color: 'var(--color-text-ter)', marginTop: 2 }}>
                {who} tem foto obrigatória {delivered ? 'na entrega' : 'na não entrega'}.
              </div>
            )}
          </>
        )}
        {proof.status === 'SKIPPED' && (
          <div style={{ fontSize: 13, color: 'var(--color-text-sec)', marginTop: 8 }}>
            {who} não tem foto obrigatória e escolheu pular.
          </div>
        )}
        {proof.status === 'OK' && (
          <CRNote icon="camera" style={{ marginTop: 10 }}>
            {proof.expired
              ? `A foto fica guardada por ${PROOF_RETENTION_DAYS} dias e já foi apagada.`
              : 'O armazenamento das fotos está fora do ar. Tente de novo mais tarde.'}
          </CRNote>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <CRLabel
        right={
          proof.clientVisible === undefined ? undefined : (
            <span style={{ fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 600 }}>{proof.clientVisible ? 'cliente vê' : 'só admin'}</span>
          )
        }
      >
        Comprovante
      </CRLabel>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: 14, fontFamily: CR_BODY }}>{body}</div>
      {viewing && proof.photoUrl && (
        <PhotoViewer
          url={proof.photoUrl}
          title={place}
          meta={[delivered ? (time ? `Entregue às ${time}` : 'Entregue') : time ? `Não entregue às ${time}` : 'Não entregue', courierName ? shortName(courierName) : null].filter(Boolean).join(' · ')}
          footer={
            proof.photoAt ? (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                Guardada por {PROOF_RETENTION_DAYS} dias · até {untilLabel(proof.photoAt)}
              </div>
            ) : undefined
          }
          onClose={() => setViewing(false)}
          onExpired={onRefresh}
        />
      )}
    </div>
  )
}
