# Brief de telas — "Entrar com Google" (+ Facebook, fase futura) — para o Claude Design

> **Como usar:** cole este documento inteiro no Claude Design, dentro do projeto do protótipo do
> Cheirin de Pão (o mesmo usado no "Além do Pãozin" e no "Indique e Ganhe").
> **Fluxo:** gerar os designs → revisar → entregar o handoff → entrar no plano de implementação
> ([`docs/plano-login-social.md`](./docs/plano-login-social.md), §13).
>
> ✅ **Handoff entregue em 30/09/2026:** [`design_handoff_login_social/`](./design_handoff_login_social/README.md).
> A conferência contra o plano está na §13.1 do plano.
>
> **Escopo (30/09/2026):** a versão que vai ao ar agora tem **só o Google**. As telas do
> **Facebook** também devem ser desenhadas, para uso futuro, e ficam marcadas
> **[Futuro — Facebook]** — o projeto delas está em
> [`docs/plano-login-social-facebook.md`](./docs/plano-login-social-facebook.md).

---

## Pedido

Desenhe, no protótipo existente do **Cheirin de Pão** (`Cheirin de Pão - App.html` + `app/*.jsx`),
todas as telas do novo **login e cadastro com Google**, para o perfil **Cliente** (e um ajuste
pequeno no **Admin**), em **alta fidelidade**, com todos os estados listados abaixo.

Desenhe também as peças do **Facebook** marcadas **[Futuro — Facebook]**. No protótipo, elas
aparecem só quando `SOCIAL_PROVIDERS.facebook` for `true` (seção 6); o padrão é `false`, que é o
app que vai ao ar agora. No handoff, fique com elas numa seção própria.

Ao final, entregue um **handoff** no mesmo formato dos anteriores (seção 7 deste brief): arquivos
de tela novos no protótipo, integrações nas telas existentes, dados de exemplo e um documento
`handoff-login-social.md` com a especificação de cada tela.

**Não** recrie o "chrome" de demonstração do protótipo (troca de perfil/tema/variação). Tema
**claro** apenas. Idioma **português (BR)**, no tom aconchegante e descontraído da marca.

---

## 1. O app hoje — o protótipo está desatualizado, siga isto

- **Boas-vindas (splash):** tela escura, logo centralizado, card translúcido "Instalar o Cheirin",
  botão dourado **"Instalar e criar conta"** e link **"Já tenho conta — entrar"**. **Não muda.**
- **Login (hoje):** botão voltar no topo; título em duas linhas com saudação
  ("Bom dia.\nBora entrar."); texto "Entre com seu e-mail e senha. Prefere não decorar senha? Dá pra
  entrar com um código no e-mail."; campo e-mail; campo senha (com Mostrar/Ocultar); botão espresso
  **"Entrar"**; abaixo, dois links: **"Esqueci minha senha"** e **"Entrar com código no e-mail"**.
  O modo código tem os passos "Entrar com código." (e-mail) e o código de 4 dígitos.
- **Cadastro (hoje, 5 passos com dots):**
  1. "Seus dados" — nome, CPF, nascimento (+ selo "Indicado por…" ou link "Tenho um código de indicação");
  2. "Como falamos com você?" — e-mail, celular, senha + confirmação (com critérios da senha);
  3. "Onde você mora?" — busca de condomínio; "Meu condomínio não está aqui" abre a lista de espera;
  4. "Seu endereço" — bloco, complemento, apartamento; botão "Enviar código de confirmação";
  5. "Confirme seu cadastro" — código de 4 dígitos por e-mail; botão "Criar conta e ver meu pão".
- **Perfil › Minha conta:** seções em card com rótulo pequeno — **Dados pessoais** (nome,
  nascimento, CPF; editar) · **Contato** (telefone, e-mail; editar) · **Segurança** (Senha
  "••••••••" + botão "Trocar") · **Endereço**.
- **Trocar senha:** título "Trocar senha.", senha atual, nova, confirmação.
- **Admin › detalhe do cliente:** abas Geral · Pedidos · Financeiro · Atividade; na Geral, o card
  **Cadastro** tem linhas de rótulo/valor (inclui "Membro desde").
- **Ícones existentes** (traço 24×24, `currentColor`): home, bag, calendar, clock, lock, user,
  plus, minus, check, bell, pin, building, truck, x, edit, card, coin, spark, list, phone, mail,
  gift, star, settings, wallet, trend, logout, repeat, download, doc, percent, ban, route, alert,
  factory, scissors, refresh, users, power, search, basket, trash, camera, share, copy.
  Liste no handoff qualquer ícone novo que criar (ex.: `link`, `unlink`, `shield`).

---

## 2. Sistema de design (obrigatório — alta fidelidade)

Use os tokens e primitivas de `app/brand.jsx` (`useT()`), sem valores fixos no código.

- **Paleta (tema claro):**

  | Token | Valor |
  |---|---|
  | Fundo do app | `#FAF5EC` |
  | Surface | `#FFFFFF` |
  | Surface alt | `#FBF6EC` |
  | Surface 2 | `#F4EBDA` |
  | Fundo da página | `#C9BBA2` |
  | Texto | `#241608` |
  | Texto secundário | `#7C6A50` |
  | Texto terciário | `#A89A82` |
  | **Espresso** (cards de destaque, botão primário) | `#1E1207` |
  | **Gold** | `#E3AC3F` |
  | Gold soft | `#F3DDA6` |
  | Accent | `#B0702A` |
  | Sucesso | `#3E7C53` (soft `#DCEBDF`) |
  | Alerta | `#B23A2E` |
  | Botão primário | fundo `#1E1207`, texto `#FBF3E4` |

- **Tipografia:** títulos e números em **Bricolage Grotesque** (700–800, tracking −0.02 a −0.03em);
  texto e interface em **Hanken Grotesk** (400–800). Escala: título de tela 26–32 px, título de
  card 15–18, corpo 13–15, rótulos 11–12,5.
- **Raios:** campo 14 · botão 16 · card 18–22 · pill 999.
- **Sombras:** suave `0 1px 2px rgba(43,26,12,.05), 0 4px 14px -8px rgba(43,26,12,.18)`; forte
  `0 1px 2px rgba(43,26,12,.05), 0 10px 30px -12px rgba(43,26,12,.22)`.
- **Primitivas a reutilizar:** `Btn`, `Card`, `Pill`, `Field`, `AppBar`, `Stepper`, `Switch`,
  `Row`, `StatusBar`, o símbolo `BreadMark` e os ícones `Icon`/`Ic`.
- **Palco:** mobile, **390 px** de largura. Alvos de toque **≥ 44 px**.

### ⚠️ Exceção: botões do Google e do Facebook
São as **únicas** peças que não seguem a paleta do app — seguem as **diretrizes de marca de cada
provedor** (o do Facebook é **[Futuro — Facebook]**):
- **Google:** logo "G" oficial multicolorido, **sem alterar cores nem proporção**; fundo branco com
  borda neutra (ou a versão escura oficial); texto **"Continuar com o Google"**.
- **Facebook:** logo "f" oficial; fundo azul `#1877F2` com texto branco (ou branco com logo azul);
  texto **"Continuar com o Facebook"**.
- Mesma altura, raio e largura dos botões do app (full width, raio 16, ≥ 44 px), para os dois
  convivam bem com o botão espresso. Desenhe os logos como SVG no protótipo.

---

## 3. A funcionalidade — regras que a interface precisa mostrar

- **Só para clientes.** Entregador e admin continuam com e-mail e senha.
- **Primeiro acesso pelo Google:** o Google entrega **nome e e-mail**. O cliente completa só:
  **CPF, nascimento, celular**, **condomínio** e **endereço**. **Sem senha e sem código.**
- **E-mail do Google não verificado** (raro): o app não segue pelo Google e sugere o cadastro com
  e-mail.
- **[Futuro — Facebook] Primeiro acesso pelo Facebook:** igual, mas o e-mail é **confirmado com o
  código de 4 dígitos** antes de seguir. Se o Facebook **não compartilhar o e-mail**, o app pede o
  e-mail e manda o código. Se o e-mail confirmado já tiver conta, conecta e entra direto (o código
  já provou que é a pessoa).
- **Já existe conta com esse e-mail:** o app mostra "Encontramos sua conta" e pede **confirmação**
  antes de conectar — **com a senha da conta** ou **com um código no e-mail** da conta. Se a conta não
  tem senha, só a opção do código aparece.
- **Próximos acessos:** um toque em "Continuar com o Google" e pronto.
- **Conta criada pelo Google/Facebook não tem senha.** Pode criar uma depois em Perfil › Minha conta
  › Segurança. Continua podendo entrar com código no e-mail.
- **Contas conectadas (Perfil):** o cliente conecta ou desconecta o Google (e, no futuro, o Facebook). Desconectar
  nunca tranca a conta: o código no e-mail sempre funciona.
- **Indicação:** quem veio por link de indicação continua vendo o selo "Indicado por…" — agora
  também na tela de escolha do cadastro — e o bônus vale igual pelo Google/Facebook.
- **iPhone com o app instalado:** o login do Google/Facebook abre numa **janela do Safari**. Ao
  terminar, essa janela mostra **"Pronto! Pode voltar ao app"**; o app, ao voltar para a tela, entra
  sozinho. Precisa existir a tela "Conectando…" no app e a tela "Pode voltar ao app" na janela.
- **Navegador dentro do Instagram/Facebook:** o Google **não deixa** entrar ali. No lugar do botão do
  Google, mostrar um aviso "Para entrar com o Google, abra no navegador" (com "Copiar link").
  [Futuro — Facebook] O botão do Facebook funciona normal ali.
- **Privacidade:** abaixo dos botões sociais, uma linha "Ao continuar, você concorda com os
  **Termos de Uso** e a **Política de Privacidade**" (links). As páginas são públicas.

---

## 4. CLIENTE

### L1. Login com botões sociais (`/login` — tela existente, passo e-mail + senha)
- **Propósito:** o jeito mais rápido de entrar aparece primeiro, sem esconder o e-mail e senha.
- **Elementos:** proponha a ordem. Sugestão: título/saudação como hoje → **"Continuar com o Google"**
  → ([Futuro — Facebook] **"Continuar com o Facebook"**) → divisor **"ou com e-mail"** → campos e
  botão "Entrar" como hoje →
  links "Esqueci minha senha" / "Entrar com código no e-mail" → linha de consentimento (Termos/Privacidade).
  Ajuste o texto de apoio (hoje fala só de senha/código).
- **Estados:** **só Google (o que vai ao ar)** · [Futuro — Facebook] Google + Facebook · nenhum
  provedor ligado (igual hoje) · botão
  tocado "Abrindo o Google…" (loading no botão, demais desabilitados) · navegador do Instagram
  (aviso no lugar do Google) · erro vindo do retorno ("Você cancelou o login com o Google.",
  "Não foi possível falar com o Google. Tente de novo.").

### L2. Entrada do cadastro — "Como você quer criar sua conta?" (`/register`, antes do passo 1)
- **Propósito:** oferecer o atalho antes dos 5 passos.
- **Elementos:** voltar; selo "Indicado por João M. · você ganha 3 pãezins no 1º pedido" quando veio
  pelo link; título e texto curto (ex.: "Crie em 1 minuto"); **Google**, ([Futuro — Facebook]
  **Facebook**), divisor, botão
  secundário **"Criar com e-mail"** (segue para o cadastro atual); linha de consentimento; link
  "Já tenho conta — entrar".
- **Estados:** com e sem indicação · **só Google** · [Futuro — Facebook] Google + Facebook ·
  navegador do Instagram · loading ao tocar.
- **Regra:** se nenhum provedor estiver ligado, esta tela não aparece (vai direto ao passo 1).

### L3. Retorno — "Conectando…" e "Pode voltar ao app"
- **L3a Conectando (no app):** logo/`BreadMark` com animação suave, "Conectando com o Google…",
  botão discreto "Cancelar". Aparece enquanto o app espera o resultado.
- **L3b Pode voltar ao app (na janela do Safari do iPhone):** ícone de check, "Pronto!", "Pode
  voltar ao app Cheirin de Pão — ele já está te esperando." Sem botões de ação do app (é outra janela);
  no máximo uma dica "Toque em OK no canto da tela".
- **L3c Erros** (título + texto + botão "Voltar ao login"/"Tentar de novo"):
  - cancelou ("Tudo bem, você pode entrar de outro jeito.");
  - conta bloqueada ("Conta bloqueada. Fale com o suporte." + botão de suporte);
  - conta de entregador/admin ("Essa conta entra com e-mail e senha.");
  - e-mail do Google não verificado (sugere "Criar com e-mail");
  - demorou demais / expirou;
  - falha do provedor;
  - (Perfil) "Essa conta Google já está ligada a outro cadastro."

### L4. Cadastro social — "Quase lá" + condomínio + endereço (3 passos com dots)
- **Passo 1 · "Quase lá, Marina!"** (usa o primeiro nome vindo do Google):
  - card/pill do provedor: logo + e-mail **travado** ("marina.ribeiro@gmail.com · via Google");
  - **Nome completo** preenchido (editável);
  - **CPF**, **Data de nascimento**, **Celular** (mesmas máscaras e avisos de hoje);
  - selo de indicação / "Tenho um código de indicação" (como no passo 1 atual);
  - texto de apoio curto explicando o porquê (CPF para nota/pagamento, celular para avisos de entrega).
- **Passo 2 · "Onde você mora?"** e **Passo 3 · "Seu endereço"** — **iguais aos de hoje**; o botão
  final vira **"Criar conta e ver meu pão"** (sem código).
- **Estados:** preenchendo · CPF inválido · celular inválido · **CPF já tem conta** (mensagem +
  botão "Entrar na minha conta") · celular já cadastrado · enviando · sessão com o Google expirou
  ("Toque para continuar com o Google de novo" — os dados digitados ficam).

### L5. [Futuro — Facebook] Confirmar e-mail
- **L5a "Confirme seu e-mail":** "Veio do Facebook: ana@exemplo.com" com campo **editável** e botão
  "Enviar código".
- **L5b "Qual é o seu e-mail?":** quando o Facebook não compartilhou — campo vazio + "Enviar código".
- **L5c Código:** reutilize a tela de código de 4 dígitos que já existe ("Enviamos 4 dígitos por
  e-mail para…", reenviar com contador).
- **Estados:** enviando · código errado · código expirado · muitas tentativas ("Comece de novo").

### L6. "Encontramos sua conta" (vínculo)
- **Propósito:** conectar o Google/Facebook a uma conta que já existe, com segurança e sem susto.
- **Elementos:** ícone de conta/escudo; título "Encontramos sua conta"; texto "Já existe uma conta com
  **ma•••@gmail.com**. Confirme que é você para conectar o Google."; opção **"Confirmar com minha
  senha"** (campo senha + botão) e opção **"Receber código no e-mail"** (vai para a tela de código);
  link "Esqueci minha senha".
- **Estados:** conta com senha (duas opções) · conta sem senha (só código) · senha errada · código ·
  conectado (toast/feedback "Google conectado! Da próxima vez é só um toque.").

### L7. Perfil › Minha conta › "Contas conectadas" (seção nova)
- **Onde:** proponha — sugestão: entre **Contato** e **Segurança**.
- **Elementos:** uma linha por provedor: logo, nome, e-mail conectado (ou "Não conectado") e ação
  **"Conectar"** / **"Desconectar"**. Agora só a linha do **Google**; [Futuro — Facebook] a linha
  do Facebook entra embaixo — desenhe a seção de um jeito que funcione com 1 e com 2 linhas.
- **Desconectar:** confirmação (sheet) — "Desconectar o Google? Você continua entrando com código no
  e-mail" (+ "ou com sua senha", quando tiver).
- **Estados:** Google não conectado · Google conectado · [Futuro — Facebook] os dois · conectando
  (loading) · conectado (feedback) · erro "já ligada a outro cadastro".

### L8. Segurança sem senha + "Criar senha"
- **Seção Segurança** quando a conta **não tem senha**: "Você entra com o Google" (ou Facebook /
  código no e-mail) + botão **"Criar senha"** (em vez de "Trocar").
- **Tela "Criar senha"** (variante da "Trocar senha"): sem "senha atual"; nova + confirmação com os
  critérios que já existem; botão "Criar senha"; feedback de sucesso.

### L9. Páginas públicas — Privacidade e Termos (+ [Futuro — Facebook] Exclusão de dados)
- Layout de leitura simples: voltar, título, data de atualização, seções com subtítulos, texto
  corrido confortável (15 px, entrelinha generosa), links de contato no fim.
- **Privacidade** inclui a seção **"Como excluir seus dados"**: passo a passo curto ("Fale com o
  suporte pelo WhatsApp e peça a exclusão; respondemos em até X dias") + botão de suporte.
- **[Futuro — Facebook] Exclusão de dados:** a mesma seção como página própria (a Meta exige uma
  URL só com as instruções).
- Use texto de exemplo (lorem em PT) — o texto real vem depois.
- Entrada também em **Perfil › Ajuda** ("Privacidade e termos").

---

## 5. ADMIN

### A1. Detalhe do cliente — linha "Acesso" no card Cadastro
- Nova linha **"Acesso"** com pills: **Google**, **E-mail e senha** ([Futuro — Facebook]
  **Facebook**) — os que valem para aquele cliente. Pill com texto (não só logo/cor).

---

## 6. Dados de exemplo e microcopy

```js
SOCIAL_PROVIDERS = { google: true, facebook: false } // true = ver as telas [Futuro — Facebook]
SOCIAL_PREFILL = { provider: 'google', name: 'Marina Ribeiro', email: 'marina.ribeiro@gmail.com' }
SOCIAL_LINK = { maskedEmail: 'ma•••@gmail.com', canUsePassword: true }
CONNECTED_ACCOUNTS = [
  { provider: 'google', email: 'marina.ribeiro@gmail.com', linkedAt: '30/09' },
  // facebook: não conectado
]
```

- Tom aconchegante e direto. Evitar jargão ("OAuth", "token", "autenticação").
- Nunca culpar o cliente: "Não deu certo desta vez" em vez de "Erro".
- Sempre dizer **o que acontece depois**: "Da próxima vez é só um toque."

---

## 7. Entregável (checklist do handoff)

1. **Telas novas no protótipo:** `app/screens-social-auth.jsx` — L2, L3, L4 (passo 1), L5, L6, L8
   (Criar senha), L9 e os componentes reutilizáveis (botões Google/Facebook, divisor "ou com e-mail",
   linha de consentimento, pill do provedor).
2. **Integrações nas telas existentes:** rotas em `app/app.jsx`; L1 no login e L4 (passos 2–3) no
   cadastro em `screens-onboarding.jsx`; L7 e L8 (seção Segurança) na Minha conta; A1 no detalhe do
   cliente do admin.
3. **Mocks** da seção 6 em `app/data.jsx`.
4. **Logos** do Google e do Facebook como SVG, e ícones novos no set de `brand.jsx`.
5. **`handoff-login-social.md`**, na mesma estrutura dos handoffs anteriores:
   1. conceito e regras;
   2. modelo de dados (mock → backend);
   3. cada tela com propósito, layout, elementos, **todos os estados** e textos finais;
   4. navegação (de onde se chega a cada tela e para onde vai);
   5. tokens usados + a exceção dos botões dos provedores;
   6. acessibilidade (botões com texto, não só logo; foco; alvos de 44 px; leitura das páginas
      legais) e pontas soltas;
   7. **seção separada "Futuro — Facebook"** com tudo o que só vale quando o Facebook entrar
      (botão, L5, linha no Perfil, pill no admin, página de exclusão de dados), para ser
      implementada depois sem misturar com o que vai ao ar agora.
