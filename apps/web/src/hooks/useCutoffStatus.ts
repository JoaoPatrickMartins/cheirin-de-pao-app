import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'

/**
 * Slot de corte do condomínio do cliente (GET /settings/cutoff-status).
 * `locked`: o corte da PRÓXIMA ocorrência daquele slot já passou (não dá mais p/ pedir nela).
 * `deliveryWhen`: "hoje" | "amanhã" — quando é a próxima entrega desse slot.
 */
export interface CutoffSlot {
  slotId: string
  name: string
  label: string
  emoji: string
  time: string
  cutoffTime: string
  locked: boolean
  deliveryWhen: string
}

/**
 * useCutoffStatus — status de corte por slot do condomínio do cliente.
 *
 * Alimenta o slide "Corte" do carrossel da Home. O estado (`locked`) muda ao cruzar
 * os horários de corte (ex.: 22:00 / 10:00), então revalida a cada 60s.
 */
export function useCutoffStatus(): { slots: CutoffSlot[]; isLoading: boolean } {
  const [slots, setSlots] = useState<CutoffSlot[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchStatus = async () => {
      try {
        const res = await apiFetch('/settings/cutoff-status')
        if (res.ok) {
          const data = (await res.json()) as { slots?: CutoffSlot[] }
          if (active) setSlots(data.slots ?? [])
        }
      } catch {
        // mantém o estado anterior em falha de rede
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void fetchStatus()
    const id = setInterval(() => { void fetchStatus() }, 60_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  return { slots, isLoading }
}
