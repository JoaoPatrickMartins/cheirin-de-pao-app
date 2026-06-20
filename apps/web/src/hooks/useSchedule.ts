/**
 * useSchedule — hook de estado da agenda semanal
 *
 * Carrega GET /schedules/me na montagem e expõe métodos para salvar via PUT /schedules/me.
 * Deriva consumoSemanal, cobre e falta como valores calculados (não estado) a cada render.
 *
 * Requirements: SCHED-02, SCHED-04, SCHED-06, MSCHED-01, MSCHED-03
 * Threat model: T-04-05-02 — useEffect com dependência vazia [] para evitar loop infinito
 */
import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'

export interface WeeklyQty {
  seg: number
  ter: number
  qua: number
  qui: number
  sex: number
  sab: number
  dom: number
}

// D-11: redeclarado aqui para não criar dependência circular com DeliveryTimeChips
interface DeliverySlot {
  name: string    // 'manha' | 'tarde'
  time: string    // 'HH:MM'
  isActive: boolean
}

interface ScheduleApiResponse {
  id?: string
  weeklyQty?: WeeklyQty
  deliveryTime?: string
  notifyReconfigure?: boolean
  days?: Record<string, WeeklyQty> | null  // MSCHED-01: formato multi-slot
}

const DEFAULT_WEEKLY_QTY: WeeklyQty = {
  seg: 0,
  ter: 0,
  qua: 0,
  qui: 0,
  sex: 0,
  sab: 0,
  dom: 0,
}

export interface UseScheduleReturn {
  schedule: ScheduleApiResponse | null
  weeklyQty: WeeklyQty
  deliveryTime: string
  notifyReconfigure: boolean
  setWeeklyQty: (qty: WeeklyQty) => void
  setDeliveryTime: (time: string) => void
  setNotifyReconfigure: (v: boolean) => void
  days: Record<string, WeeklyQty>           // MSCHED-01
  setDays: (d: Record<string, WeeklyQty>) => void  // MSCHED-01
  saveSchedule: (activeSlots: DeliverySlot[]) => Promise<{ ok: boolean; error?: string }>  // D-12
  isLoading: boolean
  isSaving: boolean
  consumoSemanal: number
  cobre: number
  falta: boolean
}

export function useSchedule(creditBalance: number = 0): UseScheduleReturn {
  const [schedule, setSchedule] = useState<ScheduleApiResponse | null>(null)
  const [weeklyQty, setWeeklyQty] = useState<WeeklyQty>(DEFAULT_WEEKLY_QTY)
  const [deliveryTime, setDeliveryTime] = useState<string>('07:00')
  const [notifyReconfigure, setNotifyReconfigure] = useState<boolean>(false)
  const [days, setDays] = useState<Record<string, WeeklyQty>>({})  // D-11
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // Carregar schedule na montagem — dependência vazia para evitar loop (T-04-05-02)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/schedules/me')
        if (res.ok) {
          const data = (await res.json()) as ScheduleApiResponse
          setSchedule(data)
          if (data.weeklyQty) setWeeklyQty(data.weeklyQty)
          if (data.deliveryTime) setDeliveryTime(data.deliveryTime)
          if (typeof data.notifyReconfigure === 'boolean') {
            setNotifyReconfigure(data.notifyReconfigure)
          }
          // D-11: inicializar days a partir do backend quando disponível
          if (data.days) setDays(data.days as Record<string, WeeklyQty>)
        }
        // 404 (sem schedule) mantém os defaults zerados
      } catch {
        // falha de rede — inicia com estado padrão zerado
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, []) // dependência vazia — executa apenas na montagem

  // Valores calculados a cada render (D-03)
  // D-09 client-side: consumoSemanal soma todos os slots em modo multi-slot
  const consumoSemanal =
    Object.keys(days).length > 0
      ? Object.values(days)
          .flatMap((wq) => Object.values(wq))
          .reduce((a, b) => a + b, 0)
      : Object.values(weeklyQty).reduce((a, b) => a + b, 0)

  // cobre = Math.floor(saldo / consumoSemanal) — evita divisão por zero com (|| 1)
  const cobre = Math.floor(creditBalance / (consumoSemanal || 1))

  // falta = true quando semana > saldo
  const falta = consumoSemanal > creditBalance

  // D-12: assinatura muda para receber activeSlots e determinar modo (multi vs legado)
  const saveSchedule = async (activeSlots: DeliverySlot[]): Promise<{ ok: boolean; error?: string }> => {
    setIsSaving(true)
    try {
      const isMulti = activeSlots.filter((s) => s.isActive).length >= 2
      const body = isMulti
        ? { days, notifyReconfigure }
        : { weeklyQty, deliveryTime, notifyReconfigure }

      const res = await apiFetch('/schedules/me', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const updated = (await res.json()) as ScheduleApiResponse
        setSchedule(updated)
        return { ok: true }
      } else {
        const err = (await res.json()) as { error?: string }
        return { ok: false, error: err.error ?? 'Não conseguimos salvar. Tente novamente.' }
      }
    } catch {
      return { ok: false, error: 'Algo deu errado. Verifique sua conexão.' }
    } finally {
      setIsSaving(false)
    }
  }

  return {
    schedule,
    weeklyQty,
    deliveryTime,
    notifyReconfigure,
    setWeeklyQty,
    setDeliveryTime,
    setNotifyReconfigure,
    days,
    setDays,
    saveSchedule,
    isLoading,
    isSaving,
    consumoSemanal,
    cobre,
    falta,
  }
}
