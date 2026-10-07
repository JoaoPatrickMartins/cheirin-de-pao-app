/**
 * Crachá digital v3 (plano-app-entregador, Onda 11 · H-9/T-25) — QR e código de validação que mudam
 * a cada 30 s, gerados NO APARELHO a partir do segredo do entregador (funciona sem sinal).
 *
 * A validação pelo futuro perfil Portaria usa exatamente estas funções no servidor: aceita a janela
 * atual e a anterior (±30 s) e confere se o entregador está ativo.
 *
 * - Janela: `w = floor(unix / 30)`.
 * - Payload do QR: `cdp:b1:{courierId}:{w}:{tag}`, com `tag` = base32 do HMAC-SHA256(segredo,
 *   `courierId:w`), 10 caracteres.
 * - Código curto: 4 caracteres do mesmo HMAC num alfabeto sem 0/O/1/I/L (o porteiro digita).
 *
 * Usa Web Crypto (`crypto.subtle`), presente no navegador (contexto seguro) e no Node 22. Os tipos
 * vêm de uma interface mínima porque o pacote compila só com `lib: ES2022`. Segredo, id e janela
 * são ASCII, então os bytes são os códigos dos caracteres.
 */

export const BADGE_WINDOW_SECONDS = 30
/** Alfabeto do código curto — sem 0/O, 1/I/L (handoff §5). */
export const BADGE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

interface SubtleLike {
  importKey(format: 'raw', key: Uint8Array, algorithm: { name: 'HMAC'; hash: 'SHA-256' }, extractable: boolean, usages: ['sign']): Promise<unknown>
  sign(algorithm: 'HMAC', key: unknown, data: Uint8Array): Promise<ArrayBuffer>
}

function subtle(): SubtleLike | null {
  return (globalThis as { crypto?: { subtle?: SubtleLike } }).crypto?.subtle ?? null
}

/** O gerador funciona neste ambiente (Web Crypto presente — no navegador, só em HTTPS). */
export function badgeCryptoAvailable(): boolean {
  return subtle() !== null
}

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff)

function base32(bytes: Uint8Array): string {
  let out = ''
  let buffer = 0
  let bits = 0
  for (const b of bytes) {
    buffer = (buffer << 8) | b
    bits += 8
    while (bits >= 5) {
      out += BASE32[(buffer >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31]
  return out
}

/** Janela de 30 s do instante (ms) e quantos segundos faltam para a próxima (1..30). */
export function badgeWindow(nowMs: number): { window: number; secondsLeft: number } {
  const t = Math.floor(nowMs / 1000)
  return { window: Math.floor(t / BADGE_WINDOW_SECONDS), secondsLeft: BADGE_WINDOW_SECONDS - (t % BADGE_WINDOW_SECONDS) }
}

export interface BadgeToken {
  /** Conteúdo do QR. */
  payload: string
  /** 10 caracteres base32 do HMAC. */
  tag: string
  /** 4 caracteres para digitar ("K3WD"). */
  code: string
}

/** QR e código da janela. null sem Web Crypto (ex.: página fora de HTTPS — T-32). */
export async function badgeToken(secret: string, courierId: string, window: number): Promise<BadgeToken | null> {
  const s = subtle()
  if (!s || !secret || !courierId) return null
  const key = await s.importKey('raw', ascii(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await s.sign('HMAC', key, ascii(`${courierId}:${window}`)))
  const tag = base32(mac).slice(0, 10)
  const code = Array.from(mac.slice(20, 24), (b) => BADGE_CODE_ALPHABET[b % BADGE_CODE_ALPHABET.length]).join('')
  return { payload: `cdp:b1:${courierId}:${window}:${tag}`, tag, code }
}
