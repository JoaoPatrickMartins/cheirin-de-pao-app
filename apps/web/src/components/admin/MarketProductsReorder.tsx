import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '../brand/Icon'

export interface ReorderProduct {
  id: string
  name: string
  photoUrl?: string | null
  categoryId: string
  isNovidade?: boolean
  /** Promoção valendo agora — pré-requisito para entrar na seção Promoções. */
  isPromoVigente?: boolean
  promoPriority?: boolean
  promoType?: 'PERCENT' | 'FIXED' | null
  promoValue?: number | null
  isBread?: boolean
}

type Section = 'novidades' | 'promocoes' | 'catalogo'

const SECTIONS: Section[] = ['novidades', 'promocoes', 'catalogo']

const SECTION_META: Record<Section, { title: string; hint: string }> = {
  novidades: {
    title: '✦ Novidades',
    hint: 'Aparecem primeiro na vitrine, logo depois do Pão Francês.',
  },
  promocoes: {
    title: '🏷 Promoções',
    hint: 'Vêm logo depois das novidades. Só entra quem já tem desconto definido.',
  },
  catalogo: { title: 'Catálogo', hint: 'Na ordem em que o cliente vê.' },
}

/** Rótulo curto do desconto, para a linha da seção Promoções. */
function descontoLabel(p: ReorderProduct): string {
  if (!p.isPromoVigente || p.promoValue == null) return ''
  return p.promoType === 'PERCENT'
    ? `−${p.promoValue}%`
    : `−${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.promoValue)}`
}

interface MarketProductsReorderProps {
  products: ReorderProduct[]
  /** emoji da categoria, para o thumb sem foto */
  emojiOf: (categoryId: string) => string
  saving?: boolean
  error?: string | null
  onCancel: () => void
  onSave: (payload: { novidades: string[]; promocoes: string[]; catalogo: string[] }) => void
}

/**
 * MarketProductsReorder — modo "Ordenar" da lista de produtos.
 *
 * Uma lista arrastável com TRÊS seções, porque organizar a vitrine e marcar novidade são o mesmo
 * gesto: arrastar um item para "Novidades" é o que liga o selo. Por isso o salvar é um só,
 * atômico — a vitrine nunca fica com ordem nova e selo velho.
 *
 * A seção "Promoções" é diferente: ela liga o DESTAQUE, não o desconto. Desconto é decisão de
 * preço e mora no formulário, então só entra aqui quem já tem promoção valendo — e tirar de lá
 * remove o destaque sem cancelar a promoção.
 *
 * O Pão Francês fica de fora: ele tem card próprio no cliente, sempre em primeiro, e não
 * participa da grade.
 */
export function MarketProductsReorder({
  products,
  emojiOf,
  saving = false,
  error,
  onCancel,
  onSave,
}: MarketProductsReorderProps) {
  const sortable = useMemo(() => products.filter((p) => !p.isBread), [products])
  const byId = useMemo(() => new Map(sortable.map((p) => [p.id, p])), [sortable])

  const [lists, setLists] = useState<Record<Section, string[]>>(() => ({
    novidades: sortable.filter((p) => p.isNovidade).map((p) => p.id),
    // Destaque só vale com promoção vigente — uma flag sobrando de promoção vencida não
    // pode fazer o produto nascer na seção errada.
    promocoes: sortable.filter((p) => !p.isNovidade && p.promoPriority && p.isPromoVigente).map((p) => p.id),
    catalogo: sortable
      .filter((p) => !p.isNovidade && !(p.promoPriority && p.isPromoVigente))
      .map((p) => p.id),
  }))
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  /** Em qual seção mora um id — ou, quando o id É uma seção, ela mesma (drop em lista vazia). */
  const sectionOf = (id: string): Section | null => {
    if ((SECTIONS as string[]).includes(id)) return id as Section
    for (const sec of SECTIONS) {
      if (lists[sec].includes(id)) return sec
    }
    return null
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  // Mover ENTRE seções acontece no over (e não no end) para o item já aparecer no destino
  // enquanto o dedo ainda está em cima — sem isso o arraste entre seções parece não responder.
  function handleDragOver(e: DragOverEvent) {
    const activeKey = String(e.active.id)
    const overKey = e.over ? String(e.over.id) : null
    if (!overKey) return

    const from = sectionOf(activeKey)
    const to = sectionOf(overKey)
    if (!from || !to || from === to) return
    // Destacar exige desconto definido (o backend também recusa). Bloquear aqui, no `over`, é o
    // que faz a seção simplesmente não aceitar em vez de rejeitar depois de soltar.
    if (to === 'promocoes' && !byId.get(activeKey)?.isPromoVigente) return

    setLists((prev) => {
      const source = prev[from].filter((id) => id !== activeKey)
      const targetIdx = prev[to].indexOf(overKey)
      const target = [...prev[to]]
      target.splice(targetIdx >= 0 ? targetIdx : target.length, 0, activeKey)
      return { ...prev, [from]: source, [to]: target }
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const activeKey = String(e.active.id)
    const overKey = e.over ? String(e.over.id) : null
    if (!overKey) return

    const section = sectionOf(activeKey)
    if (!section || sectionOf(overKey) !== section) return

    setLists((prev) => {
      const from = prev[section].indexOf(activeKey)
      const to = prev[section].indexOf(overKey)
      if (from < 0 || to < 0 || from === to) return prev
      return { ...prev, [section]: arrayMove(prev[section], from, to) }
    })
  }

  const active = activeId ? byId.get(activeId) : null

  return (
    <div style={{ padding: '0 20px 120px' }}>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          background: 'var(--color-surface-2)',
          borderRadius: 14,
          padding: '11px 13px',
          marginBottom: 14,
        }}
      >
        <Icon name="list" size={17} color="var(--color-text-sec)" stroke={2} aria-hidden="true" />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)', margin: 0, lineHeight: 1.45 }}>
          Arraste para ordenar. Mover para <strong>Novidades</strong> liga o selo na vitrine;
          mover para <strong>Promoções</strong> destaca uma promoção que já existe — o desconto
          em si se define no produto.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {SECTIONS.map((section) => (
          <DropSection
            key={section}
            section={section}
            count={lists[section].length}
            /* Arrastando um produto sem desconto, a seção de promoções esmaece e explica. */
            blocked={section === 'promocoes' && active != null && !active.isPromoVigente}
          >
            <SortableContext items={lists[section]} strategy={verticalListSortingStrategy}>
              {lists[section].map((id) => {
                const p = byId.get(id)
                return p ? <SortableRow key={id} product={p} emoji={emojiOf(p.categoryId)} /> : null
              })}
            </SortableContext>
          </DropSection>
        ))}

        <DragOverlay>
          {active ? <RowBody product={active} emoji={emojiOf(active.categoryId)} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: '12px 2px 0' }}>
          {error}
        </p>
      )}

      {/* Barra fixa de salvar — o arraste é local até aqui, então sair sem salvar não muda nada.
          Fica acima da bottom nav do admin (fixed, 56px + safe-area), senão some atrás dela. */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(56px + env(safe-area-inset-bottom))',
          display: 'flex',
          gap: 10,
          padding: '12px 20px',
          background: 'var(--color-app-bg)',
          borderTop: '1px solid var(--color-border-2)',
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: 14,
            border: '1.5px solid var(--color-border)',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--color-text)',
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              novidades: lists.novidades,
              promocoes: lists.promocoes,
              catalogo: lists.catalogo,
            })
          }
          disabled={saving}
          style={{
            flex: 2,
            minHeight: 48,
            borderRadius: 14,
            border: 'none',
            background: 'var(--color-espresso)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            color: '#FAF5EC',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Salvando...' : 'Salvar ordem'}
        </button>
      </div>
    </div>
  )
}

/** Seção que aceita drop mesmo vazia — daí o `useDroppable` além do SortableContext. */
function DropSection({
  section,
  count,
  blocked = false,
  children,
}: {
  section: Section
  count: number
  /** O item sendo arrastado não pode entrar aqui — a seção esmaece e explica por quê. */
  blocked?: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: section, disabled: blocked })
  const meta = SECTION_META[section]
  const isNov = section === 'novidades'
  const isPromo = section === 'promocoes'

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 2px 8px' }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: isNov || isPromo ? 'var(--color-accent)' : 'var(--color-text-ter)',
          }}
        >
          {meta.title}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)' }}>
          {count}
        </span>
      </div>

      <div
        ref={setNodeRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 56,
          borderRadius: 16,
          padding: count === 0 ? '0' : undefined,
          border: isOver && !blocked ? '1.5px dashed var(--color-accent)' : '1.5px dashed transparent',
          transition: 'border-color 120ms ease, opacity 120ms ease',
          opacity: blocked ? 0.35 : 1,
        }}
      >
        {count === 0 ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              minHeight: 56,
              borderRadius: 14,
              background: 'var(--color-surface-2)',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--color-text-ter)',
              padding: '0 14px',
              textAlign: 'center',
            }}
          >
            {isNov
              ? 'Arraste um produto para cá para marcar como novidade'
              : isPromo
                ? 'Arraste para cá uma promoção que você quer destacar'
                : 'Nenhum produto'}
          </div>
        ) : (
          children
        )}
      </div>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: blocked ? 700 : 400,
          color: blocked ? 'var(--color-accent)' : 'var(--color-text-ter)',
          margin: '7px 2px 0',
        }}
      >
        {blocked ? 'Defina o desconto no produto primeiro.' : meta.hint}
      </p>
    </div>
  )
}

function SortableRow({ product, emoji }: { product: ReorderProduct; emoji: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // O original some sob o overlay durante o arraste — sem isto a linha aparece duplicada.
        opacity: isDragging ? 0 : 1,
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      <RowBody product={product} emoji={emoji} />
    </div>
  )
}

function RowBody({
  product,
  emoji,
  dragging = false,
}: {
  product: ReorderProduct
  emoji: string
  dragging?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        background: 'var(--color-surface)',
        border: `1px solid ${dragging ? 'var(--color-accent)' : 'var(--color-border-2)'}`,
        borderRadius: 14,
        padding: '9px 12px',
        boxShadow: dragging ? '0 10px 26px rgba(30,18,7,0.16)' : 'var(--shadow-soft)',
      }}
    >
      <GripDots />
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'var(--color-surface-2)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          overflow: 'hidden',
          fontSize: 19,
        }}
      >
        {product.photoUrl ? (
          <img src={product.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span>{emoji}</span>
        )}
      </div>
      <p
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {product.name}
      </p>

      {/* Promoção SEM destaque fica no Catálogo — sem esta marca, o admin não entenderia por que
          um produto em promoção está fora da seção de promoções. */}
      {product.isPromoVigente && (
        <span
          style={{
            flexShrink: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 10.5,
            fontWeight: 800,
            color: 'var(--color-accent)',
            background: 'var(--color-gold-soft, #F3DDA6)',
            padding: '2px 7px',
            borderRadius: 999,
          }}
        >
          {descontoLabel(product) || '🏷 promo'}
        </span>
      )}
    </div>
  )
}

/** Afordância de arraste — seis pontinhos, mesmo grip da divisão de entregas. */
function GripDots() {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 3px)', gap: 3, flexShrink: 0 }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} style={{ width: 3, height: 3, borderRadius: 99, background: 'var(--color-text-ter)' }} />
      ))}
    </span>
  )
}
