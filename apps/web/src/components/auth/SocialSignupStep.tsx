import { isValidBrMobile, isValidCpf } from '@cheirin-de-pao/shared'
import { ReferralBadge, ReferralCodeField, ReferralCodeToggle, type SignupReferral } from './ReferralCodeField'
import { Btn, Field, GoogleButton, Notice, ProviderPill, SocialKeyframes, Sub, Title } from './SocialAuthUI'

export type SocialSignupNotice = 'cpfTaken' | 'telTaken' | 'expired' | null

/**
 * L4 passo 1 — "Quase lá, Marina!" (cadastro pelo Google). Só os dados que o Google não entrega:
 * CPF, nascimento e celular; o nome vem preenchido e o e-mail vem travado. Os passos 2 e 3
 * (condomínio e endereço) são os do cadastro de hoje, no OnboardingScreen.
 */
export function SocialSignupStep({
  email,
  name,
  cpf,
  birthDate,
  phone,
  onName,
  onCpf,
  onBirthDate,
  onPhone,
  referral,
  notice,
  restarting,
  onRestartGoogle,
  onLoginInstead,
  onContinue,
}: {
  email: string
  name: string
  cpf: string
  birthDate: string
  phone: string
  onName: (v: string) => void
  onCpf: (v: string) => void
  onBirthDate: (v: string) => void
  onPhone: (v: string) => void
  referral: SignupReferral
  notice: SocialSignupNotice
  restarting: boolean
  onRestartGoogle: () => void
  onLoginInstead: () => void
  onContinue: () => void
}) {
  const first = name.trim().split(/\s+/)[0] ?? ''
  const cpfDigits = cpf.replace(/\D/g, '')
  const cpfInvalid = cpfDigits.length === 11 && !isValidCpf(cpf)
  const phoneDigits = phone.replace(/\D/g, '')
  const phoneInvalid = phoneDigits.length === 11 && !isValidBrMobile(phone)
  const ready =
    name.trim().length >= 2 &&
    isValidCpf(cpf) &&
    birthDate.replace(/\D/g, '').length === 8 &&
    isValidBrMobile(phone) &&
    notice !== 'cpfTaken' &&
    notice !== 'telTaken'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <SocialKeyframes />
      {notice === 'expired' && (
        <div style={{ marginBottom: 16 }}>
          <Notice title="Sua conexão com o Google expirou.">
            Seus dados digitados ficam aqui. Toque para continuar com o Google de novo.
            <div style={{ marginTop: 10 }}>
              <GoogleButton state={restarting ? 'loading' : 'idle'} onClick={onRestartGoogle} />
            </div>
          </Notice>
        </div>
      )}
      <Title size={26}>{first ? `Quase lá, ${first}!` : 'Quase lá!'}</Title>
      <Sub style={{ marginBottom: 18 }}>Faltam só uns dados. O CPF vai na nota e no pagamento; o celular, pros avisos de entrega.</Sub>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {email && <ProviderPill email={email} />}
        <Field label="Nome completo" icon="user" value={name} onChange={onName} autoComplete="name" hint="Veio do Google. Pode ajustar." />
        <div>
          <Field
            label="CPF"
            icon="card"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={cpf}
            onChange={onCpf}
            placeholder="000.000.000-00"
            error={cpfInvalid ? 'Esse CPF não parece completo. Confira os 11 números.' : null}
          />
          {notice === 'cpfTaken' && (
            <div style={{ marginTop: 10 }}>
              <Notice title="Esse CPF já tem uma conta.">
                Entre nela e conecte o Google depois, em Perfil › Minha conta.
                <div style={{ marginTop: 10 }}>
                  <Btn size="sm" icon="user" onClick={onLoginInstead}>
                    Entrar na minha conta
                  </Btn>
                </div>
              </Notice>
            </div>
          )}
        </div>
        <Field
          label="Data de nascimento"
          icon="calendar"
          type="tel"
          inputMode="numeric"
          value={birthDate}
          onChange={onBirthDate}
          placeholder="DD / MM / AAAA"
        />
        <Field
          label="Celular"
          icon="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={onPhone}
          placeholder="(11) 9 0000-0000"
          error={
            phoneInvalid
              ? 'Faltam números. O celular tem DDD + 9 dígitos.'
              : notice === 'telTaken'
                ? 'Esse celular já está em outro cadastro. Use outro número ou fale com o suporte.'
                : null
          }
          hint="Só pra avisos de entrega. Nada de spam."
        />
      </div>

      {/* Indicação — mesmo comportamento do passo 1 do cadastro por e-mail. */}
      {referral.linked && !referral.fieldOpen && (
        <div style={{ marginTop: 16 }}>
          <ReferralBadge
            referrerName={referral.linked.referrerName}
            welcomeBreads={referral.linked.welcomeBreads}
            onChange={referral.openField}
          />
        </div>
      )}
      {referral.active && (referral.fieldOpen || !referral.linked) && (
        <div style={{ marginTop: 10 }}>
          {referral.fieldOpen ? <ReferralCodeField referral={referral} /> : <ReferralCodeToggle onOpen={referral.openField} />}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 20 }} />
      <Btn full size="lg" disabled={!ready || referral.status === 'validating'} onClick={onContinue}>
        Continuar
      </Btn>
    </div>
  )
}
