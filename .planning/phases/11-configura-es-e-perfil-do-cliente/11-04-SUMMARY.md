---
phase: 11-configura-es-e-perfil-do-cliente
plan: "04"
subsystem: frontend/settings-screens
tags: [frontend, ui, settings, otp, contact-change]
key-files:
  created:
    - apps/web/src/pages/client/SettingsScreen.tsx
    - apps/web/src/pages/client/ContactEditScreen.tsx
metrics:
  tasks_completed: 2
  tasks_total: 2
  commits: 1
---

# Plan 11-04 Summary — SettingsScreen + ContactEditScreen

## What Was Built

### SettingsScreen

Tela de configurações com 4 seções em cards:

- **Dados Pessoais**: nome (editável), data de nascimento (editável), CPF (readonly, opacity 0.7, cursor not-allowed, texto auxiliar 'O CPF não pode ser alterado.') — CONF-03
- **Contato**: exibe phone e email do AuthContext; botão 'Editar contato' navega para `/client/perfil/editar-contato`
- **Condomínio**: CondoSearch pré-selecionado, campo apartamento, campo bloco condicional (apenas quando condo.type === 'BLOCKS'); botão 'Salvar endereço' detecta mudança de condominiumId e exibe dialog de confirmação antes do PATCH — D-17
- **Conta**: botão 'Sair' chama `auth.logout()` diretamente SEM dialog — D-09, CONF-07

Após PATCH com scheduleDeactivated: updateUser inclui condominiumJustChanged: true.

### ContactEditScreen

Wizard de 2 steps inline com fade + translateY(-8px) transition 150ms:

- **Step 1**: ChannelToggle SMS/E-mail (toggle customizado), input de contato, POST `/client/profile/contact/request-change`; erro 422 → 'Este contato já está associado a outra conta.' — D-12
- **Step 2**: OtpInput 4 dígitos, ResendTimer, POST `/client/profile/contact/confirm-change`; em sucesso: updateUser + navigate('/client/perfil'); botão 'Confirmar código' também disponível

Botão voltar no AppBar chama `navigate(-1)`.

## Commits

| Commit | Descrição |
|--------|-----------|
| `a5a17f5` | feat(11-04): SettingsScreen + ContactEditScreen |

## Deviations

- `ChannelToggle` implementado inline em vez de importar `ChannelSelector` — o `ChannelSelector` existente requer props `phone`/`email` para controlar disabled state, mas em ContactEditScreen o usuário está inserindo o novo contato (não o atual), então um toggle simples sem disabled state é mais adequado.

## Self-Check

- [x] `npx tsc --noEmit` — zero erros
- [x] CPF com `readOnly` + `cursor: 'not-allowed'` + texto auxiliar (CONF-03 ✓)
- [x] `auth.logout()` sem dialog no botão Sair (D-09 ✓, CONF-07 ✓)
- [x] Dialog 'Mudar de condomínio' com texto correto antes de PATCH (D-17 ✓)
- [x] Erro 422 → 'Este contato já está associado a outra conta.' (D-12 ✓)
- [x] `navigate(-1)` no AppBar de ContactEditScreen (D-03 ✓)
- [x] `updateUser` após confirmação OTP + navigate para /client/perfil (D-14 ✓)

**Self-Check: PASSED**
