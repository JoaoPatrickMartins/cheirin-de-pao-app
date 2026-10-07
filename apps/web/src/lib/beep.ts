/**
 * Retorno sensorial do scanner (E4): bipe curto + vibração.
 *
 * - O iPhone só toca áudio depois de um TOQUE do usuário: `unlockBeep()` é chamado no toque em
 *   "Escanear cupom", que libera o AudioContext para os bipes seguintes.
 * - `navigator.vibrate` não existe no iPhone — lá o retorno é só o bipe e o visual.
 * Tudo best-effort: nada aqui pode quebrar a confirmação.
 */

let ctx: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor =
    typeof window !== 'undefined'
      ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    ctx = null
  }
  return ctx
}

/** Chamar dentro de um handler de toque (libera o áudio no iPhone). */
export function unlockBeep(): void {
  const c = audioContext()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}

function tone(c: AudioContext, freq: number, startAt: number, duration: number) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain).connect(c.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

/** `ok` = leitura/entrega confirmada (um bipe agudo); `error` = dois bipes graves. */
export function beep(kind: 'ok' | 'error' = 'ok'): void {
  try {
    const c = audioContext()
    if (c && c.state === 'running') {
      const t = c.currentTime
      if (kind === 'ok') tone(c, 1320, t, 0.12)
      else {
        tone(c, 330, t, 0.12)
        tone(c, 330, t + 0.18, 0.12)
      }
    }
  } catch {
    // sem áudio: segue só com o visual
  }
  try {
    navigator.vibrate?.(kind === 'ok' ? 60 : [80, 60, 80])
  } catch {
    // sem vibração (iPhone)
  }
}
