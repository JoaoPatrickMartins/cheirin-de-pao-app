# Plano — Página "Sobre" (apresentação pública) + verificação da marca no Google

> 📝 **Status:** PLANEJADO em 01/10/2026 — nenhuma linha de código ainda. Execução direta, sem GSD
> (convenção do projeto). Tem tela nova → **Onda 1 é o design**, com o brief pronto em
> [`../brief-telas-pagina-sobre.md`](../brief-telas-pagina-sobre.md).
>
> ✅ **Onda 1 (design) CONCLUÍDA em 01/10/2026:** handoff em
> [`../design_handoff_pagina_sobre/`](../design_handoff_pagina_sobre/README.md). **Implementar a
> v2** (§A do README), com a base v1 (§B) valendo para o resto. Conferido contra este plano: os
> dados dinâmicos, o item 8 fora do HTML, o WhatsApp no build, o `<details>` no FAQ, os links e os
> textos batem. As pontas soltas viraram as decisões D-9 a D-11.
>
> ✅ **Ondas 2–5 CONCLUÍDAS em 01/10/2026 — SEM COMMIT.**
> - **API:** `modules/public-landing/` (`GET /public/landing`), registrado no `server.ts`.
> - **Página:** `apps/web/sobre/index.html`, `src/sobre/{sobre.css,landing.ts,main.ts}` e o print
>   em `src/sobre/assets/`. É a 2ª entrada do Vite, e o plugin `sobreSemPwa` tira dela o
>   `manifest` e o `registerSW`.
> - **Splash:** link B1 + ícone `arrowR`.
> - **Testes:** API 1.736 + 3 todo (+17) · web 417 + 17 todo (+21) · typecheck api + web ✅ ·
>   `vite build` ✅.
> - **Conferido no Chrome em tempo real:**
>   - capturas em 390 e 1280 contra o handoff;
>   - entradas na rolagem e topo sólido;
>   - push aos ~3 s e contagens;
>   - com JavaScript desligado, nada escondido e 7 itens no FAQ;
>   - troca dinâmica com resposta simulada da API: turno, item 8 e o topo de quem tem sessão.
>
> **Pendente:**
> - a Onda 6 (deploy, conferências em produção, trocar a URL no Branding e pedir nova
>   verificação).
>
> ⚠️ **Documento temporário de planejamento.** Apagar quando o trabalho for mergeado.

---

## 1. Por quê

A verificação da marca no Google Auth Platform (projeto `cheirin-de-pao`) foi reprovada em
01/10/2026 com três problemas. **Enquanto ela não passa**, a tela "Continuar com o Google" não
mostra o nome e o logo do Cheirin. O login funciona mesmo assim, porque os escopos são só
`openid`/`email`/`profile`.

| # | Problema do Google | Situação |
|---|---|---|
| 1 | "O site da sua página inicial não está registrado para você" | ✅ **Resolvido em 01/10/2026** — `cheirindepao.com.br` verificado no Search Console (propriedade de domínio, TXT na Cloudflare, conta `cheirindepao.contato@gmail.com`). **Não apagar o TXT `google-site-verification=…`.** |
| 2 | "Sua página inicial está protegida por uma página de login" | ⏳ Este plano. Hoje `https://app.cheirindepao.com.br` abre a splash, que só tem "Entrar" e "Criar conta", e o HTML vem vazio (`<div id="root">`). |
| 3 | "A página inicial não explica a finalidade do app" | ⏳ Este plano. Mesma causa. |

> **Fora deste plano, já corrigido em 01/10/2026:** a falha do login com Google ("Demorou um
> pouquinho.") era um bug do front, sem relação com a verificação. O detalhe está em
> [`plano-login-social.md`](./plano-login-social.md), §18.

---

## 2. Decisões (confirmadas com o usuário em 01/10/2026)

| # | Decisão |
|---|---|
| D-1 | **Endereço:** `https://app.cheirindepao.com.br/sobre/`, uma página **estática**, entregue pelo mesmo deploy do front. É a URL que vai em Branding › "Página inicial do aplicativo". |
| D-2 | **Visual pelo Claude Design** (brief → handoff → implementação), com fidelidade alta. Mobile 390 e desktop 1280. |
| D-3 | **Conteúdo:** <br>• o que é o app; <br>• como funciona em 3 passos; <br>• pãezins, combos, agenda e compra automática; <br>• gancho na porta; <br>• Além do Pãozin; <br>• FAQ; <br>• login com Google e os dados recebidos; <br>• contato; <br>• links de Privacidade e Termos; <br>• botões Entrar e Criar conta. |
| D-4 | **FAQ:** <br>• pãezins (moeda: 1 pãozin = 1 pão, pagam também o Além do Pãozin, não expiram); <br>• combos; <br>• agenda semanal ligada ao saldo; <br>• compra automática com cartão cadastrado; <br>• horário de corte; <br>• pausa; <br>• condomínio não atendido; <br>• Indique e Ganhe. |
| D-5 | **Turnos:** a página diz quais turnos existem **sem horário exato**. Um turno conta como ativo quando está **ativo em pelo menos um condomínio ativo**. O dado vem da API. |
| D-6 | **Indique e Ganhe:** só aparece **quando o programa está ligado**, com os valores (quanto ganha quem indica e, se houver, o bônus do amigo), lidos da API. |
| D-7 | **Contato:** e-mail `cheirindepao.contato@gmail.com` + WhatsApp, com **o mesmo número do app** (`VITE_SUPPORT_WHATSAPP`). O usuário confirmou que o secret de produção já tem o número real. |
| D-8 | **Extras:** <br>• seção do gancho na porta; <br>• seção do Além do Pãozin; <br>• link "Conheça o Cheirin" na splash do app, levando a `/sobre/`. Muda uma tela existente, mas é só front. |
| D-9 | **Foto do gancho (S5):** recebida em 01/10/2026 e salva em `src/sobre/assets/gancho.jpg` (899 × 1599, retrato, 80 KB). Enquadrada com `object-position: 50% 35%`. No mobile, o bloco usa `aspect-ratio: 1.1` (a proporção do desktop) em vez dos 280 px do handoff: com altura fixa e foto em retrato, telas entre 390 e 820 px cortavam o gancho. A foto mostra o gancho sem a sacola, e o `alt` descreve o que aparece nela. |
| D-10 | **Quem já está logado:** se há sessão salva no aparelho (as chaves do `AuthContext` no `localStorage`), o topo esconde "Entrar" e "Criar conta" e mostra só o botão dourado **"← Voltar ao app"** (ajuste do usuário em 01/10/2026; antes era "Abrir o app" no lugar do "Entrar"). O botão volta para a tela do app de onde a pessoa veio (`document.referrer` da mesma origem, por exemplo o Perfil); sem isso, vai para `/`. Ele já vem no HTML com `hidden`, para o robô e quem não tem sessão verem Entrar e Criar conta. O resto da página não muda. |
| D-11 | **Passo 3 (S3)** com texto fixo, sem a frase do turno. **Celular do hero** feito em HTML/CSS, como o mock do handoff, para animar por dentro (contagem, cascata e push). |
| D-12 | **Entradas no app (01/10/2026, pedido do usuário):** <br>• Perfil › **Ajuda**: linha "Saber mais sobre o Cheirin" ("Como funcionam os pãezins, a agenda e o gancho", ícone `info`), logo depois de "Rever tutorial". Abre a `/sobre/` na mesma janela; para voltar, o topo dela mostra "Voltar ao app" a quem tem sessão (D-10). <br>• O link da splash passou a ser **"Saiba como o Cheirin funciona →"**, mais claro que "Conheça o Cheirin". <br>• O login ficou como está. |
| D-13 | **Fim do tutorial (01/10/2026, escolha do usuário: card final):** o aviso "Bem-Vindo ao Cheirin de Pão!" de 1,8 s virou um card (`TourEndCard`, em `AppTour.tsx`) que espera a escolha: <br>• **"Começar a usar"** é o botão principal (espresso, em cima, com o foco) e fecha; Esc ou toque no fundo fazem o mesmo; <br>• **"Saber mais sobre o Cheirin →"** é o link discreto embaixo e abre a `/sobre/` (o usuário pediu essa ordem de prioridade). <br>Só aparece quando a pessoa conclui o tour; o "Pular" continua encerrando direto. No "Saber mais", o `finishTour('sobre')` espera o POST `/client/onboarding/complete` (teto de 2,5 s) antes de sair, porque sem ele o GET do próximo acesso reexibiria o tutorial. A fase fica em `tour` até a página abrir, para o modal do gancho não piscar. |

---

## 3. O que já existe (levantamento de 01/10/2026)

- **Nginx de produção** (config não versionada no repo): `/assets/` responde **403**, sinal de que
  o `try_files` tenta `$uri/`. Então um `sobre/index.html` no `dist` é servido **como arquivo**, sem
  cair no `index.html` do SPA. `/sobre` (sem barra) deve redirecionar com 301 para `/sobre/`, e
  isso precisa ser **conferido depois do deploy**. No Google vai a URL **com a barra**.
- **Service worker** (`src/sw.ts`, `injectManifest`): só faz `precacheAndRoute`, sem rota de
  navegação. O `sobre/index.html` entra no precache, e o `directoryIndex` do Workbox serve
  `/sobre/` a partir dele. Então quem tem o PWA instalado recebe a página certa.
- **Rotas públicas na API:** **não há** nenhuma que diga quais turnos estão ativos ou se o Indique
  e Ganhe está ligado. `/condominiums/me/slots` e as rotas de indicação exigem login.
  - Peças prontas para montar a rota: `listActiveCondoSlots` (`lib/delivery-slots.ts:364`,
    condomínio ativo × turno ativo, com o valor efetivo herdado ou personalizado);
    `getReferralConfig` + `currentRewardBreads` (`lib/referral-config.ts:126,168`, que já aplica o
    multiplicador da campanha); `bonusIndicado` (bônus do amigo).
- **Fatos do app** que o texto usa (com as fontes no levantamento da conversa):
  - pãezins não expiram (`CombosScreen.tsx:247`);
  - 1 pãozin = 1 pão (`packages/shared/src/credits.ts`);
  - Pix pelo Mercado Pago e cartão pelo Stripe;
  - compra automática "recarregamos sozinho no seu cartão padrão — sem CVV" (`AutoBuyScreen.tsx`);
  - a pausa guarda a configuração e lembra depois de 7 dias (`cron.ts:45`);
  - o gancho é grátis com combo (`defaults-seed.ts:47-48`);
  - lista de espera em "Meu condomínio não está aqui" (`CondoSearch.tsx`);
  - dados do Google: identificador, nome e e-mail (`content/legal.ts:34`).
- **Splash** (`pages/splash/SplashScreen.tsx`): botão "Já tenho conta · Entrar" + link "Quero criar
  minha conta". O link B1 entra aqui.

---

## 4. Desenho técnico

### 4.1 API — `GET /public/landing` (rota nova, pública)
Resposta (só booleanos e números, **nada de horário nem nome de condomínio**):
```json
{
  "shifts": { "manha": true, "tarde": true },
  "referral": { "active": true, "reward": 5, "friendBonus": 0 }
}
```
- `shifts`: um turno é `true` quando aparece em `listActiveCondoSlots`. O turno é identificado pelo
  `slot.name` (`manha` | `tarde`), porque o `name` é imutável. Se não houver condomínio ativo,
  usar o padrão global (`getGlobalDeliverySlots`, só `isActive`), para não mostrar uma página "sem
  turno".
- `referral`: `active = config.ativa`. Com o programa ligado, `reward = currentRewardBreads(config)`
  e `friendBonus = config.bonusIndicado`. Com ele desligado, só `{ "active": false }`.
- Sem `preHandler` de autenticação; `rateLimit` 60/min; `Cache-Control: public, max-age=300`. A
  página não precisa de dado ao vivo.
- O response schema declara **todos** os campos (o Fastify descarta o que não estiver declarado,
  armadilha já conhecida no projeto).
- Lugar: um módulo novo, `modules/public-landing/` (route + service), registrado no `server.ts`.
  Se ficar só uma função, pode ficar no route.

### 4.2 Front — página estática `/sobre/`
- **Segunda entrada do Vite** (multi-página): `apps/web/sobre/index.html` +
  `build.rollupOptions.input = { main: 'index.html', sobre: 'sobre/index.html' }`. O `dist` sai com
  `sobre/index.html`, e o CSS e as fontes saem com hash em `/assets`. No dev, o Vite serve `/sobre/`
  direto.
- **Todo o texto vem no HTML**, já com o texto neutro do turno ("nos dias que você escolher") e o
  FAQ **sem** o item do Indique.
- **Script pequeno, sem React** (`src/sobre/main.ts`):
  1. chama `GET ${VITE_API_URL}/public/landing`;
  2. troca a frase do turno (manhã+tarde / só manhã / só tarde);
  3. insere o item do Indique quando `referral.active`;
  4. monta o link do WhatsApp com `VITE_SUPPORT_WHATSAPP`, com a mesma limpeza de dígitos do
     `lib/support.ts` (reaproveitar a função).

  Se a API falhar, a página fica como veio no HTML. Para o WhatsApp, deixar um `href` com o número
  no HTML (`%VITE_SUPPORT_WHATSAPP%`), assim o link funciona também sem JavaScript.
- **FAQ** com `<details>/<summary>` nativos: funciona sem JavaScript, por teclado, e o robô lê.
- **Estilo:** CSS próprio da página, com os tokens do app (mesmos valores de `globals.css`). Fontes
  pelas `@fontsource` já instaladas (Bricolage Grotesque + Hanken Grotesk), importadas pelo
  `main.ts`, para o Vite empacotar. Nada de Google Fonts: o app hospeda as próprias fontes.
- **`<head>`:**
  - `lang="pt-BR"`;
  - `<title>` com "Cheirin de Pão";
  - `meta description`, `og:title`, `og:description`, `og:image` (`pwa-512x512.png`);
  - `link rel="canonical"` para `https://app.cheirindepao.com.br/sobre/`;
  - favicon e `apple-touch-icon` como no `index.html`;
  - **sem** o `manifest` e **sem** registrar o SW. A página não é o app: se ela registrasse o SW,
    instalar a partir dela abriria `/`.
- **Links:** "Entrar" → `/login`, "Criar conta" → `/register`, `/privacidade` e `/termos`. São
  links `<a>` comuns, fora do router. O `RedirectIfAuthenticated` do app já leva quem está logado
  para a home.

### 4.3 Splash — link B1
Em `SplashScreen.tsx`, um `<a href="/sobre/">` discreto, conforme o handoff. Navegação de página
inteira, não `navigate()`, porque `/sobre/` não é rota do router.

---

## 5. Ondas

| Onda | O quê | Depende de |
|---|---|---|
| **1 — Design** | Colar o brief no Claude Design → handoff em `.projeto/design_handoff_pagina_sobre/` → conferir contra este plano. | — |
| **2 — API** | `GET /public/landing` + testes (seção 6). | — (pode correr junto da Onda 1) |
| **3 — Página** | `sobre/index.html` + `src/sobre/main.ts` + CSS + entrada no `vite.config.ts`, seguindo o handoff. | 1, 2 |
| **4 — Splash** | Link B1. | 1 |
| **5 — Verificação** | <br>• typecheck (api + web + shared), testes, `vite build`; <br>• conferir que o `dist/sobre/index.html` tem o texto **no HTML**; <br>• capturas em 390 e 1280 contra o handoff; <br>• com JavaScript desligado, a página continua completa. | 3, 4 |
| **6 — Lançamento** | <br>• deploy front + back (só com pedido explícito de commit/push); <br>• em produção: `curl` em `/sobre/` (200 + texto), em `/sobre` (301 → `/sobre/`) e em `/public/landing`; <br>• Google › **Branding** › "Página inicial do aplicativo" = `https://app.cheirindepao.com.br/sobre/`; <br>• **Ver problemas → "Corrigi os problemas" → Continuar**. | 5 |

---

## 6. Testes

- **API** (`public-landing`):
  - turnos: os dois ativos; só manhã; só tarde; tarde desligada por personalização num condomínio
    e ligada em outro (resultado `true`); condomínio inativo não conta; sem condomínio ativo, cai
    no padrão global;
  - indique: desligado → `{ active: false }`; ligado → `reward` com e sem campanha ativa e
    `friendBonus`;
  - a resposta nunca traz horário nem nome de condomínio;
  - a rota responde sem token.
- **Web** (`src/sobre/__tests__`):
  - frase do turno nos 3 casos; API fora do ar → texto neutro intacto;
  - item do Indique: aparece com `{N}`/`{Y}` e some quando desligado; sem bônus do amigo, a frase
    sai sem a 2ª parte;
  - o link do WhatsApp sai só com dígitos.
- **Splash:** o link "Conheça o Cheirin" aponta para `/sobre/`.

---

## 7. Riscos e armadilhas

- **Nginx sem `$uri/`:** se `/sobre/` cair no SPA em produção (o 403 em `/assets/` indica que não),
  o plano B é publicar também como `/sobre.html` e cadastrar essa URL no Google. Conferir na Onda 6.
- **Página nova no precache do SW:** o `sobre/index.html` entra no precache e atualiza com o SW
  (`skipWaiting`). Nada a fazer, só saber.
- **`vite-plugin-pwa` mexendo no HTML da página:** o plugin injeta o `<link rel="manifest">` e o
  `registerSW.js` pelo `transformIndexHtml`, que pode rodar em **toda** entrada HTML. Conferir o
  `dist/sobre/index.html` na Onda 5. Se aparecer, remover pela config do plugin ou por um pequeno
  plugin de pós-processamento.
- **O Google reprovar de novo** por algum detalhe: o texto precisa dizer claramente o que o app faz
  logo no primeiro bloco, e os links de Privacidade e Termos precisam estar visíveis. O nome
  "Cheirin de Pão" tem que bater com o do Branding. O Google pede para esperar a análise depois do
  envio.
- **Texto do app × página:** se o admin mudar regras (por exemplo, gancho grátis só por combo), o
  FAQ precisa acompanhar. Os pontos que mudam por configuração (turnos e Indique) já são dinâmicos.

---

## 8. Pendências fora do escopo (anotadas no levantamento)

- Razão social, CNPJ e endereço nas páginas legais (`content/legal.ts`, `TODO(jurídico)`), além do
  prazo de exclusão de 15 dias provisório.
- E-mail divergente `contato@cheirindepao.com.br` em `apps/api/src/lib/geocode.ts:43` (cabeçalho
  técnico, não aparece ao usuário).
- Textos técnicos desatualizados na documentação da API (`schedules.route.ts:35` com horários
  antigos; `payments.route.ts:14` dizendo que o Pix é "no Stripe").
- `Cheirin_de_Pao_Modelo_Funcionamento.md` com corte de 20h e débito depois da entrega. O código
  usa 22h e debita no corte.
