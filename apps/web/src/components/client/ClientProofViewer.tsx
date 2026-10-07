import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../brand/Icon'
import { CRIconBtn, CRSpin, CR_BODY } from '../courier/kit'
import { PhotoViewer } from '../PhotoViewer'
import { useAuth } from '../../hooks/useAuth'
import { fetchClientProof, type ClientProofPhoto } from '../../lib/clientProof'
import { supportWhatsappUrl } from '../../lib/support'

const TZ = 'America/Sao_Paulo'

/** "Hoje, 06:12" · "Ontem, 06:12" · "Sex, 26 set, 06:12" (horário de Brasília). */
export function proofWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: TZ })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (day(d) === day(now)) return `Hoje, ${time}`
  if (day(d) === day(yesterday)) return `Ontem, ${time}`
  const label = d
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: TZ })
    .replace(/\./g, '')
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}, ${time}`
}

/**
 * C2 · Foto da entrega para o cliente, em tela cheia. Busca a URL assinada ao abrir (e de novo
 * se ela vencer). Rodapé: "Algo errado? Fale com o suporte".
 */
export function ClientProofViewer({
  kind,
  id,
  failureText,
  onClose,
}: {
  kind: 'bread' | 'market'
  id: string
  /** Motivo da não entrega na linguagem do cliente ("não conseguimos acesso pela portaria"). */
  failureText?: string | null
  onClose: () => void
}) {
  const { user } = useAuth()
  const [photo, setPhoto] = useState<ClientProofPhoto | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'none'>('loading')

  const load = useCallback(async () => {
    setState('loading')
    const p = await fetchClientProof(kind, id)
    setPhoto(p)
    setState(p ? 'ready' : 'none')
  }, [kind, id])

  useEffect(() => {
    void load()
  }, [load])

  if (state === 'ready' && photo) {
    const delivered = photo.outcome === 'DELIVERED'
    const unit = [user?.condominiumName, user?.apartment ? `Apto ${user.apartment}` : null].filter(Boolean).join(' · ')
    const detail = delivered ? unit : failureText
    return (
      <PhotoViewer
        url={photo.url}
        title={delivered ? 'Seu pãozin chegou' : 'Tentamos entregar'}
        meta={[proofWhen(photo.at), detail].filter(Boolean).join(' · ')}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            Algo errado?{' '}
            <a
              href={supportWhatsappUrl('Olá! Tenho uma dúvida sobre a foto da minha entrega.')}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-gold)', fontWeight: 800, textDecoration: 'underline' }}
            >
              Fale com o suporte
            </a>
          </div>
        }
        onClose={onClose}
        onExpired={() => void load()}
      />
    )
  }

  // Carregando ou sem foto: o mesmo fundo escuro, para a troca não piscar.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto da entrega"
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#070402', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: CR_BODY }}
    >
      <div style={{ padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 12px' }}>
        <CRIconBtn icon="x" tone="dark" label="Fechar" onClick={onClose} />
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        {state === 'loading' ? (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
            <CRSpin color="var(--color-gold)" />
            Carregando a foto…
          </div>
        ) : (
          <div>
            <Icon name="camera" size={30} color="rgba(255,255,255,0.7)" aria-hidden="true" />
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 10 }}>A foto não está disponível</div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 1.45 }}>
              O comprovante fica disponível por 90 dias.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Botão de câmera do histórico ("Ver foto") ou o selo "foto expirada". */
export function ProofHistoryBadge({ proof, onView }: { proof?: { available: boolean; expired: boolean } | null; onView: () => void }) {
  if (!proof) return null
  if (proof.expired) {
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999, background: 'var(--color-surface-2)', color: 'var(--color-text-sec)', fontFamily: CR_BODY, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}
      >
        <Icon name="camera" size={11} stroke={2.6} aria-hidden="true" />
        foto expirada
      </span>
    )
  }
  if (!proof.available) return null
  return (
    <button
      type="button"
      onClick={onView}
      aria-label="Ver foto"
      style={{ width: 44, height: 44, borderRadius: 13, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-accent)', display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer' }}
    >
      <Icon name="camera" size={19} aria-hidden="true" />
    </button>
  )
}

/**
 * C2 · Bloco "Comprovante" do acompanhamento: miniatura da foto + "Entregue às 06:12" /
 * "Tentamos entregar às 05:52". Sem foto para mostrar, não aparece.
 */
export function ProofCard({ kind, id, onOpen }: { kind: 'bread' | 'market'; id: string; onOpen: () => void }) {
  const [photo, setPhoto] = useState<ClientProofPhoto | null>(null)

  useEffect(() => {
    let alive = true
    void fetchClientProof(kind, id).then((p) => {
      if (alive) setPhoto(p)
    })
    return () => {
      alive = false
    }
  }, [kind, id])

  if (!photo) return null
  const delivered = photo.outcome === 'DELIVERED'
  const time = new Date(photo.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: CR_BODY, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)', textTransform: 'uppercase', margin: '0 4px 8px' }}>
        Comprovante
      </div>
      <button
        type="button"
        onClick={onOpen}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-card)', textAlign: 'left', cursor: 'pointer', fontFamily: CR_BODY }}
      >
        <span style={{ position: 'relative', width: 76, height: 76, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: 'var(--color-surface-2)' }}>
          <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <span style={{ position: 'absolute', right: 5, bottom: 5, width: 24, height: 24, borderRadius: 8, background: 'rgba(30,18,7,0.7)', display: 'grid', placeItems: 'center' }}>
            <Icon name="search" size={13} color="#fff" stroke={2.4} aria-hidden="true" />
          </span>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>
            {delivered ? `Entregue às ${time}` : `Tentamos entregar às ${time}`}
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 2 }}>
            {delivered ? 'Foto da porta · toque para ver' : 'Foto da portaria · toque para ver'}
          </span>
        </span>
        <Icon name="chevR" size={17} color="var(--color-text-ter)" aria-hidden="true" />
      </button>
    </div>
  )
}
