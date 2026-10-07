---
name: pronto-para-deploy
description: Analisa a branch atual contra a produção (origin/main) e diz se está pronta para deploy, com o que fazer antes, durante e depois. Use sempre que o usuário perguntar "pronto para deploy?", "posso fazer deploy?", "está ok para subir?" ou pedir uma checagem pré-deploy.
---

# Pronto para deploy?

Análise **somente leitura** da branch atual. Nunca commitar, dar push, abrir PR, fazer merge, rodar
`prisma db push` ou mexer em produção — só relatar. (Regra do CLAUDE.md: commit/push só com pedido
explícito.)

## Como o deploy funciona neste repo (base da análise)

- Produção = branch `main`. Fluxo: branch de feature → `development` → `main`.
- `.github/workflows/mainBackend.yml` e `mainFrontend.yml` disparam **juntos** no push da `main`.
  - Backend: `npm install` → `prisma generate` → **testes da API** → build → release → imagem → Ansible
    → `prisma db push` (sem `--accept-data-loss`) depois do `up -d`.
  - Frontend: **não roda testes** → release → imagem (nginx) → Ansible. Por isso costuma ir ao ar
    **antes** da API nova.
- Variáveis entram como secrets do GitHub (`*_PROD`) escritos no `.env.production` pelos workflows.
  As `VITE_*` entram no build do front: secret criado depois exige novo deploy do front.
- Índices que o Prisma não expressa (únicos parciais) ficam em `apps/api/src/lib/ensure-indexes.ts`
  e são criados no boot.
- Checklists de deploy por feature ficam em `.projeto/docs/checklist-deploy-*.md`; planos em
  `.projeto/docs/plano-*.md`.

## Passos

Rode os independentes em paralelo. Salve logs no scratchpad da sessão, não no repo.

### 1. Contexto
- `git fetch origin`; branch atual; `git status -sb` (alterações não commitadas **não** vão no
  deploy; branch não enviada ao remoto também não).
- `git log --oneline origin/main..HEAD` e `git diff --stat origin/main...HEAD`, agrupado por área
  (`apps/api`, `apps/web`, `packages/shared`, `.github`, `ansible`, docs).
- Se `origin/development` estiver à frente de `origin/main`, avisar que o deploy levará também o
  que já está em `development`.

### 2. Verificações automáticas (obrigatórias)
```bash
(cd apps/api && npx tsc --noEmit)
(cd apps/web && npx tsc --noEmit)
(cd packages/shared && npx tsc --noEmit)
(cd apps/api && npx vitest run)
(cd apps/web && npx vitest run)        # o CI NÃO roda estes
(cd packages/shared && npx vitest run)
(cd apps/web && npx vite build)
(cd apps/api && npx tsup)
```
Os testes podem levar alguns minutos: rodar em segundo plano e seguir com os passos 3–8.
Se houver checklist com tabela de "números esperados", comparar a contagem de testes.

### 3. Banco (Prisma + MongoDB Atlas)
`git diff origin/main...HEAD -- apps/api/prisma/schema.prisma` e classificar:
- **Seguro:** campo opcional novo, coleção nova, índice novo em coleção nova, valor novo de enum.
- **Atenção:** `@unique`/`@@unique` novo em coleção que já tem dados (o `db push` falha se houver
  duplicata; conferir antes no Atlas); campo opcional → obrigatório; tipo alterado.
- **Quebra / exige migração:** campo, modelo ou valor de enum removido/renomeado; índice removido
  (o push sem `--accept-data-loss` falha).
- **Rollback:** valor novo de enum gravado no banco quebra a leitura na API antiga ("Value not
  found in enum"). Apontar quais modelos usam o enum.
- Diff de `ensure-indexes.ts`, `bootstrap/*` e scripts de backfill: o que roda no boot e qual log
  esperar.

### 4. Variáveis e secrets
- Variáveis novas nas linhas adicionadas: `process.env.X`, `env.X`/config da API,
  `import.meta.env.VITE_X` do front.
- Conferir se cada uma está nos dois workflows (`*_PROD`) e se tem padrão seguro quando ausente.
- `gh` pode não estar instalado: a existência dos secrets no GitHub vira **conferência manual**.

### 5. Compatibilidade entre versões (janela do deploy)
- Rotas da API **removidas ou alteradas**: `git diff origin/main...HEAD -- 'apps/api/src/**/*.route.ts'`.
  Para cada uma, `git grep -n '<rota>' origin/main -- apps/web/src`. Se o front antigo usa, quebra
  até o front novo subir.
- Rotas **novas** que o front novo chama: quebram enquanto a API antiga estiver no ar. Como o front
  sobe primeiro, avaliar o impacto (telas de cliente, entregador, admin) e recomendar o horário.
- Mudança de formato de payload/resposta em rota existente.
- PWA/service worker: o usuário precisa fechar e abrir o app para pegar a versão nova.

### 6. Dependências e infraestrutura
- `package.json` de cada app: dependências novas estão no `package-lock.json`.
- `Dockerfile`, `docker-compose`, `vite.config.ts` (PWA, precache), `ansible/`, `.github/`.
- Cron (`apps/api/src/plugins/cron.ts`): jobs novos, horário e log esperado.
- Serviços externos novos (S3, OSRM, Nominatim, Mercado Pago, OneSignal): acesso de saída da VPS,
  permissões IAM, políticas de bucket.

### 7. Higiene nas linhas adicionadas (fora de testes e scripts)
`console.log`, `debugger`, `.only(`, `.skip(`, `TODO/FIXME`, `localhost`, credenciais (`AKIA…`,
`mongodb+srv://user:pass@`, `APP_USR-`, chaves privadas) e arquivos grandes adicionados.

### 8. Checklist e planos da feature
- Procurar `.projeto/docs/checklist-deploy-*.md` e planos citados nos commits ou no diff. Ler as
  seções de antes/durante/depois e listar os itens **não marcados**, separando os que dependem do
  usuário (UAT em aparelho, secrets, AWS, avisos à equipe).
- Apontar o que ficou desatualizado no checklist em relação ao código (contagem de testes,
  coleções, ordem do deploy, rollback). Só editar o checklist se o usuário pedir.

## Formato da resposta (em português)

1. **Veredito** numa linha: ✅ Pronto · ⚠️ Pronto com ressalvas · ❌ Não pronto, com o motivo
   principal.
2. **Verificações automáticas:** tabela (typecheck, testes com contagens, builds) com ✅/❌.
3. **Bloqueios**, se houver: o que impede o deploy e como resolver.
4. **Antes do deploy:** passos concretos, os manuais primeiro.
5. **Durante:** ordem, horário recomendado, o que acompanhar no Actions.
6. **Depois:** conferências técnicas (logs de boot/cron, Atlas, telas) e configurações no admin.
7. **Se precisar voltar atrás:** o que o rollback exige.

Citar arquivos como links markdown relativos. Ser direto: nada de repetir o checklist inteiro,
apontar para a seção (ex.: "§2.4 do checklist") e destacar só o que está pendente ou é novo.
