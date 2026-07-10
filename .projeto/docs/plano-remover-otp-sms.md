# Plano — Remover OTP por SMS (acesso só por e-mail neste primeiro momento)

## Contexto
Custo de SMS é alto para o início. Vamos focar o OTP **apenas em e-mail** agora.
SMS **não** voltará — futuramente o segundo canal será **WhatsApp** (API própria),
reaproveitando a mesma mecânica de OTP. Por isso:

- Remover **acesso por celular** no login (login só por e-mail).
- Remover a opção de **receber código por SMS** no cadastro.
- **Manter o campo telefone** no cadastro do cliente (necessário p/ WhatsApp OTP futuro + avisos de entrega).
- Remover a integração Zenvia (SMS) do backend.

## Decisões de produto (confirmadas com o usuário)
1. **Telefone obrigatório** no cadastro (e-mail também obrigatório — é o canal do OTP).
2. **Editar contato**: somente e-mail por OTP. Edição de telefone volta com o WhatsApp.

## Mudanças

### Backend (apps/api)
- `src/modules/auth/otp.service.ts` — remover `sendSmsOtp` + tudo de Zenvia; manter `sendEmailOtp`.
- `src/modules/auth/auth.service.ts` — `sendOtp(userId, email)` só e-mail; `register` exige e-mail; remover import de `sendSmsOtp` e o param `channel`.
- `src/modules/auth/auth.schema.ts` — `RegisterSchema`: `phone` e `email` obrigatórios, remover `channel` e o `.refine`. `SendOtpSchema`: só `email` (obrigatório).
- `src/modules/auth/auth.controller.ts` — `sendOtp`: localizar usuário por e-mail; sempre e-mail.
- `src/modules/auth/auth.route.ts` — schemas Fastify: register (required sem `channel`, com `email`/`phone`; descrições), otp/send (só `email`), otp/verify e couriers (texto sem "SMS").
- `src/modules/client-profile/client-profile.schema.ts` — `ContactChangeRequestSchema`: só `email` obrigatório.
- `src/modules/client-profile/client-profile.service.ts` — `requestContactChange` só e-mail; remover import de `sendSmsOtp`.
- `src/server.ts` — remover `ZENVIA_TOKEN`/`ZENVIA_FROM` do envSchema.
- `.env.example` — remover bloco Zenvia.
- `src/__tests__/auth.service.test.ts` — ajustar chamada `sendOtp` p/ nova assinatura (e-mail).
- `src/modules/admin-couriers/admin-couriers.route.ts` — descrição: remover menção a "via SMS".

### Frontend (apps/web)
- `src/pages/auth/LoginScreen.tsx` — login só e-mail (remover toggle telefone/e-mail e estado `inputMode`).
- `src/pages/auth/OnboardingScreen.tsx` — manter campos Celular + E-mail; remover `ChannelSelector`, estado `canal` e auto-seleção; e-mail+telefone obrigatórios; OTP/registro sempre por e-mail; copy atualizada.
- `src/components/auth/ChannelSelector.tsx` — remover (sem uso).
- `src/pages/client/ContactEditScreen.tsx` — só e-mail (remover `ChannelToggle`).

## Fora de escopo (anotado)
- `apps/web/.../AdminRelatorios.tsx` card "Custo de OTP por canal (SMS vs e-mail)" — stub de relatório futuro; deixado como está.
- Login de entregador também passa a depender de e-mail (resolvido por e-mail). Admin deve cadastrar e-mail do entregador. Schema de courier não alterado.
- Campo `channel` do modelo `OtpCode` mantido no banco (passa a gravar `'email'`); útil p/ WhatsApp futuro.
