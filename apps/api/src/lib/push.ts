/**
 * push.ts — helper compartilhado de push OneSignal.
 *
 * Centraliza a criação do client (antes duplicada em ~6 módulos) e o envio best-effort:
 * falha de push NUNCA quebra o fluxo de negócio (apenas loga um warning). Requer as env
 * ONESIGNAL_APP_ID e ONESIGNAL_REST_API_KEY; se ausentes, o envio é um no-op silencioso.
 */
import * as OneSignal from '@onesignal/node-onesignal'
import type { FastifyInstance } from 'fastify'

/** Cria o client do OneSignal a partir da REST API key. */
export function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

export interface PushArgs {
  /** Subscription/player ID do OneSignal do destinatário. */
  playerId: string | null | undefined
  heading: string
  body: string
  /**
   * Rota interna de deep-link (ex.: '/admin', '/courier', '/client/pedidos'). Vai em
   * `data.screen` — o hook useOneSignalDeepLink navega para ela ao tocar. NÃO usamos
   * `notification.url` (URL relativa abriria uma aba do navegador no PWA).
   */
  route?: string
}

/**
 * Envia um push para um único destinatário. Best-effort: sem playerId ou sem env,
 * não faz nada; qualquer erro é logado como warning e engolido.
 */
export async function sendPush(fastify: FastifyInstance, args: PushArgs): Promise<void> {
  const { playerId, heading, body, route } = args
  if (!playerId || !process.env.ONESIGNAL_APP_ID) return
  try {
    const osClient = createOsClient()
    const notification = new OneSignal.Notification()
    notification.app_id = process.env.ONESIGNAL_APP_ID
    notification.include_subscription_ids = [playerId]
    notification.headings = { pt: heading, en: heading }
    notification.contents = { pt: body, en: body }
    if (route) notification.data = { screen: route }
    await osClient.createNotification(notification)
  } catch (err) {
    fastify.log.warn({ err }, '[push] falha ao enviar push — ignorado')
  }
}
