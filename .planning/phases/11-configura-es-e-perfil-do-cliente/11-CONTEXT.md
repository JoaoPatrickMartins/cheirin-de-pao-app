# Phase 11: Configurações e Perfil do Cliente - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega a tela de configurações completa do cliente: visualização e edição de dados pessoais (nome, data de nascimento, CPF bloqueado), edição de contato (telefone/email) com re-verificação OTP em tela separada, edição de condomínio e apartamento (com aviso de desativação de agenda), e logout via `AuthContext.logout()`.

O cliente acessa tudo pelo 5º tab "Perfil" no `ClientTabBar`. Nenhum novo capability além dos requisitos CONF-01 a CONF-07.

**Requisitos desta fase:** CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07 (7 requisitos)

</domain>

<decisions>
## Implementation Decisions

### Tab Bar — Acesso às Configurações (CONF-01)

- **D-01:** Adicionar **5º tab "Perfil"** ao `ClientTabBar` com ícone de perfil (user/person — não engrenagem) e label `'Perfil'`.
- **D-02:** Rota: `/client/perfil` — renderiza dentro do `ClientLayout` com tab bar visível (mesmo padrão flat das outras telas).
- **D-03:** Nenhum botão de voltar — é uma aba de nível superior, não uma tela em stack.

### Dados do Perfil no AuthContext

- **D-04:** Enriquecer `AuthUser` no login: após autenticar com sucesso, fazer `GET /client/profile` e adicionar os campos ao objeto `AuthUser` persistido no localStorage. Campos a adicionar à interface: `phone?: string`, `email?: string`, `cpf: string`, `birthDate: string`, `condominiumId: string`, `condominiumName: string`, `apartment: string`, `block?: string`.
- **D-05:** `AuthContext` ganha método `updateUser(partial: Partial<AuthUser>)` — análogo ao `updateCreditBalance()` já existente. Atualiza estado em memória + localStorage de forma síncrona após salvar qualquer edição nas configurações.
- **D-06:** Sem refetch de profile ao abrir a tela de configurações — dados vêm do `AuthUser` em memória. Sempre frescos após o login e após qualquer edição salva.

### Tela de Configurações — SettingsScreen (CONF-02, CONF-03, CONF-05, CONF-07)

- **D-07:** Tela organizada em seções: **Dados Pessoais** (nome + data nascimento editáveis, CPF readonly), **Contato** (phone/email com botão 'Editar'), **Condomínio** (condomínio + apartamento + bloco editáveis), **Conta** (botão Sair).
- **D-08:** CPF exibido mas bloqueado — input readonly com estilo visual diferente para indicar imutabilidade (conforme CONF-03).
- **D-09:** Botão "Sair" na seção Conta chama `AuthContext.logout()` diretamente — sem dialog de confirmação (cliente, diferente do Admin que tem dialog).

### Fluxo de Edição de Contato com OTP (CONF-04)

- **D-10:** Acesso via botão 'Editar' na seção Contato — navega para tela separada `/client/perfil/editar-contato`.
- **D-11:** Tela `/client/perfil/editar-contato` tem **2 steps visuais na mesma tela**:
  - Step 1: input do novo contato (phone ou email) + botão 'Enviar código'
  - Step 2 (transição visual, mesma tela): campo OTP 4 dígitos + botão 'Confirmar'
- **D-12:** Backend valida conflito **antes de enviar OTP**: se novo contato já pertence a outra conta, retorna `422` com mensagem genérica. Frontend exibe: `'Este contato já está associado a outra conta.'` — sem revelar qual conta.
- **D-13:** OTP enviado com `purpose: 'CONTACT_CHANGE'` (conforme D-18 de fases anteriores) para não conflitar com `findActiveOtp` do login.
- **D-14:** Após OTP validado com sucesso: backend atualiza `User.phone`/`User.email`, frontend chama `updateUser()` com novo contato e navega de volta para `/client/perfil`.

### Mudança de Condomínio (CONF-05, CONF-06)

- **D-15:** Edição de condomínio inline na SettingsScreen (sem tela separada): select/search de condomínio + campo apartamento + campo bloco condicional.
- **D-16:** Campo 'Bloco' aparece **somente se o condomínio selecionado for do tipo `BLOCKS`** — mesmo comportamento condicional do cadastro (`OnboardingScreen`).
- **D-17:** Ao tocar 'Salvar' na seção de Condomínio, se o condomínio mudou: exibe **dialog de confirmação** — `'Mudar de condomínio vai desativar sua agenda semanal ativa. Deseja continuar?'` com botões Cancelar / Confirmar.
- **D-18:** Após confirmar mudança de condomínio: backend desativa `Schedule` semanal ativo, frontend chama `updateUser()` com novo `condominiumId`/`condominiumName`/`apartment`/`block`.
- **D-19:** A `ScheduleScreen` exibe **banner contextual** se o usuário mudou de condomínio e não tem agenda ativa: `'Você mudou de condomínio. Configure sua nova agenda semanal.'` Banner some após criar nova agenda.

### Claude's Discretion

- Design visual das seções da SettingsScreen — seguir padrão visual existente (fundo creme, headers de seção estilo espresso, campos com borda).
- Ícone exato de "perfil" para o 5º tab — escolher do mesmo conjunto de ícones já usado no projeto (Lucide ou similar).
- Validações de campo inline (ex: formato de data, tamanho mínimo de nome).
- Mensagens de erro e toast de sucesso — seguir padrão visual das outras telas.
- Comportamento do banner de agenda na ScheduleScreen (como detectar "mudou de condomínio" — ex: comparar `condominiumId` atual com anterior, ou flag no backend).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Regras de Negócio
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §CONF — CONF-01 a CONF-07 (configurações do cliente — requisitos desta fase)
- `.projeto/Cheirin_de_Pao_Modelo_Funcionamento.md` — modelo de negócio: ciclo de créditos e agendamentos (contexto para CONF-06: desativação de agenda)

### Schema Prisma
- `apps/api/prisma/schema.prisma` — schema v1.1 (aplicado na Phase 10). Leitura obrigatória antes de implementar endpoints de profile/settings.

### Código Existente — Frontend (pontos de integração)
- `apps/web/src/contexts/AuthContext.tsx` — `AuthUser` interface (linhas 1–10), `login()` (linhas 55–72), `logout()` (linhas 73–82), `updateCreditBalance()` (modelo para o novo `updateUser()`). **Leitura obrigatória** — D-04, D-05, D-06 dependem deste arquivo.
- `apps/web/src/components/client/ClientTabBar.tsx` — tab bar atual com 4 tabs. Adicionar 5º tab "Perfil" aqui (D-01, D-02).
- `apps/web/src/routes/` — rotas do cliente. Adicionar `/client/perfil` e `/client/perfil/editar-contato` aqui.
- `apps/web/src/pages/client/ClientLayout.tsx` — layout wrapper do cliente. SettingsScreen renderiza dentro dele.
- `apps/web/src/pages/auth/OnboardingScreen.tsx` — fluxo de cadastro com seleção de condomínio + bloco condicional. **Referência de padrão** para D-16.

### Código Existente — Backend (pontos de integração)
- `apps/api/src/modules/auth/otp.service.ts` — `sendSmsOtp` e `sendEmailOtp`. Base para envio do OTP de mudança de contato.
- `apps/api/src/modules/auth/auth.route.ts` — rotas OTP existentes (`/auth/otp/send`, `/auth/otp/verify`). Novo endpoint de contato pode reutilizar lógica.
- `apps/api/src/modules/auth/auth.service.ts` — (verificar) lógica de `findActiveOtp` — D-13 requer `purpose: 'CONTACT_CHANGE'` para não conflitar.

### Decisões de Fases Anteriores Relevantes
- D-18 (Phase 9/State): OTP de mudança de contato usa `purpose: 'CONTACT_CHANGE'` — não conflita com `findActiveOtp` de login.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthContext.logout()` — implementado e funcional (linhas 73–82 de `AuthContext.tsx`). Reutilizar diretamente no botão "Sair" da SettingsScreen (D-09).
- `updateCreditBalance()` — modelo de atualização parcial do AuthUser (linhas 83–96 de `AuthContext.tsx`). Padrão a seguir para o novo `updateUser()` (D-05).
- Padrão OTP 4 dígitos — já implementado em `LoginScreen` e `OnboardingScreen`. Reutilizar o mesmo componente/hook de input OTP.
- Lógica de condomínio + bloco condicional — já implementada em `OnboardingScreen`. Extrair ou duplicar para a seção de condomínio das configurações.

### Established Patterns
- Rotas lazy-loaded via `import()` no router — manter o mesmo padrão para as novas rotas de perfil/configurações.
- Módulos backend: `controller → service → repository` — novo módulo `client-profile` deve seguir este padrão.
- Autenticação via JWT no header `Authorization: Bearer {token}` — endpoints de profile/settings são autenticados.

### Integration Points
- `ClientTabBar` → adicionar 5º tab que aponta para `/client/perfil`
- `AuthContext` → adicionar campos de perfil em `AuthUser` + método `updateUser()`
- `ScheduleScreen` → adicionar verificação de banner se `condominiumId` mudou e sem agenda ativa
- Novo módulo backend `client-profile` ou extensão de `auth` → endpoints:
  - `GET /client/profile` — retorna dados completos do cliente autenticado
  - `PATCH /client/profile` — atualiza nome, data de nascimento, condomínio, apartamento, bloco
  - `POST /client/profile/contact/request-change` — valida novo contato + envia OTP `CONTACT_CHANGE`
  - `POST /client/profile/contact/confirm-change` — verifica OTP e atualiza contato

</code_context>

<specifics>
## Specific Ideas

- O tab de "Perfil" deve usar ícone de person/user (não engrenagem) — preferência explícita do usuário durante a discussão.
- A tela de edição de contato (`/client/perfil/editar-contato`) tem 2 steps visuais sem navegar para nova rota — experiência de step wizard inline.
- O dialog de confirmação ao mudar de condomínio é obrigatório e deve mencionar explicitamente que a agenda semanal será desativada.

</specifics>

<deferred>
## Deferred Ideas

None — discussão ficou dentro do escopo da fase.

</deferred>

---

*Phase: 11-Configurações e Perfil do Cliente*
*Context gathered: 2026-06-19*
