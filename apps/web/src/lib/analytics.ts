/**
 * analytics — emissão de eventos de acesso/login para os Relatórios do admin.
 *
 * "Fire and forget": nunca bloqueia nem quebra a experiência do usuário.
 * O `visitorId` reaproveita o mesmo `device_id` anônimo já usado pelo apiFetch
 * (gerado via crypto.randomUUID() na primeira visita) — sem PII.
 *
 * Backend: POST /analytics/event (rota pública).
 */
import { apiFetch } from './apiFetch'

function getVisitorId(): string {
  try {
    let id = localStorage.getItem('device_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('device_id', id)
    }
    return id
  } catch {
    // localStorage indisponível (ex.: Safari privado) — ID efêmero
    return crypto.randomUUID()
  }
}

function detectPlatform(): 'pwa' | 'browser' {
  try {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      // iOS Safari "Adicionar à tela inicial"
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    return standalone ? 'pwa' : 'browser'
  } catch {
    return 'browser'
  }
}

function send(body: Record<string, unknown>): void {
  try {
    void apiFetch('/analytics/event', {
      method: 'POST',
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* silencioso — analytics nunca afeta o app */
    })
  } catch {
    /* silencioso */
  }
}

/** Registra um acesso (abertura do app / carga da PWA). Chamar uma vez no boot. */
export function trackAccess(): void {
  send({
    type: 'access',
    visitorId: getVisitorId(),
    path: typeof location !== 'undefined' ? location.pathname : undefined,
    referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    platform: detectPlatform(),
  })
}

/** Registra um login efetuado. Chamar quando a sessão for estabelecida. */
export function trackLogin(role: string, userId?: string): void {
  send({
    type: 'login',
    visitorId: getVisitorId(),
    role,
    userId,
    platform: detectPlatform(),
  })
}
