/**
 * usePushOptIn — estado e ações de permissão de push (OneSignal Web SDK v16).
 *
 * Centraliza a lógica de opt-in usada tanto no controle do Perfil quanto no aviso da Home.
 * O `enable()` chama `requestPermission()` a partir de um gesto do usuário (obrigatório no
 * iOS) — por isso NÃO aguardamos `oneSignalReady` dentro dele: o botão só fica acionável
 * quando `status !== 'loading'`, o que já garante que o init terminou, preservando a
 * "user activation" da chamada.
 *
 * iOS: web push só funciona com o PWA instalado na tela inicial (iOS 16.4+). Detectamos esse
 * caso (`ios-install`) para orientar o usuário em vez de tentar um prompt que não existe.
 */
import { useCallback, useEffect, useState } from 'react'
import OneSignal from 'react-onesignal'
import { oneSignalReady } from '../lib/onesignal'

export type PushStatus =
  | 'loading' // ainda verificando o estado do SDK
  | 'unsupported' // navegador/contexto sem suporte a push
  | 'ios-install' // iOS fora do PWA instalado — precisa "Adicionar à Tela de Início"
  | 'default' // suportado, ainda não decidido → pode ativar
  | 'granted' // permissão concedida e inscrito
  | 'denied' // bloqueado no navegador

function isIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS moderno se apresenta como "MacIntel" com touch
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  )
}

function computeStatus(): PushStatus {
  try {
    // iOS só entrega push com o app instalado — trate antes do isPushSupported().
    if (isIOS() && !isStandalone()) return 'ios-install'
    if (!OneSignal.Notifications.isPushSupported()) return 'unsupported'
    const native = OneSignal.Notifications.permissionNative // 'default' | 'granted' | 'denied'
    if (native === 'denied') return 'denied'
    if (native === 'granted') return 'granted'
    return 'default'
  } catch {
    return 'unsupported'
  }
}

export function usePushOptIn() {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    setStatus(computeStatus())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    let onPermission: (() => void) | null = null
    let onSubscription: (() => void) | null = null

    void oneSignalReady.then(() => {
      if (cancelled) return
      refresh()
      onPermission = () => refresh()
      onSubscription = () => refresh()
      try {
        OneSignal.Notifications.addEventListener('permissionChange', onPermission)
      } catch {
        /* Silencioso */
      }
      try {
        OneSignal.User.PushSubscription.addEventListener('change', onSubscription)
      } catch {
        /* Silencioso */
      }
    })

    return () => {
      cancelled = true
      try {
        if (onPermission) OneSignal.Notifications.removeEventListener('permissionChange', onPermission)
      } catch {
        /* Silencioso */
      }
      try {
        if (onSubscription) OneSignal.User.PushSubscription.removeEventListener('change', onSubscription)
      } catch {
        /* Silencioso */
      }
    }
  }, [refresh])

  /** Solicita permissão e garante a inscrição. DEVE ser chamado a partir de um clique. */
  const enable = useCallback(async () => {
    setBusy(true)
    try {
      const granted = await OneSignal.Notifications.requestPermission()
      // optedIn pode ser `undefined` logo após conceder (subscrição ainda materializando) —
      // `!== true` garante o opt-in tanto nesse caso quanto quando está explicitamente false.
      if (granted && OneSignal.User.PushSubscription.optedIn !== true) {
        await OneSignal.User.PushSubscription.optIn()
      }
    } catch {
      /* Silencioso — o refresh no finally reflete o estado real */
    } finally {
      setBusy(false)
      refresh()
    }
  }, [refresh])

  /** Cancela a inscrição (mantém a permissão do navegador). */
  const disable = useCallback(async () => {
    setBusy(true)
    try {
      await OneSignal.User.PushSubscription.optOut()
    } catch {
      /* Silencioso */
    } finally {
      setBusy(false)
      refresh()
    }
  }, [refresh])

  return { status, busy, enable, disable }
}
