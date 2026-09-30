/**
 * Aviso de uma vez só entre telas (ex.: "Google conectado! Da próxima vez é só um toque." depois de
 * entrar pelo vínculo). Quem navega grava; a tela de destino lê e apaga. sessionStorage: some ao
 * fechar a aba e nunca reaparece num reload posterior.
 */
const FLASH_KEY = 'cdp_flash'

export function setFlash(message: string): void {
  try {
    sessionStorage.setItem(FLASH_KEY, message)
  } catch {
    // sem storage, o aviso só não aparece
  }
}

export function takeFlash(): string | null {
  try {
    const message = sessionStorage.getItem(FLASH_KEY)
    if (message) sessionStorage.removeItem(FLASH_KEY)
    return message
  } catch {
    return null
  }
}
