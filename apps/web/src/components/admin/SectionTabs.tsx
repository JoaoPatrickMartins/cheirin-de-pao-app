import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useDragScroll } from '../../hooks/useDragScroll'

interface Tab<T extends string> {
  key: T
  label: string
}

interface SectionTabsProps<T extends string> {
  tabs: Tab<T>[]
  value: T
  onChange: (v: T) => void
  /** Rótulo do `tablist` para leitores de tela (ex.: "Seções do Além do Pãozin"). */
  ariaLabel: string
}

/**
 * SectionTabs — navegação de nível 1 dos hubs do admin (as áreas da tela).
 *
 * Por que NÃO é pílula: os filtros de dentro da tela também são pílulas roláveis, e as duas
 * fileiras ficavam indistinguíveis (mesma forma, mesma borda, mesma cor de ativo, 4px de
 * diferença de altura). Aqui a aba é só texto + sublinhado dourado sobre uma hairline que
 * atravessa a tela — outra espécie visual, então o olho separa "onde eu estou" de "o que estou
 * filtrando" sem precisar ler.
 *
 * A fileira rola: sem scrollbar (`.cdp-chips`), com arraste no mouse e um fade nas bordas que
 * aparece só do lado em que há conteúdo escondido — o corte no meio de um rótulo deixa de
 * parecer defeito. A aba ativa é trazida para a área visível ao trocar (inclusive por teclado).
 */
export function SectionTabs<T extends string>({ tabs, value, onChange, ariaLabel }: SectionTabsProps<T>) {
  const { ref, handlers } = useDragScroll()
  const [fade, setFade] = useState({ left: false, right: false })

  const syncFade = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setFade({ left: el.scrollLeft > 2, right: el.scrollLeft < max - 2 })
  }, [ref])

  useLayoutEffect(() => {
    syncFade()
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(syncFade)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, syncFade])

  // Aba ativa sempre visível — trocar de seção com a fileira rolada não pode deixar o
  // sublinhado fora da tela (é o único indicador de onde o admin está).
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      inline: 'nearest',
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [ref, value])

  const edge = 'transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%'
  const mask =
    fade.left && fade.right
      ? `linear-gradient(to right, ${edge})`
      : fade.left
        ? 'linear-gradient(to right, transparent 0, #000 18px)'
        : fade.right
          ? 'linear-gradient(to right, #000 calc(100% - 18px), transparent 100%)'
          : undefined

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-2)' }}>
      <div
        ref={ref}
        {...handlers}
        onScroll={syncFade}
        role="tablist"
        aria-label={ariaLabel}
        className="cdp-chips"
        style={{
          display: 'flex',
          gap: 20,
          overflowX: 'auto',
          padding: '0 20px',
          cursor: 'grab',
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {tabs.map((t) => {
          const active = value === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-active={active}
              onClick={() => onChange(t.key)}
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '9px 0 0',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                color: active ? 'var(--color-text)' : 'var(--color-text-ter)',
                transition: 'color 0.15s ease',
              }}
            >
              {t.label}
              <span
                aria-hidden
                style={{
                  width: '100%',
                  height: 3,
                  borderRadius: '2px 2px 0 0',
                  background: active ? 'var(--color-gold)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
