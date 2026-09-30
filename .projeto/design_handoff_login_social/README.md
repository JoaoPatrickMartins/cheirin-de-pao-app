# Handoff: Entrar com Google ou Facebook (Cheirin de Pão)

## Sobre os arquivos deste pacote
Os arquivos em `design/` são **referências de design feitas em HTML/React (Babel no navegador)**. Eles mostram o visual e o comportamento esperados. **Não são código de produção para copiar.** A tarefa é **recriar essas telas no código real do app**, usando os padrões e componentes que ele já tem. Os mocks de `data.jsx` indicam o formato dos dados, que deve vir do backend.

## Fidelidade
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, raios, sombras, textos e estados são finais. Exceção: os botões do Google e do Facebook seguem a marca de cada provedor (ver §5).

## Como abrir as referências
- `design/Login Social - Telas.html`: quadro com **todas as telas e estados** (L1–L9, A1). Dá para mover, dar zoom e focar cada quadro.
- `design/Cheirin de Pão - App.html`: protótipo navegável com a feature integrada (Cliente: Boas-vindas › Instalar e criar conta / Já tenho conta; Perfil › Minha conta; Perfil › Ajuda › Privacidade e termos).

## Capturas
`screenshots/` traz uma imagem por grupo, com todos os estados lado a lado:
- `00-kit.png` — botões dos provedores, divisor, consentimento, pill, aviso, ícones novos
- `01-l1-login.png`
- `02-l2-entrada-cadastro.png`
- `03-l3-retorno-erros.png`
- `04-l4-cadastro-social.png`
- `05-l5-confirmar-email.png`
- `06-l6-encontramos-sua-conta.png`
- `07-l7-contas-conectadas.png`
- `08-l8-criar-senha.png`
- `09-l9-paginas-publicas.png`
- `10-a1-admin-acesso.png`

Os nomes dos estados correspondem aos valores de `st` / `conn` / `kind` dos componentes.

---

**Arquivos da feature**
- `design/app/screens-social-auth.jsx` — kit (`GoogleG`, `FacebookF`, `ProviderLogo`, `ProviderTile`, `SocialBtn`, `SASocialStack`, `SAInAppNotice`, `SADivider`, `SAConsent`, `SAProviderPill`, `SANotice`, `SAField`, `SAShow`, `SACodeBoxes`, `SABack`, `SATitle`, `SASub`, `SALink`, `SASpinner`) e as telas **L1** `LoginSocial`, **L2** `RegisterChoice`, **L3a** `SAConnecting`, **L3b** `SASafariDone`, **L3c** `SAError` (+ `SA_ERRORS`).
- `design/app/screens-social-auth2.jsx` — **L4** `SocialStep1` (+ `SADots`), **L5** `SAEmailConfirm`, **L6** `SAFoundAccount`.
- `design/app/screens-social-auth3.jsx` — **L7** `MyAccount`, `ConnectedRow`, `SADisconnectSheet`; **L8** `CreatePassword`; **L9** `LegalPage` (+ `SA_LEGAL`), `LegalHub`; **A1** `SAAccessRow`.
- **Integrações:**
  - `design/app/app.jsx` — rotas `login` (L1), `register` (L2), `connecting`, `fbEmail`, `socialReg`, `account`, `createPw`, `legal`, `legal-privacy`, `legal-terms`, `legal-delete`; "Instalar e criar conta" agora leva a `register`.
  - `screens-onboarding.jsx` — `OnboardingScreen` aceita `social` (prefill): sequência `'s' → 2 → 3` com 3 dots; o botão do passo 3 vira **"Criar conta e ver meu pão"** e não pede código. Props `initStep`/`initCondo` só para o quadro.
  - `screens-referral2.jsx` — Perfil: "Minha conta" abre `account`; nova linha **"Privacidade e termos"** em Ajuda.
  - `screens-referral-admin2.jsx` — `RAClientGeral` aceita `acesso` e mostra a linha **Acesso**.
  - `brand.jsx` — ícones novos; `data.jsx` — mocks da §2.

> Todo componente aceita `st` / `conn` / `kind` para forçar um estado. No app real, o estado vem dos dados.
> O `LoginScreen` antigo (SMS) continua no arquivo, mas não é mais roteado.

---

## 1. Conceito e regras

- **Só clientes.** Entregador e admin entram com e-mail e senha. Se uma conta dessas tentar pelo Google/Facebook → L3c `role`.
- **Primeiro acesso pelo Google:** recebe nome + e-mail (e-mail já confirmado). Cliente completa CPF, nascimento, celular (L4 passo 1), condomínio (passo 2) e endereço (passo 3). **Sem senha, sem código.**
- **Primeiro acesso pelo Facebook:** antes do L4, confirma o e-mail com código de 4 dígitos (L5). Se o Facebook não mandar e-mail → L5b pede o e-mail.
- **E-mail já tem conta:** L6 "Encontramos sua conta" — confirma com a **senha** ou com **código no e-mail**. Conta sem senha → só código.
- **Próximos acessos:** um toque no botão → L3a → Home.
- **Conta social não tem senha.** Pode criar depois (L8). Código no e-mail sempre funciona.
- **Desconectar nunca tranca a conta** (código no e-mail é o fallback permanente). Não é preciso bloquear a desconexão do último provedor.
- **Indicação:** selo "Indicado por…" também no L2 e no L4; bônus vale igual.
- **iPhone (PWA instalado):** o login abre numa janela do Safari. Ao terminar, a janela mostra L3b; o app fica em L3a e entra sozinho ao voltar para o primeiro plano (checar sessão no `visibilitychange`).
- **Navegador do Instagram/Facebook:** o Google bloqueia. No lugar do botão do Google, `SAInAppNotice` com "Copiar link". Facebook normal.
- **Privacidade:** `SAConsent` abaixo dos botões sociais (L1 e L2). Páginas L9 são públicas (sem login).

## 2. Modelo de dados (mock → backend)

```js
SOCIAL_PROVIDERS = { google: true, facebook: true }          // config do admin/env; controla L1/L2
SOCIAL_PREFILL   = { provider: 'google', name: 'Marina Ribeiro', email: 'marina.ribeiro@gmail.com' }
SOCIAL_PREFILL_FB= { provider: 'facebook', name: 'Ana Costa', email: 'ana@exemplo.com' } // email pode vir null
SOCIAL_LINK      = { maskedEmail: 'ma•••@gmail.com', canUsePassword: true }
CONNECTED_ACCOUNTS = [{ provider: 'google', email: 'marina.ribeiro@gmail.com', linkedAt: '30/09' }]
```
Backend sugerido:
```
SocialIdentity { id, clienteId, provider: 'google'|'facebook', providerUserId, email, linkedAt }
Cliente { …, hasPassword: boolean }   // define L8 e as opções do L6
Admin › detalhe: acesso = [...identities.map(i => i.provider), hasPassword && 'senha']
```
Retorno do provedor → um destes resultados, cada um com sua tela:
`ok_login` → Home · `new_user` → L4 (Google) / L5 (Facebook) · `link_required` → L6 · `cancelled` → L1 com aviso ou L3c `cancel` · `blocked` · `role_not_allowed` · `expired` · `provider_error` · `already_linked` (Perfil).

## 3. Telas

### Kit
- **`SocialBtn`** `provider` · `state: idle | loading | disabled`. 54 px, raio 16, largura total.
  - Google: fundo `#FFFFFF`, borda 1 px `#747775`, texto `#1F1F1F`, **Roboto Medium 15,5**, logo "G" 20 px.
  - Facebook: fundo `#1877F2`, texto branco, Hanken 700, "f" branco (vazado) 20 px.
  - Loading: spinner no lugar do logo + "Abrindo o Google…"; os demais controles da tela ficam desabilitados (opacidade .45).
- **`SADivider`** "ou com e-mail" (L2 usa "ou").
- **`SAConsent`** — "Ao continuar, você concorda com os **Termos de Uso** e a **Política de Privacidade**." 12 px, links sublinhados accent.
- **`SAProviderPill`** — logo + e-mail travado + "via Google · e-mail confirmado" + cadeado.
- **`SANotice`** — tons `warn` (goldSoft), `danger` (dangerSoft), `good`.

### L1 · Login (`/login`)
Ordem: voltar → "Bom dia.\nBora entrar." → texto → **[erro]** → Google → Facebook → divisor → E-mail → Senha (Mostrar/Ocultar) → **Entrar** → "Esqueci minha senha" · "Entrar com código no e-mail" → consentimento.
- Texto com social: "O jeito mais rápido é com um toque. Se preferir, use seu e-mail — com senha ou com um código." Sem social: texto de hoje.
- Estados: `both` · `google` · `none` (igual hoje, sem divisor nem consentimento) · `loading` · `inapp` · `errCancel` ("Não deu certo desta vez." / "Você cancelou o login com o Google.") · `errFail` ("Não foi possível falar com o Google. Tente de novo.").
- Modo código: "Entrar com código." (e-mail) → "Digite o código." (4 dígitos, reenviar 0:28).

### L2 · Como você quer criar sua conta? (`/register`)
Voltar → selo de indicação (se veio pelo link) → título → "Crie em 1 minuto: a gente já puxa seu nome e e-mail, e você só completa o endereço." → Google → Facebook → "ou" → **Criar com e-mail** (ghost, vai ao passo 1 atual) → consentimento → rodapé "Já tem conta? Entrar".
- Estados: `ref` · `noref` · `google` · `inapp` · `loading`. Sem provedor ligado → rota vai direto ao `OnboardingScreen`.

### L3 · Retorno
- **L3a Conectando** — `BreadMark` em quadrado espresso com "respiração" (2,2 s), tile do provedor no canto, "Conectando com o Google…", "Termine na janela que abriu. A gente te espera aqui e entra sozinho.", botão soft **Cancelar**. `role=status aria-live=polite`.
- **L3b Pode voltar ao app** (janela do Safari; é uma página web, não o app) — barra do Safari ilustrativa, check verde, "Pronto!", "Pode voltar ao app Cheirin de Pão — ele já está te esperando.", dica "Toque em **OK** no canto da tela". Sem ações.
- **L3c Erros** — ícone em quadrado 64, título, texto, CTA espresso + link secundário:

| kind | Título | CTA |
|---|---|---|
| `cancel` | Tudo bem. | Voltar ao login |
| `blocked` | Conta bloqueada. | Falar com o suporte · Voltar ao login |
| `role` | Essa conta entra com e-mail e senha. | Entrar com e-mail |
| `expired` | Demorou um pouquinho. | Tentar de novo · Voltar ao login |
| `provider` | Não deu certo desta vez. | Tentar de novo · Voltar ao login |
| `taken` | Essa conta Google já está ligada a outro cadastro. | Voltar para Minha conta |

### L4 · Cadastro social (3 dots)
**Passo 1 "Quase lá, Marina!"** — texto "Faltam só uns dados. O CPF vai na nota e no pagamento; o celular, pros avisos de entrega." → pill do provedor (e-mail travado) → Nome (preenchido, editável; "Veio do Google. Pode ajustar.") → CPF → Nascimento → Celular ("Só pra avisos de entrega. Nada de spam.") → selo de indicação ou "Tenho um código de indicação" → **Continuar**.
- Estados: `fill` · `filled` · `ref` · `cpfInvalid` · `telInvalid` · `cpfTaken` (aviso + **Entrar na minha conta**) · `telTaken` · `sending` ("Salvando…") · `expired` (aviso no topo com botão do Google; dados ficam).
- **Passos 2 e 3** = os de hoje; passo 3 termina em **Criar conta e ver meu pão** → Home.

### L5 · Confirmar e-mail (Facebook)
- **L5a** "Confirme seu e-mail." — chip "Conectado com o Facebook", texto com o e-mail vindo, campo editável, **Enviar código**.
- **L5b** "Qual é o seu e-mail?" — campo vazio em foco.
- **L5c** "Digite o código." — 4 caixas, reenviar 0:28, "Trocar e-mail", **Confirmar** → L4.
- Estados: `sending` · `codeWrong` ("Código não confere." + tentativas restantes) · `codeExpired` (**Enviar um novo código**) · `tooMany` ("Muitas tentativas por agora." → **Começar de novo**).

### L6 · Encontramos sua conta
Escudo + tile do provedor → "Encontramos sua conta." → "Já existe uma conta com **ma•••@gmail.com**. Confirme que é você para conectar o Google. Seus pãezins e pedidos continuam lá." → campo "Confirmar com minha senha" + **Confirmar e conectar** + "Esqueci minha senha" → "ou" → **Receber código no e-mail** (ghost). Rodapé "Não é você? Fale com o suporte".
- Estados: `both` · `codeOnly` (só o botão do código, primário) · `wrongPw` · `code` · `done` (Home + toast "Google conectado! Da próxima vez é só um toque.").

### L7 · Perfil › Minha conta › Contas conectadas
Seção entre **Contato** e **Segurança**. Linha: tile 40 → nome (+ check verde) → e-mail ou "Não conectado" → **Conectar** (soft) / **Desconectar** (texto) / spinner. Nota abaixo: "Entre com um toque. Desconectar não tranca sua conta: o código no e-mail sempre funciona."
- Sheet: "Desconectar o Google?" / "Você continua entrando com código no e-mail{ ou com sua senha}. Dá pra conectar de novo quando quiser." → **Desconectar** · **Manter conectado**.
- Estados (`conn`): `none` · `google` · `both` · `connecting` · `connected` (toast) · `taken` (aviso danger).

### L8 · Segurança sem senha + Criar senha
- Segurança sem senha: ícone escudo, "Você entra com o Google", "Ou com código no e-mail. Quer uma senha também?", botão **Criar senha**. Com senha: como hoje (Senha •••••••• + **Trocar**).
- **Criar senha.** — "Opcional. Com senha, você também entra com e-mail e senha. O Google continua funcionando." Nova senha (Mostrar) + confirmação; critérios ao vivo: 8+ caracteres · letras e números · as duas iguais. Estados `empty` · `typing` · `mismatch` · `saving` · `done` ("Senha criada." → Voltar para Minha conta).

### L9 · Páginas públicas
Voltar → eyebrow "CHEIRIN DE PÃO" → título 30 → "Atualizado em 30/09/2026" → seções (h2 18 px, texto 15 px / 1,65) → contatos. **Exclusão de dados:** 3 passos numerados + **Falar com o suporte no WhatsApp**. Entrada: Perfil › Ajuda › Privacidade e termos (`LegalHub`). Texto é placeholder.

### A1 · Admin — detalhe do cliente
Linha **Acesso** após "Membro desde": pills neutras com logo + texto — **Google**, **Facebook**, **E-mail e senha** (e `codigo` → "Código no e-mail", se quiserem exibir).

## 4. Navegação

```
Boas-vindas ─ Instalar e criar conta → L2 ─┬ Google → L3a → (novo) L4 → passo 2 → passo 3 → Home
                                           ├ Facebook → L3a → L5a/b → L5c → L4 → …
                                           ├ (e-mail já existe) → L6 → Home + toast
                                           └ Criar com e-mail → cadastro atual (5 passos)
Boas-vindas ─ Já tenho conta → L1 ─┬ Google/Facebook → L3a → Home   (erros → aviso no L1 ou L3c)
                                   ├ E-mail + senha → Home
                                   └ Código no e-mail → e-mail → código → Home
iPhone: L3a (app) ⇄ L3b (janela do Safari) → volta → app entra sozinho
Perfil › Minha conta → L7 (conectar → L3a → volta com toast | desconectar → sheet) · L8 → Criar senha
Perfil › Ajuda › Privacidade e termos → L9 (Privacidade · Termos · Exclusão)
```

## 5. Tokens

Tudo via `useT()`: `appBg`, `surface`, `surfaceAlt`, `surface2`, `text`, `textSec`, `textTer`, `border`, `border2`, `accent`, `gold`, `goldSoft`, `espresso`, `primaryBtn(Text)`, `good(Soft)`, `danger(Soft)`, `shadowSoft`, `shadow`. Tipos: Bricolage Grotesque (títulos 24–30, 700) e Hanken Grotesk. Raios: campo 14 · botão 16 · card 18–22 · pill 999.

**Exceção:** `SocialBtn`, `GoogleG`, `FacebookF` e `ProviderTile` usam as cores oficiais (`#FFFFFF`/`#747775`/`#1F1F1F`, G multicolor; `#1877F2`) e o Google usa **Roboto Medium** (carregada no HTML). Não aplicar tema escuro nesses botões.

**Ícones novos em `brand.jsx`:** `lock` (estava listado no brief mas não existia no set), `shield`, `unlink`, `external`. Reutilizados: `chat`, `copy`, `ticket`, `link`.

## 6. Acessibilidade e pontas soltas

- Botões sociais sempre com texto ("Continuar com o …"); logos `aria-hidden`. Loading usa `aria-busy`.
- Alvos ≥ 44 px (voltar 44×44, links com `min-height: 44`, Conectar/Desconectar/Trocar 44).
- Erros de campo com `aria-invalid` + mensagem visível; avisos com `role=alert/status`; L3a com `aria-live`.
- Sheet de desconectar: `role=dialog aria-modal`; devolver o foco para a linha ao fechar.
- Páginas legais: `h1`/`h2` semânticos, 15 px / 1,65, largura de leitura confortável; públicas e indexáveis.
- **Pontas soltas:**
  - Validar com as diretrizes atuais do Google/Meta (texto, fonte, tamanho mínimo do logo) antes de publicar.
  - Prazo real da exclusão de dados (placeholder: 15 dias) e textos legais.
  - Detecção do navegador in-app (user agent `Instagram`/`FBAN`/`FBAV`).
  - "Esqueci minha senha" e "Trocar" não foram desenhados aqui (fluxos existentes).
  - Nome exibido na linha do Facebook em L7 (o Facebook pode não mandar e-mail — mostramos o nome).
