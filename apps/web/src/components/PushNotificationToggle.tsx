/**
 * PushNotificationToggle — card reutilizável para ativar/desativar o push (OneSignal).
 *
 * Encapsula toda a máquina de estados de permissão (loading | unsupported | ios-install |
 * default | granted | denied) do hook usePushOptIn e a expõe como um card com SwitchToggle
 * + texto de orientação. Usado nos perfis de ENTREGADOR e ADMIN (o cliente tem a sua própria
 * variante em client/SettingsScreen.tsx). O init do SDK e o registro do player_id no backend
 * já acontecem globalmente (main.tsx) e nos layouts (useOneSignalRegister) — este componente
 * só provê o gesto de opt-in, obrigatório para o prompt do navegador (especialmente no iOS).
 */
import type { ComponentProps } from 'react'
import { Icon } from './brand/Icon'
import { SwitchToggle } from './admin/SwitchToggle'
import { usePushOptIn } from '../hooks/usePushOptIn'

type IconName = ComponentProps<typeof Icon>['name']

interface PushNotificationToggleProps {
  /** Título do card. */
  title?: string
  /** Descrição mostrada quando o push ainda não foi decidido (status 'default'). */
  description?: string
  /** Ícone à esquerda. */
  icon?: IconName
}

export function PushNotificationToggle({
  title = 'Notificações',
  description = 'Receba avisos importantes neste aparelho.',
  icon = 'bell',
}: PushNotificationToggleProps) {
  const { status, busy, enable, disable } = usePushOptIn()

  const on = status === 'granted'
  // Só é acionável quando dá para decidir (ativar) ou reverter (desativar).
  const interactive = status === 'default' || status === 'granted'
  const disabled = busy || !interactive

  let desc: string
  let hint: string | null = null
  switch (status) {
    case 'granted':
      desc = 'Ativadas neste aparelho'
      break
    case 'denied':
      desc = 'Bloqueadas no navegador'
      hint =
        'As notificações estão bloqueadas para este site. Toque no cadeado ao lado do endereço → Notificações → Permitir e recarregue a página.'
      break
    case 'ios-install':
      desc = 'Instale o app na tela inicial para ativar'
      hint =
        'No iPhone/iPad: toque em Compartilhar → "Adicionar à Tela de Início". Depois abra o app pelo ícone criado e ative por aqui.'
      break
    case 'unsupported':
      desc = 'Não suportado neste navegador'
      break
    case 'loading':
      desc = 'Verificando…'
      break
    default: // 'default' — suportado, ainda não decidido
      desc = description
  }

  const handleChange = () => {
    if (busy) return
    if (status === 'default') void enable()
    else if (status === 'granted') void disable()
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 15,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <Icon name={icon} size={20} stroke={1.9} color="var(--color-accent)" aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-ter)',
              margin: '2px 0 0',
              lineHeight: 1.35,
            }}
          >
            {busy ? 'Aguarde…' : desc}
          </p>
        </div>
        <SwitchToggle
          on={on}
          disabled={disabled}
          onChange={handleChange}
          aria-label={`Notificações push: ${on ? 'ativadas' : 'desativadas'}`}
        />
      </div>
      {hint && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            color: 'var(--color-text-sec)',
            lineHeight: 1.5,
            margin: '10px 0 0',
          }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
