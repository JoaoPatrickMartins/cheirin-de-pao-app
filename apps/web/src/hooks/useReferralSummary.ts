import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'
import type { ReferralSummary } from '../lib/referral'
import { useAuth } from './useAuth'

/**
 * Resumo do Indique e Ganhe (`GET /referrals/summary`) compartilhado entre Perfil, Home, extrato e
 * a comemoração da abertura.
 *
 * Cache de MÓDULO por usuário: as quatro entradas montam juntas na abertura, e sem isto seriam
 * quatro chamadas iguais. Fica fresco por 30 s — o suficiente para a abertura, curto para o
 * card da Home refletir uma entrega que acabou de chegar.
 */
const FRESH_MS = 30_000

type Entry = { userId: string; data: ReferralSummary | null; at: number; loaded: boolean }
let entry: Entry | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

async function load(userId: string): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await apiFetch('/referrals/summary')
      const data = res.ok ? ((await res.json()) as ReferralSummary) : null
      entry = { userId, data, at: Date.now(), loaded: true }
    } catch {
      // Sem resumo = nenhuma entrada do programa aparece. Nunca bloqueia o app.
      entry = { userId, data: null, at: Date.now(), loaded: true }
    } finally {
      inflight = null
      emit()
    }
  })()
  return inflight
}

/** Atualiza o cache sem ir ao servidor (ex.: fechou o card, viu a comemoração). */
export function patchReferralSummary(patch: (s: ReferralSummary) => ReferralSummary): void {
  if (!entry?.data) return
  entry = { ...entry, data: patch(entry.data) }
  emit()
}

/** Só para testes: zera o cache do módulo. */
export function __resetReferralSummaryCache(): void {
  entry = null
  inflight = null
}

export function useReferralSummary(): {
  summary: ReferralSummary | null
  /** `true` depois da primeira resposta (ou falha) — a fila de overlays espera por isto. */
  loaded: boolean
  refresh: () => Promise<void>
} {
  const { user } = useAuth()
  const userId = user?.role === 'CLIENT' ? user.id : null
  const [, force] = useState(0)

  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    const stale = !entry || entry.userId !== userId || Date.now() - entry.at > FRESH_MS
    if (stale) void load(userId)
  }, [userId])

  const refresh = useCallback(async () => {
    if (userId) await load(userId)
  }, [userId])

  const mine = entry && userId && entry.userId === userId ? entry : null
  return { summary: mine?.data ?? null, loaded: !!mine?.loaded, refresh }
}
