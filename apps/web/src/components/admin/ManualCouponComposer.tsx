import { useState } from 'react'
import type { CSSProperties } from 'react'
import { formatUnit } from '@cheirin-de-pao/shared'
import { Icon } from '../brand/Icon'
import { ManualCouponSheet, type ManualCouponData } from './coupon/ManualCoupon'
import { usePrintQueue } from './coupon/CouponShell'

/**
 * Composição de um cupom manual a partir do cadastro do cliente.
 *
 * O cabeçalho (nome, condomínio, unidade) é FIXO e sai do cadastro — é justamente o que dá
 * trabalho escrever à mão e o que não pode sair errado, porque é o endereço da porta. O admin
 * preenche só o miolo: pãezinhos, itens e uma observação livre.
 *
 * Nada é salvo: o cupom é impresso e descartado. Se um dia isso precisar de rastro, o lugar é
 * uma nota interna no cliente — não uma coleção nova.
 */

export interface ManualCouponClient {
  name: string
  condominiumName?: string | null
  block?: string | null
  complement?: string | null
  apartment?: string | null
}

interface ItemLine {
  name: string
  qty: string
}

const EMPTY_LINE: ItemLine = { name: '', qty: '1' }

function hoje(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())
}

export function ManualCouponComposer({ cliente, onClose }: { cliente: ManualCouponClient; onClose: () => void }) {
  const [quantity, setQuantity] = useState('')
  const [items, setItems] = useState<ItemLine[]>([{ ...EMPTY_LINE }])
  const [note, setNote] = useState('')
  const { queue, print } = usePrintQueue<ManualCouponData>()

  const unidade = formatUnit(
    { block: cliente.block, complement: cliente.complement, apartment: cliente.apartment },
    { block: 'compact' },
  )

  const itensPreenchidos = items.filter((it) => it.name.trim() !== '')
  // Um cupom sem nada no miolo seria só o cabeçalho — deixa imprimir mesmo assim não ajuda ninguém.
  const podeImprimir = itensPreenchidos.length > 0 || note.trim() !== '' || Number(quantity) > 0

  function updateItem(index: number, patch: Partial<ItemLine>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_LINE }])
  }

  function removeItem(index: number) {
    // Nunca fica sem linha nenhuma: sem campo visível, o admin não sabe que pode adicionar item.
    setItems((prev) => (prev.length === 1 ? [{ ...EMPTY_LINE }] : prev.filter((_, i) => i !== index)))
  }

  function imprimir() {
    if (!podeImprimir) return
    print([
      {
        clientName: cliente.name,
        condominiumName: cliente.condominiumName ?? '',
        block: cliente.block ?? '',
        complement: cliente.complement ?? '',
        apartment: cliente.apartment ?? '',
        quantity: Number(quantity) > 0 ? Number(quantity) : 0,
        items: itensPreenchidos.map((it) => ({ name: it.name.trim(), qty: Number(it.qty) || 0 })),
        note,
        dateLabel: hoje(),
      },
    ])
  }

  return (
    <>
      <ManualCouponSheet coupon={queue[0] ?? null} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Imprimir cupom manual"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-surface)',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: '20px 20px calc(24px + env(safe-area-inset-bottom))',
            width: '100%',
            maxWidth: 480,
            maxHeight: '88vh',
            overflowY: 'auto',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800,
              color: 'var(--color-text)', margin: '0 0 4px', letterSpacing: '-0.01em',
            }}
          >
            Cupom manual
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', margin: '0 0 16px', lineHeight: 1.45 }}>
            O cabeçalho sai do cadastro. Escreva o que precisa aparecer no cupom e imprima.
          </p>

          {/* Prévia do cabeçalho fixo — o que vai impresso, sem edição */}
          <div
            style={{
              border: '1px dashed var(--color-border)',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 16,
              background: 'var(--color-surface-2)',
            }}
          >
            {cliente.condominiumName && (
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                {cliente.condominiumName}
              </p>
            )}
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', margin: '2px 0 0' }}>
              {unidade}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', margin: '2px 0 0' }}>
              {cliente.name}
            </p>
          </div>

          <FieldLabel>Pãezinhos (opcional)</FieldLabel>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Deixe vazio se o cupom não leva pão"
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <FieldLabel>Itens</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={it.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                  placeholder="Descrição"
                  aria-label={`Descrição do item ${i + 1}`}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  value={it.qty}
                  onChange={(e) => updateItem(i, { qty: e.target.value.replace(/\D/g, '') })}
                  inputMode="numeric"
                  aria-label={`Quantidade do item ${i + 1}`}
                  style={{ ...inputStyle, width: 64, textAlign: 'center' }}
                />
                <button
                  onClick={() => removeItem(i)}
                  aria-label={`Remover item ${i + 1}`}
                  style={{
                    width: 40, height: 40, flexShrink: 0, borderRadius: 12,
                    border: '1.5px solid var(--color-border)', background: 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name="x" size={16} stroke={2} color="var(--color-text-ter)" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addItem}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
              padding: '8px 14px', borderRadius: 999, minHeight: 40,
              border: '1.5px solid var(--color-border)', background: 'transparent',
              fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700,
              color: 'var(--color-text)', cursor: 'pointer',
            }}
          >
            <Icon name="plus" size={15} stroke={2.2} color="var(--color-text-sec)" />
            Adicionar item
          </button>

          <FieldLabel>Observação</FieldLabel>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Escreva o que deve sair impresso no cupom"
            style={{ ...inputStyle, resize: 'vertical', marginBottom: 20, lineHeight: 1.45 }}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, minHeight: 46, borderRadius: 999,
                border: '1.5px solid var(--color-border)', background: 'none',
                fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
                color: 'var(--color-text)', cursor: 'pointer',
              }}
            >
              Fechar
            </button>
            <button
              onClick={imprimir}
              disabled={!podeImprimir}
              style={{
                flex: 1, minHeight: 46, borderRadius: 999, border: 'none',
                background: 'var(--color-espresso)', color: '#fff',
                fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
                cursor: podeImprimir ? 'pointer' : 'default',
                opacity: podeImprimir ? 1 : 0.5,
              }}
            >
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--color-text-ter)', margin: '0 0 7px',
      }}
    >
      {children}
    </p>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 12,
  border: '1.5px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  padding: '10px 12px',
  fontFamily: 'var(--font-body)',
  fontSize: 14.5,
  color: 'var(--color-text)',
  outline: 'none',
}
