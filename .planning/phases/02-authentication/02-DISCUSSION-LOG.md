# Phase 2: Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 2-Authentication
**Areas discussed:** Sessão + token, OTP provider, Detecção de dispositivo, Bootstrap do Admin

---

## Sessão + token

| Option | Description | Selected |
|--------|-------------|----------|
| Session token no banco | Registro Session no MongoDB com userId, token hashed, deviceId, lastUsedAt, expiresAt, isRevoked | ✓ |
| JWT stateless + refresh token | Access token curto + refresh token longo. Sem coleção Session mas dificulta revogação e detecção de troca de dispositivo | |

**User's choice:** Session token no banco

---

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage | Token enviado como Bearer no Authorization header. Simples, funciona cross-origin. XSS risk baixo neste contexto. | ✓ |
| httpOnly cookie | Mais seguro contra XSS, mas requer configuração de CORS com credentials e SameSite | |

**User's choice:** localStorage

---

| Option | Description | Selected |
|--------|-------------|----------|
| Coleção OtpCode no Prisma | Modelo separado: userId, code hashed, channel, expiresAt, usedAt | ✓ |
| Embutir em SETTINGS | Guardar como registros chave-valor na coleção Setting existente | |

**User's choice:** Coleção OtpCode separada no Prisma

---

## OTP provider

| Option | Description | Selected |
|--------|-------------|----------|
| Twilio | API madura, SDK Node.js oficial, mais caro no Brasil (R$0,30-0,40/SMS) | |
| Zenvia | Provider brasileiro, preços locais (R$0,05-0,15/SMS), API REST sem SDK oficial | ✓ |
| Vonage / Infobip | Alternativas internacionais com cobertura no Brasil | |

**User's choice:** Zenvia
**Notes:** Usuário perguntou por opções gratuitas. Não há SMS gratuito em produção. Zenvia escolhido por preço local.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Resend | 3.000 e-mails/mês grátis, SDK Node.js moderno, React Email templates | ✓ |
| SendGrid | 100 e-mails/dia grátis, mais estabelecido, interface mais complexa | |

**User's choice:** Resend

---

| Option | Description | Selected |
|--------|-------------|----------|
| Código fixo via env var | OTP_DEV_CODE=1234, aceito em NODE_ENV=development. Zero custo e latência. | ✓ |
| Logar no console da API | Código impresso no terminal em vez de enviado | |

**User's choice:** Código fixo via env var (OTP_DEV_CODE=1234)

---

## Detecção de dispositivo

| Option | Description | Selected |
|--------|-------------|----------|
| Device token no localStorage | UUID v4 gerado no primeiro acesso, salvo em localStorage como device_id. Session salva o deviceId. | ✓ |
| Fingerprint de userAgent + idioma + timezone | Hash de propriedades do navegador. Pode gerar falsos positivos quando o browser atualiza. | |

**User's choice:** Device token no localStorage

---

| Option | Description | Selected |
|--------|-------------|----------|
| Invalida sessão + pede OTP | Session revogada (isRevoked: true), frontend redireciona para login com novo OTP | ✓ |
| Permite mas gera alerta | Acesso permitido mas usuário notificado de novo dispositivo | |

**User's choice:** Invalida sessão + pede OTP

---

## Bootstrap do Admin

| Option | Description | Selected |
|--------|-------------|----------|
| Seed script via npm | npm run seed:admin lê env vars e cria Admin se não existir. Explícito, ideal para produção. | |
| Env var + criação automática no boot | Servidor cria Admin automaticamente no start se ADMIN_PHONE/ADMIN_EMAIL existem e não há Admin no banco | ✓ |

**User's choice:** Env var + criação automática no boot

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fase 2 inclui cadastro de entregador (AUTH-07) | Tela de cadastro de entregador pelo Admin incluída na Fase 2 — necessária para Success Criteria #4 | ✓ |
| Cadastro de entregador fica na Fase 7 | Apenas login do entregador na Fase 2; cadastro vai para o Admin Panel | |

**User's choice:** Fase 2 inclui cadastro de entregador

---

## Claude's Discretion

- Estrutura interna do módulo auth (controller/service/repository) — Clean Architecture conforme padrão Fase 1
- Hash do session token — `crypto.randomBytes(32).toString('hex')` + `sha256` no banco
- Gestão de estado de auth no frontend — React Context com `AuthProvider`
- Tab bar e navegação inferior — não implementar na Fase 2 (escopo Fases 3+)

## Deferred Ideas

- Múltiplos dispositivos simultâneos — política atual revoga ao detectar device_id diferente; suporte a múltiplos devices é uma evolução futura
- Logout explícito — não é requisito desta fase; candidato para Fase 5 ou 7
- Rate limiting de OTP por número — boa prática de segurança, defer para pós-MVP
