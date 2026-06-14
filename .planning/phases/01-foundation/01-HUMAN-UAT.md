---
status: partial
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-06-13T23:55:00Z
updated: 2026-06-13T23:55:00Z
---

## Current Test

[aguardando testes manuais]

## Tests

### 1. npm run dev inicia ambos os apps
expected: `npm run dev` na raiz do projeto inicia apps/web (porta 5173) e apps/api (porta 3001) sem erros
result: [pending]

### 2. GET /health retorna 200 com MongoDB Atlas conectado
expected: Com DATABASE_URL válida em apps/api/.env, `curl http://localhost:3001/health` retorna `{"ok":true,"db":"connected"}`
result: [pending]

### 3. Android Chrome mostra banner de instalação nativa
expected: Ao acessar http://localhost:5173 no Android Chrome, aparece o banner nativo "Adicionar à tela inicial"
result: [pending]

### 4. iOS Safari mostra bottom sheet de instalação
expected: Ao acessar http://localhost:5173 no iOS Safari, aparece o bottom sheet customizado com 3 passos e botão "Entendi"
result: [pending]

### 5. SplashScreen com fidelidade visual correta
expected: Fundo espresso (#1E1207), BreadMark dourado (4 caminhos), fonte Bricolage Grotesque 32px no nome do app, card de instalação branco no fundo
result: [pending]

### 6. PWA manifest visível no Chrome DevTools
expected: Chrome DevTools → Application → Manifest mostra name: "Cheirin de Pão", theme_color: #1E1207, display: standalone
result: [pending]

### 7. Dois service workers registrados em escopos separados
expected: Chrome DevTools → Application → Service Workers mostra SW em scope `/` e SW em scope `/push/onesignal/`
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
