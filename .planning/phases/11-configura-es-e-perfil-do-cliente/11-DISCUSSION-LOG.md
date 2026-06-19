# Phase 11: Configurações e Perfil do Cliente - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 11-configurações-e-perfil-do-cliente
**Areas discussed:** Localização da engrenagem, Fluxo OTP de mudança de contato, Carregamento dos dados do perfil, Comportamento ao mudar condomínio

---

## Localização da engrenagem

### Como adicionar acesso às configurações?

| Option | Description | Selected |
|--------|-------------|----------|
| 5º tab no tab bar | Adiciona aba como 5º item. Consistente com o padrão de navegação existente, acessível de qualquer tela. | ✓ |
| Ícone no header da HomeScreen | Engrenagem no canto superior direito da tela inicial. Não ocupa espaço no tab bar. | |
| Acesso pelo avatar/nome no header | Toque no nome ou avatar do cliente abre configurações. Mais clean, menos descobrível. | |

**User's choice:** 5º tab no tab bar

---

### Como aparece no tab bar?

| Option | Description | Selected |
|--------|-------------|----------|
| Só o ícone de engrenagem (sem label) | Tab bar mais compacto. Ícone de engrenagem é universal. | |
| Engrenagem + label 'Config' | Consistente com os outros 4 tabs que têm label. | |
| Engrenagem + label 'Perfil' | Label alternativo que remete mais ao conteúdo (dados pessoais, conta). | |

**User's choice:** "ao invés de engrenagem coloque um ícone de perfil e label 'Perfil'"
**Notes:** Usuário preferiu ícone de person/user em vez de engrenagem, com label 'Perfil'.

---

### A tela abre como página normal ou stack?

| Option | Description | Selected |
|--------|-------------|----------|
| Página normal com tab bar (flat) | SettingsScreen dentro do ClientLayout com tab bar visível. Rota: /client/perfil. | ✓ |
| Tela em stack (sem tab bar, com botão voltar) | Abre como camada sobre o layout. Tab bar some, seta de voltar aparece. | |

**User's choice:** Página normal com tab bar

---

## Fluxo OTP de mudança de contato

### UX do fluxo de edição de contato

| Option | Description | Selected |
|--------|-------------|----------|
| Inline na própria tela de configurações | Campo de edição expande na seção. OTP surge na mesma tela. | |
| Modal centralizado | Botão 'Editar' abre modal com input + OTP em sequência. | |
| Tela separada (sub-rota) | Navega para /client/perfil/editar-contato. Fluxo em tela inteira com botão voltar. | ✓ |

**User's choice:** Tela separada (sub-rota)

---

### Quantas etapas na tela separada?

| Option | Description | Selected |
|--------|-------------|----------|
| 2 steps na mesma tela | Step 1: digitar novo contato. Step 2: OTP 4 dígitos abaixo. Transição visual sem nova rota. | ✓ |
| 2 sub-rotas separadas | Rota 1: input novo contato. Rota 2: input OTP. Histórico de navegação completo. | |

**User's choice:** 2 steps na mesma tela

---

### Novo contato já cadastrado em outra conta

| Option | Description | Selected |
|--------|-------------|----------|
| Erro genérico sem confirmar se existe | Backend retorna 422. Frontend: 'Este contato já está associado a outra conta.' | ✓ |
| Bloqueia antes de enviar OTP | Backend valida existência antes de enviar OTP. | |
| OTP enviado mesmo assim, erro só ao confirmar | Erro de conflito só aparece na etapa de confirmar. | |

**User's choice:** Erro genérico sem confirmar se existe

---

## Carregamento dos dados do perfil

### Quando buscar dados do perfil?

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch ao abrir a tela | GET /client/profile toda vez que a tela monta. Dados sempre frescos. AuthUser não muda. | |
| Enriquecer AuthUser no login | Após autenticar, buscar perfil completo e incluir no AuthUser do localStorage. | ✓ |

**User's choice:** Enriquecer AuthUser no login

---

### Quais campos adicionar à interface AuthUser?

| Option | Description | Selected |
|--------|-------------|----------|
| Todos os campos editáveis | phone?, email?, cpf, birthDate, condominiumId, condominiumName, apartment, block?. | ✓ |
| Só os visíveis na tela | Sem condominiumId (interno). Mais enxuto. | |

**User's choice:** Todos os campos editáveis

---

### Após salvar uma edição — atualizar AuthUser?

| Option | Description | Selected |
|--------|-------------|----------|
| Sim — atualiza AuthUser imediatamente | AuthContext ganha updateUser(). Semelhante ao updateCreditBalance() existente. | ✓ |
| Não — faz refetch do perfil ao voltar | Navega de volta e faz novo GET /client/profile. Mais simples, gera flash de loading. | |

**User's choice:** Sim — atualiza AuthUser imediatamente após salvar

---

## Comportamento ao mudar condomínio

### Aviso de desativação de agenda — antes ou depois?

| Option | Description | Selected |
|--------|-------------|----------|
| Warning antes de confirmar | Dialog: 'Mudar de condomínio vai desativar sua agenda semanal. Deseja continuar?' | ✓ |
| Notificação após salvar | Toast/banner após mudar. Mais fluido, mas já é tarde para cancelar. | |

**User's choice:** Warning antes de confirmar

---

### Campo 'Bloco' no seletor de condomínio

| Option | Description | Selected |
|--------|-------------|----------|
| Condicional por tipo do condomínio | Aparece só se condomínio for BLOCKS. Mesmo padrão do cadastro (OnboardingScreen). | ✓ |
| Sempre mostrar Bloco | Campo sempre visível, mas opcional. Inconsistente com o cadastro. | |

**User's choice:** Condicional por tipo (mesmo padrão do OnboardingScreen)

---

### Após confirmar mudança de condomínio — o que acontece com a agenda?

| Option | Description | Selected |
|--------|-------------|----------|
| Banner na ScheduleScreen | Aviso contextual na agenda: 'Você mudou de condomínio. Configure sua nova agenda semanal.' | ✓ |
| Navega direto para a agenda | App navega automaticamente para ScheduleScreen com toast. Mais proativo. | |

**User's choice:** Banner na ScheduleScreen

---

## Claude's Discretion

- Design visual das seções da SettingsScreen (fundo creme, headers espresso — padrão do projeto)
- Ícone exato de "perfil" para o 5º tab (escolher do conjunto de ícones existente)
- Validações de campo inline (formato de data, tamanho mínimo de nome)
- Mensagens de erro e toast de sucesso — padrão visual das outras telas
- Como detectar "usuário mudou de condomínio" para exibir banner na ScheduleScreen

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
