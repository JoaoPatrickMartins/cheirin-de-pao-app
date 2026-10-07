import { formatUnit } from '@cheirin-de-pao/shared'
import { Icon } from '../brand/Icon'
import { CRProof, CRTag, type CRProofState } from './kit'

export interface Stop {
  orderId: string
  apartment: string
  block: string | null
  /** Complemento do bloco ("Lado A"). Aparece na parada mesmo com a lista agrupada por bloco. */
  complement?: string | null
  clientName: string
  quantity: number
  status: string
  sortKey: number
  slotId?: string
  slotLabel?: string
  // Mini market ("Além do Pãozin"): itens que acompanham a parada. `marketOrderId` só é
  // preenchido em parada SÓ-market (sem pedido de pão) — a confirmação usa rota própria.
  marketOrderId?: string
  /** Todas as Cestinhas da parada — usado para casar o cupom escaneado com a parada certa. */
  marketOrderIds?: string[]
  marketItems?: { name: string; qty: number }[]
  marketItemCount?: number
  /** Gancho enviado nesta rota (F-5, Onda 8). */
  hookToDeliver?: { id: string } | null
  /**
   * Parada SÓ de gancho (sem pão nem Cestinha no turno): o gancho é a entrega e endereça a parada.
   * `orderId` vem vazio.
   */
  hookId?: string
  /** 1ª entrega do cliente (selo ✨). */
  isFirstOrder?: boolean
  /** O cliente já tem gancho de porta. */
  hasHook?: boolean
  /** O cliente desligou os recados do entregador (E16 avisa). */
  messagesOff?: boolean
}

/** Chave estável de rastreio de uma parada (pão, só-market ou só gancho). */
export function stopKey(stop: Stop): string {
  return stop.orderId || stop.marketOrderId || stop.hookId || ''
}

interface StopRowProps {
  stop: Stop
  order: number
  isConfirmed: boolean
  isNotDelivered?: boolean
  // Mostra o turno por parada — usado quando a rota mistura manhã e tarde.
  showSlot?: boolean
  // Mostra o bloco no título — desligado quando a parada já está sob um subtítulo de bloco.
  showBlock?: boolean
  /** Estado do comprovante desta parada (foto ok, enviando, sem foto…), quando resolvida. */
  proof?: CRProofState | null
  onPress: (stop: Stop) => void
  /** E16: botão de recado (só quando o entregador tem a permissão). */
  onRecado?: (stop: Stop) => void
}

export function StopRow({ stop, order, isConfirmed, isNotDelivered = false, showSlot = false, showBlock = true, proof, onPress, onRecado }: StopRowProps) {
  const resolved = isConfirmed || isNotDelivered
  const hookOnly = !!stop.hookId
  const badges = !resolved && (hookOnly || stop.isFirstOrder || stop.hasHook || stop.hookToDeliver)
  // Recado fala da entrega do pão — fica fora da parada só de gancho.
  const recado = onRecado && !resolved && !hookOnly
  return (
    <div style={{ display: 'flex', alignItems: 'center', paddingRight: recado ? 12 : 0 }}>
      <button
        onClick={() => !resolved && onPress(stop)}
        disabled={resolved}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          minHeight: 44,
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          cursor: resolved ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Número de ordem */}
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 99,
            background: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              fontWeight: 800,
              color: 'var(--color-text-sec)',
              lineHeight: 1,
            }}
          >
            {order}
          </span>
        </div>

        {/* Checkbox / status */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            border: `2px solid ${isConfirmed ? 'var(--color-good)' : isNotDelivered ? 'var(--color-bad, #C2410C)' : 'var(--color-border)'}`,
            background: isConfirmed ? 'var(--color-good)' : isNotDelivered ? 'var(--color-bad, #C2410C)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          {isConfirmed && <Icon name="check" size={16} color="#fff" />}
          {isNotDelivered && <Icon name="x" size={16} color="#fff" />}
        </div>

        {/* Texto */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: 0,
              textDecoration: resolved ? 'line-through' : 'none',
              opacity: resolved ? 0.5 : 1,
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {/* Sob subtítulo de bloco o bloco some, mas o complemento fica: ele varia DENTRO
                do bloco e é o que diz em qual lado do prédio o entregador entra. */}
            {formatUnit(stop, {
              block: showBlock ? 'bare' : 'omit',
              apartmentSeparator: ' — ',
              emptyApartment: '',
            })}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-ter)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {stop.clientName}
          </p>
          {resolved && proof && (
            <div style={{ marginTop: 5 }}>
              <CRProof state={proof} />
            </div>
          )}
          {/* Selos da parada (E7): 1ª entrega, já tem gancho, gancho para deixar nesta rota. */}
          {badges && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {stop.isFirstOrder && (
                <CRTag emoji="✨" tone="gold" size="sm">
                  1ª entrega
                </CRTag>
              )}
              {hookOnly ? (
                <CRTag emoji="🪝" tone="dark" size="sm">
                  Só gancho
                </CRTag>
              ) : stop.hookToDeliver ? (
                <CRTag emoji="🪝" tone="dark" size="sm">
                  + entregar gancho
                </CRTag>
              ) : (
                stop.hasHook && (
                  <CRTag emoji="🪝" size="sm">
                    tem gancho
                  </CRTag>
                )
              )}
            </div>
          )}
          {/* Chips dos itens da Cestinha (Além do Pãozin) que acompanham esta parada. */}
          {stop.marketItems && stop.marketItems.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
              {stop.marketItems.map((it, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--color-espresso)',
                    background: 'var(--color-gold-soft)',
                    borderRadius: 999,
                    padding: '2px 8px',
                  }}
                >
                  {it.qty}× {it.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Turno (quando a rota mistura manhã e tarde) */}
        {showSlot && stop.slotLabel && (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-text-sec)',
              background: 'var(--color-surface-2)',
              borderRadius: 99,
              padding: '2px 8px',
              flexShrink: 0,
            }}
          >
            {stop.slotLabel}
          </span>
        )}

        {/* Quantidade — pães (ex.: 8 🥖); sem pão, a cestinha (só-market) ou o gancho (só gancho). */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 800,
            color: 'var(--color-accent)',
            marginLeft: showSlot && stop.slotLabel ? 0 : 'auto',
            flexShrink: 0,
          }}
        >
          {stop.quantity > 0 ? (
            <>
              {stop.quantity}
              <span style={{ fontSize: 15, lineHeight: 1 }} aria-hidden="true">🥖</span>
            </>
          ) : (
            <span style={{ fontSize: 15, lineHeight: 1 }} aria-hidden="true">
              {hookOnly ? '🪝' : '🧺'}
            </span>
          )}
        </span>
      </button>
      {recado && (
        <button
          type="button"
          aria-label={`Mandar recado para ${stop.clientName}`}
          onClick={() => onRecado?.(stop)}
          style={{ width: 44, height: 44, borderRadius: 13, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-accent)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="chat" size={19} stroke={2} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
