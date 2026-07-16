// Carrossel do banner de entrega da Home. Mockamos framer-motion (jsdom não roda
// animações) para testar a ORQUESTRAÇÃO: qual slide aparece, o timing distinto
// (corte 5s → entrega 10s → loop) e o caso sem entrega (só corte, sem rotação).
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import type { TodayOrder } from '../../../hooks/useOrderTracking'
import type { CutoffSlot } from '../../../hooks/useCutoffStatus'

// framer-motion → elementos DOM simples; AnimatePresence só monta o filho atual
// (sem animação de saída), então o slide anterior desmonta na troca de key.
const FRAMER_ONLY = new Set([
  'variants', 'initial', 'animate', 'exit', 'whileTap', 'whileHover', 'whileFocus',
  'whileInView', 'transition', 'custom', 'layout', 'layoutId', 'drag',
])
vi.mock('framer-motion', async () => {
  const React = await import('react')
  const make = (tag: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.forwardRef((props: any, ref: any) => {
      const clean: Record<string, unknown> = {}
      for (const k of Object.keys(props)) if (!FRAMER_ONLY.has(k)) clean[k] = props[k]
      return React.createElement(tag, { ...clean, ref })
    })
  const motion = new Proxy({}, { get: (_t, tag: string) => make(tag) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Frag = ({ children }: any) => React.createElement(React.Fragment, null, children)
  return { motion, AnimatePresence: Frag, MotionConfig: Frag }
})

import { DeliveryBannerCarousel, formatSlotTime } from '../DeliveryBannerCarousel'

const SLIDE_MS_CORTE = 5000
const SLIDE_MS_ENTREGA = 10000

const SLOTS: CutoffSlot[] = [
  { slotId: 'manha', name: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', cutoffTime: '22:00', locked: false, deliveryWhen: 'amanhã' },
  { slotId: 'tarde', name: 'tarde', label: 'Tarde', emoji: '🌙', time: '15:30', cutoffTime: '10:00', locked: true, deliveryWhen: 'hoje' },
]

const ORDER: TodayOrder = {
  id: 'o1',
  status: 'OUT_FOR_DELIVERY',
  quantity: 4,
  scheduledDate: '2026-07-15',
  deliveryTime: '07:15',
}

function renderCarousel(props: Partial<Parameters<typeof DeliveryBannerCarousel>[0]> = {}) {
  const onOpenDelivery = vi.fn()
  const onOpenCutoff = vi.fn()
  render(
    <DeliveryBannerCarousel
      order={ORDER}
      isToday
      slots={SLOTS}
      onOpenDelivery={onOpenDelivery}
      onOpenCutoff={onOpenCutoff}
      {...props}
    />,
  )
  return { onOpenDelivery, onOpenCutoff }
}

describe('DeliveryBannerCarousel', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('formatSlotTime: hora cheia vira "Nh", com minutos mantém "H:MM"', () => {
    expect(formatSlotTime('22:00')).toBe('22h')
    expect(formatSlotTime('10:00')).toBe('10h')
    expect(formatSlotTime('06:30')).toBe('6:30')
    expect(formatSlotTime('15:30')).toBe('15:30')
  })

  it('com entrega + slots: começa no CORTE e alterna corte(5s) → entrega(10s) → corte', () => {
    renderCarousel()

    // Cabeçalho fixo (contexto da entrega)
    expect(screen.getByText('SAINDO DO FORNO')).toBeInTheDocument()
    expect(screen.getByText('Entrega de hoje · 4 pães')).toBeInTheDocument()

    // Slide inicial = CORTE
    expect(screen.getByText('CORTE')).toBeInTheDocument()
    expect(screen.getByText(/Peça até o horário de corte/)).toBeInTheDocument()
    expect(screen.queryByText(/Sai quentinho do forno/)).not.toBeInTheDocument()

    // Após 5s → ENTREGA
    act(() => vi.advanceTimersByTime(SLIDE_MS_CORTE))
    expect(screen.getByText(/Sai quentinho do forno/)).toBeInTheDocument()
    expect(screen.getByText('A caminho')).toBeInTheDocument()
    expect(screen.queryByText('CORTE')).not.toBeInTheDocument()

    // Após +10s → volta ao CORTE
    act(() => vi.advanceTimersByTime(SLIDE_MS_ENTREGA))
    expect(screen.getByText('CORTE')).toBeInTheDocument()
    expect(screen.queryByText(/Sai quentinho do forno/)).not.toBeInTheDocument()
  })

  it('slide de corte não troca antes dos 5s (tempo distinto do de entrega)', () => {
    renderCarousel()
    act(() => vi.advanceTimersByTime(SLIDE_MS_CORTE - 500))
    expect(screen.getByText('CORTE')).toBeInTheDocument()
    expect(screen.queryByText(/Sai quentinho do forno/)).not.toBeInTheDocument()
  })

  it('sem entrega agendada: mostra SÓ o slide de corte, sem dots e sem rotação', () => {
    renderCarousel({ order: null })

    expect(screen.getByText('FIQUE DE OLHO NO CORTE')).toBeInTheDocument()
    expect(screen.getByText('Garanta sua próxima fornada')).toBeInTheDocument()
    expect(screen.getByText('CORTE')).toBeInTheDocument()

    // Sem dots (1 slide só)
    expect(screen.queryByLabelText('Ver entrega')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ver horários de corte')).not.toBeInTheDocument()

    // Não rotaciona mesmo depois de muito tempo
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByText('CORTE')).toBeInTheDocument()
    expect(screen.queryByText(/Sai quentinho do forno/)).not.toBeInTheDocument()
  })

  it('dots trocam de slide manualmente (sem navegar)', () => {
    const { onOpenDelivery, onOpenCutoff } = renderCarousel()
    fireEvent.click(screen.getByLabelText('Ver entrega'))
    expect(screen.getByText(/Sai quentinho do forno/)).toBeInTheDocument()
    // clicar no dot não dispara a navegação do card
    expect(onOpenDelivery).not.toHaveBeenCalled()
    expect(onOpenCutoff).not.toHaveBeenCalled()
  })

  it('tap no card navega conforme o slide ativo (corte → avulso, entrega → rastreio)', () => {
    const { onOpenDelivery, onOpenCutoff } = renderCarousel()
    // Ativo = corte
    fireEvent.click(screen.getByLabelText('Entrega e horários de corte'))
    expect(onOpenCutoff).toHaveBeenCalledTimes(1)
    expect(onOpenDelivery).not.toHaveBeenCalled()

    // Vai para entrega e toca de novo
    act(() => vi.advanceTimersByTime(SLIDE_MS_CORTE))
    fireEvent.click(screen.getByLabelText('Entrega e horários de corte'))
    expect(onOpenDelivery).toHaveBeenCalledTimes(1)
  })
})
