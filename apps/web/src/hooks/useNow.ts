import { useEffect, useState } from 'react'

/**
 * useNow — relógio que avança sozinho, para rótulos que envelhecem na tela.
 *
 * A disponibilidade de um produto é DERIVADA no servidor a partir do instante da leitura: uma
 * pausa de 30 min não gera nenhum evento quando vence. Sem um tique local, a lista do admin
 * mostraria "⏸ 12 min" para sempre até alguém recarregar. Um estado compartilhado por tela é o
 * bastante — não vale um timer por linha.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
