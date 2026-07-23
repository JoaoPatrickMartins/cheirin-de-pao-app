import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'
import { useAuth } from '../hooks/useAuth'
import { emptyCart, type CartLine, type CartView, type MarketProduct } from '../lib/market'

interface CartContextType {
  cart: CartView
  isLoading: boolean
  /** Σ das quantidades de produto (não inclui pães). */
  count: number
  /** Total da Cestinha em R$ (produtos + pães × avulso). */
  subtotal: number
  qtyOf: (productId: string) => number
  addProduct: (product: MarketProduct, delta?: number) => void
  setQty: (productId: string, qty: number) => void
  removeProduct: (productId: string) => void
  setBreadQty: (n: number) => void
  clear: () => void
  reload: () => void
}

const CartContext = createContext<CartContextType | null>(null)

const SYNC_DEBOUNCE_MS = 400
const clampQty = (n: number) => Math.max(1, Math.min(99, Math.round(n)))
const clampBread = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const round2 = (n: number) => Math.round(n * 100) / 100

// Recalcula a visão local (otimista) a partir das linhas + pães. Mantém avulsoUnit/minimo
// (vêm do servidor); o servidor é a autoridade final e reconcilia após o PUT.
function recompute(lines: CartLine[], breadQty: number, avulsoUnit: number, minimo: number): CartView {
  const items = lines.map((l) => ({ ...l, lineTotal: round2(l.price * l.qty) }))
  const productSubtotal = round2(items.reduce((acc, l) => acc + l.lineTotal, 0))
  const subtotal = round2(productSubtotal + breadQty * avulsoUnit)
  const count = items.reduce((acc, l) => acc + l.qty, 0)
  const hasContent = items.length > 0 || breadQty > 0
  return {
    items,
    breadQty,
    productSubtotal,
    subtotal,
    count,
    avulsoUnit,
    minimo,
    meetsMinimum: hasContent && subtotal >= minimo,
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth()
  const [cart, setCart] = useState<CartView>(emptyCart())
  const [isLoading, setIsLoading] = useState(true)

  // Guard de concorrência: cada mutação incrementa a sequência; a resposta de um PUT só
  // é aplicada se nenhuma mutação nova ocorreu no meio-tempo (evita "rollback" de cliques rápidos).
  const seqRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const desiredRef = useRef<{ items: { productId: string; qty: number }[]; breadQty: number }>({
    items: [],
    breadQty: 0,
  })

  const load = useCallback(async () => {
    if (!token) {
      setCart(emptyCart())
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const res = await apiFetch('/market/cart')
      if (res.ok) setCart((await res.json()) as CartView)
    } catch {
      /* silencioso — mantém o estado atual */
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, token])

  const flush = useCallback(async () => {
    const seqAtSend = seqRef.current
    const payload = desiredRef.current
    try {
      const res = await apiFetch('/market/cart', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        // Falha → recarrega do servidor (rollback do otimismo).
        void load()
        return
      }
      const server = (await res.json()) as CartView
      // Só aplica se não houve mutação mais nova enquanto o PUT estava no ar.
      if (seqRef.current === seqAtSend) setCart(server)
    } catch {
      void load()
    }
  }, [load])

  const scheduleSync = useCallback(
    (next: CartView) => {
      desiredRef.current = {
        items: next.items.map((l) => ({ productId: l.productId, qty: l.qty })),
        breadQty: next.breadQty,
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => void flush(), SYNC_DEBOUNCE_MS)
    },
    [flush],
  )

  // Aplica uma transformação nas linhas/pães: recomputa, seta otimista e agenda o PUT.
  const mutate = useCallback(
    (transform: (prev: CartView) => { lines: CartLine[]; breadQty: number }) => {
      seqRef.current += 1
      setCart((prev) => {
        const { lines, breadQty } = transform(prev)
        const next = recompute(lines, breadQty, prev.avulsoUnit, prev.minimo)
        scheduleSync(next)
        return next
      })
    },
    [scheduleSync],
  )

  const addProduct = useCallback(
    (product: MarketProduct, delta = 1) => {
      mutate((prev) => {
        const idx = prev.items.findIndex((l) => l.productId === product.id)
        let lines: CartLine[]
        if (idx >= 0) {
          lines = prev.items.map((l, i) => (i === idx ? { ...l, qty: clampQty(l.qty + delta) } : l))
        } else {
          const line: CartLine = {
            productId: product.id,
            qty: clampQty(delta),
            name: product.name,
            price: product.price,
            photoUrl: product.photoUrl ?? null,
            categoryId: product.categoryId,
            lineTotal: 0,
            soldOut: product.soldOut,
          }
          lines = [...prev.items, line]
        }
        return { lines, breadQty: prev.breadQty }
      })
    },
    [mutate],
  )

  const setQty = useCallback(
    (productId: string, qty: number) => {
      mutate((prev) => {
        const lines =
          qty <= 0
            ? prev.items.filter((l) => l.productId !== productId)
            : prev.items.map((l) => (l.productId === productId ? { ...l, qty: clampQty(qty) } : l))
        return { lines, breadQty: prev.breadQty }
      })
    },
    [mutate],
  )

  const removeProduct = useCallback((productId: string) => setQty(productId, 0), [setQty])

  const setBreadQty = useCallback(
    (n: number) => {
      mutate((prev) => ({ lines: prev.items, breadQty: clampBread(n) }))
    },
    [mutate],
  )

  const clear = useCallback(() => {
    mutate(() => ({ lines: [], breadQty: 0 }))
  }, [mutate])

  const qtyOf = useCallback(
    (productId: string) => cart.items.find((l) => l.productId === productId)?.qty ?? 0,
    [cart.items],
  )

  const value: CartContextType = {
    cart,
    isLoading,
    count: cart.count,
    subtotal: cart.subtotal,
    qtyOf,
    addProduct,
    setQty,
    removeProduct,
    setBreadQty,
    clear,
    reload: load,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
