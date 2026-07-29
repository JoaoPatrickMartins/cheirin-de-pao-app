import { useRef } from 'react'
import type React from 'react'

/**
 * useDragScroll — rolagem horizontal por clicar-e-arrastar (mouse).
 *
 * Barras roláveis longas (abas de seção, chips de filtro) não têm affordance de rolagem no
 * desktop depois que a scrollbar é escondida: dá para rolar no trackpad, mas quem usa mouse
 * fica sem saída. No touch o swipe nativo já resolve, então só o mouse é sequestrado.
 *
 * O `onClickCapture` cancela o clique que borbulharia para o item depois de um arraste — sem
 * ele, arrastar a barra trocaria de aba/filtro sem querer.
 *
 * Uso: `const { ref, handlers } = useDragScroll()` → `<div ref={ref} {...handlers}>`.
 */
export function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, moved: false, startX: 0, startLeft: 0 })

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const el = ref.current
    if (!el) return
    drag.current = { down: true, moved: false, startX: e.clientX, startLeft: el.scrollLeft }
    el.style.cursor = 'grabbing'
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !drag.current.down) return
    const dx = e.clientX - drag.current.startX
    if (Math.abs(dx) > 4) drag.current.moved = true
    el.scrollLeft = drag.current.startLeft - dx
  }

  const endDrag = () => {
    drag.current.down = false
    if (ref.current) ref.current.style.cursor = 'grab'
  }

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current.moved) return
    e.stopPropagation()
    e.preventDefault()
    drag.current.moved = false
  }

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
    },
  }
}
