import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'
import type { MarketCategory, MarketProduct } from '../lib/market'

// Combo mínimo que a listagem /combos retorna (com economyPercent já calculado no backend).
interface ComboLite {
  economyPercent?: number | null
}

interface PricingLite {
  avulsoUnit: number
}

export interface MarketCatalogData {
  categories: MarketCategory[]
  products: MarketProduct[]
  /** Preço do pão avulso (R$) — base do resgate de crédito no market. */
  avulsoUnit: number
  /** Maior economia % entre os combos ativos → selo "Pague com pãezinhos: até X%". 0 = sem selo. */
  maxEconomyPercent: number
  isLoading: boolean
  error: string | null
  reload: () => void
}

/**
 * useMarketCatalog — busca em paralelo o catálogo do cliente, a precificação (avulsoUnit)
 * e os combos (para o selo dinâmico de economia). Fonte única de dados das telas do market
 * (catálogo, detalhe, bloco da Home), evitando recomputar o desconto no front — nunca hard-code
 * do mockup (37%): o valor é sempre o real (~16–17%).
 */
export function useMarketCatalog(): MarketCatalogData {
  const [categories, setCategories] = useState<MarketCategory[]>([])
  const [products, setProducts] = useState<MarketProduct[]>([])
  const [avulsoUnit, setAvulsoUnit] = useState(0)
  const [maxEconomyPercent, setMaxEconomyPercent] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [catRes, pricingRes, combosRes] = await Promise.all([
          apiFetch('/market/catalog'),
          apiFetch('/pricing'),
          apiFetch('/combos'),
        ])
        if (cancelled) return

        if (catRes.ok) {
          const data = (await catRes.json()) as {
            categories: MarketCategory[]
            products: MarketProduct[]
          }
          setCategories(data.categories ?? [])
          setProducts(data.products ?? [])
        } else {
          setError('Não foi possível carregar o catálogo.')
        }

        if (pricingRes.ok) {
          const p = (await pricingRes.json()) as PricingLite
          setAvulsoUnit(p.avulsoUnit ?? 0)
        }

        if (combosRes.ok) {
          const combos = (await combosRes.json()) as ComboLite[]
          const max = combos.reduce((acc, c) => Math.max(acc, c.economyPercent ?? 0), 0)
          setMaxEconomyPercent(max)
        }
      } catch {
        if (!cancelled) setError('Erro de conexão. Tente novamente.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [nonce])

  return { categories, products, avulsoUnit, maxEconomyPercent, isLoading, error, reload }
}
