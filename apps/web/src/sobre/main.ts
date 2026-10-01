/**
 * Script da página "Sobre" (/sobre/) — sem React. O HTML e o CSS já entregam a página inteira;
 * aqui entram só o movimento na rolagem (§A.2 do handoff), o topo fixo, as contagens e os dados
 * da API (turnos, Indique e Ganhe), o WhatsApp e o "Voltar ao app" de quem já tem sessão.
 */
import { supportWhatsappUrl } from '../lib/support'
import { applyLanding, backToAppHref, fetchLanding, hasSavedSession } from './landing'

declare global {
  interface Window {
    __sbReady?: boolean
  }
}

// O mesmo endereço da API que o app usa (lib/apiFetch.ts).
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

const reduced = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
})()

/* ---------- contagem 0 → alvo (ease-out cúbico, algarismos tabulares) ---------- */
function countUp(el: HTMLElement) {
  const target = Number(el.dataset.count)
  if (!Number.isFinite(target)) return
  if (reduced) {
    el.textContent = String(target)
    return
  }
  const delay = Number(el.dataset.countDelay ?? 0)
  const dur = Number(el.dataset.countDur ?? 1200)
  el.textContent = '0'
  window.setTimeout(() => {
    let t0: number | null = null
    const step = (ts: number) => {
      t0 ??= ts
      const p = Math.min(1, (ts - t0) / dur)
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, delay)
}

/* ---------- entradas na rolagem: cada [data-io] ganha .in uma vez ---------- */
function startReveals() {
  const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-io]'))
  const reveal = (el: HTMLElement) => {
    if (el.classList.contains('in')) return
    el.classList.add('in')
    el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp)
  }

  // As contagens de dentro de um gatilho começam em 0 (o bloco ainda está escondido).
  if (!reduced) {
    triggers.forEach((t) => t.querySelectorAll<HTMLElement>('[data-count]').forEach((c) => (c.textContent = '0')))
  }

  if (reduced || !('IntersectionObserver' in window)) {
    triggers.forEach(reveal)
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        io.unobserve(e.target)
        reveal(e.target as HTMLElement)
      }
    },
    { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
  )
  triggers.forEach((t) => io.observe(t))

  // Rede de segurança (como no protótipo): bloco alto demais para 14 % ou rolagem por âncora.
  const check = () => {
    const vh = window.innerHeight || 800
    for (const t of triggers) {
      if (t.classList.contains('in')) continue
      const r = t.getBoundingClientRect()
      if (r.top < vh * 0.94 && r.bottom > 0) {
        io.unobserve(t)
        reveal(t)
      }
    }
  }
  window.addEventListener('scroll', check, { passive: true })
  window.addEventListener('resize', check, { passive: true })
  window.setTimeout(check, 60)
}

/* ---------- topo: fica sólido depois de 24 px de rolagem ---------- */
function startTop() {
  const top = document.querySelector<HTMLElement>('[data-sb-top]')
  if (!top) return
  const on = () => top.classList.toggle('is-scrolled', window.scrollY > 24)
  on()
  window.addEventListener('scroll', on, { passive: true })
}

function start() {
  startTop()
  startReveals()
  document.querySelectorAll<HTMLElement>('[data-count-onload]').forEach(countUp)

  const wa = document.querySelector<HTMLAnchorElement>('[data-sb-whatsapp]')
  if (wa) wa.href = supportWhatsappUrl()

  let storage: Storage | undefined
  try {
    storage = window.localStorage
  } catch {
    storage = undefined
  }
  // Quem já tem sessão: no topo, só o "Voltar ao app" (D-10) — sem Entrar nem Criar conta.
  if (hasSavedSession(storage)) {
    const voltar = document.querySelector<HTMLAnchorElement>('[data-sb-voltar]')
    if (voltar) {
      voltar.href = backToAppHref(document.referrer, window.location.origin)
      voltar.hidden = false
      document.querySelector<HTMLElement>('[data-sb-entrar]')?.setAttribute('hidden', '')
      document.querySelector<HTMLElement>('[data-sb-criar]')?.setAttribute('hidden', '')
    }
  }

  window.__sbReady = true

  void fetchLanding(API_BASE).then((info) => applyLanding(document, info, { animate: !reduced }))
}

start()
