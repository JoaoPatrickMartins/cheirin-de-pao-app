// Suporte via WhatsApp — número configurável por env (dígitos com DDI, ex.: 5511999998888).
// Mesmo padrão de SettingsScreen/HookScreen; placeholder até VITE_SUPPORT_WHATSAPP ser definido.
const SUPPORT_WHATSAPP = ((import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) ?? '5599999999999').replace(/\D/g, '')

export function supportWhatsappUrl(message = 'Olá! Preciso de ajuda com o Cheirin de Pão.'): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`
}
