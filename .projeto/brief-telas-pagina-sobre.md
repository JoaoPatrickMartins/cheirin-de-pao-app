# Brief de telas — Página "Sobre" (apresentação pública do Cheirin de Pão) — para o Claude Design

> **Como usar:** cole este documento inteiro no Claude Design, dentro do projeto do protótipo do
> Cheirin de Pão (o mesmo usado no "Além do Pãozin", no "Indique e Ganhe" e no "Login social").
> **Fluxo:** gerar os designs → revisar → entregar o handoff → entrar no plano de implementação
> ([`docs/plano-pagina-sobre.md`](./docs/plano-pagina-sobre.md)).

---

## Pedido

Desenhe a **página pública de apresentação** do Cheirin de Pão, que vai morar em
`https://app.cheirindepao.com.br/sobre/`, em **alta fidelidade**. Desenhe também o **link novo na
tela de boas-vindas** do app que leva até ela.

É uma **página de site**, não uma tela do app: abre no navegador do celular **e do computador**,
sem login, sem barra de status nem tab bar do PWA. Desenhe em **dois palcos**:
- **mobile, 390 px** de largura;
- **desktop, 1280 px**, com a coluna de conteúdo limitada a cerca de 1080 px.

Ao final, entregue um **handoff** no mesmo formato dos anteriores (seção 7).

**Não** recrie o "chrome" de demonstração do protótipo (troca de perfil, tema ou variação). Tema
**claro** apenas, com um bloco escuro opcional no hero (seção 4, S2). Idioma **português (BR)**, no
tom aconchegante e descontraído da marca.

---

## 1. Por que essa página existe (regras que o design precisa respeitar)

O Google só mostra o nome e o logo do Cheirin na tela "Continuar com o Google" depois de
**verificar a marca**. A verificação foi reprovada por dois motivos:
1. a página inicial cadastrada era a do app, que **abre direto no login**;
2. ela **não explicava para que serve o app**.

Então esta página **precisa**:
- abrir **sem login**, com todo o conteúdo visível;
- dizer **claramente o que o Cheirin faz**, já no primeiro bloco;
- usar o nome **"Cheirin de Pão"** igual ao da tela de consentimento do Google;
- explicar **por que o app pede login com o Google e quais dados recebe** (seção 4, S8);
- ter **links visíveis** para a **Política de Privacidade** (`/privacidade`) e os **Termos de Uso**
  (`/termos`), no rodapé e também na seção do Google;
- ter um **contato** (e-mail e WhatsApp).

Na implementação, ela será **HTML estático**: o texto já vem no HTML, para o robô do Google ler sem
JavaScript. Por isso:
- **nada de conteúdo que só aparece com interação complexa**;
- o FAQ é um acordeão simples (abre e fecha), com as perguntas sempre visíveis;
- carrossel, abas e modal ficam de fora.

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
  | Texto | `#241608` |
  | Texto secundário | `#7C6A50` |
  | Texto terciário | `#A89A82` |
  | **Espresso** (blocos de destaque, botão primário) | `#1E1207` |
  | **Gold** | `#E3AC3F` |
  | Gold soft | `#F3DDA6` |
  | Accent | `#B0702A` |
  | Sucesso | `#3E7C53` (soft `#DCEBDF`) |
  | Botão primário | fundo `#1E1207`, texto `#FBF3E4` |

- **Tipografia:** títulos e números em **Bricolage Grotesque** (700–800, tracking −0.02 a −0.03em);
  texto e interface em **Hanken Grotesk** (400–800).
  - Mobile: hero 34–40 px, título de seção 24–28, corpo 15–16.
  - Desktop: hero 56–64 px, título de seção 32–40, corpo 16–17.
  - Corpo de leitura com linha confortável (1.5–1.6) e no máximo ~68 caracteres por linha.
- **Raios:** botão 16 · card 18–22 · pill 999.
- **Sombras:** suave `0 1px 2px rgba(43,26,12,.05), 0 4px 14px -8px rgba(43,26,12,.18)`; forte
  `0 1px 2px rgba(43,26,12,.05), 0 10px 30px -12px rgba(43,26,12,.22)`.
- **Peças a reutilizar:** `Btn`, `Card`, `Pill`, o símbolo `BreadMark` e os ícones `Icon`/`Ic`.
  Não use `AppBar`, `StatusBar` nem tab bar: aqui não é o app.
- **Splash como referência de marca:** fundo espresso `#1E1207` com brilho radial dourado
  (`radial-gradient(120% 80% at 50% -10%, rgba(227,172,63,0.18), transparent 60%)`) e o
  `BreadMark` dourado. O hero da página pode herdar esse clima.
- **Alvos de toque ≥ 44 px**; contraste AA em todo texto.

---

## 3. O que o Cheirin é — fatos que a página precisa mostrar (não invente além disto)

- **O serviço:** entrega de pão fresco **na porta do apartamento**, em **condomínios parceiros**.
  O cliente configura uma vez e o pão chega sozinho.
- **Pãezins (a moeda do app):** cada **pãozin vale um pão**. Com eles você agenda pão **e também
  paga os itens do Além do Pãozin**. **Não expiram.**
- **Combos:** pacotes de pãezins. Comprou, os pãezins caem na hora no saldo. **Cada pão sai mais
  barato do que na compra avulsa.** Pagamento por **Pix ou cartão**.
- **Agenda semanal:** você escolhe **quantos pães quer em cada dia da semana**, e a agenda gera as
  entregas **sozinha, toda semana**, usando os pãezins do saldo. Dá para mudar quando quiser, até o
  horário de corte. Quem quer só um dia faz um **pedido único**.
- **Compra automática:** com um cartão cadastrado, quando o saldo não cobrir uma entrega agendada,
  o app **recarrega sozinho o combo escolhido**, sem digitar o CVV. Sem ela, você recebe um aviso
  de que os pãezins estão acabando.
- **Horário de corte:** pedidos e agenda mudam até o **horário de corte de cada turno, mostrado no
  app**. Depois do corte, aquela entrega já está fechada com a padaria. **Não escreva horários
  exatos.**
- **Turnos de entrega:** manhã e/ou tarde. **Quais turnos existem vem da API** (seção 5).
  **Não escreva horários exatos.**
- **Pausa:** pausa a agenda num toque. Nada é entregue enquanto ela estiver pausada, a configuração
  fica guardada e os pãezins continuam no saldo. Se a pausa passar de uma semana, o app lembra você.
  Para retomar, é um toque.
- **Gancho na porta:** um gancho de **acrílico transparente** que se encaixa na porta, **sem furar e
  sem ferramentas**. O entregador pendura a sacola de pães nele, **sem tocar a campainha**. **Vem de
  graça com a compra de um combo.**
- **Além do Pãozin:** itens de café da manhã (geleias e mel, bolos e doces, pão de queijo e
  salgados, bebidas, frios…). Você monta a **Cestinha** e ela **chega junto com o pão**. Paga por
  Pix, cartão ou pãezins, e dá para combinar.
- **Condomínio não atendido:** no cadastro há o "Meu condomínio não está aqui", para entrar na
  **lista de espera**. Quando vários vizinhos pedem, o Cheirin chega mais rápido, e a gente avisa.
- **Indique e Ganhe** (só aparece quando o programa está ligado — seção 5): indique um vizinho
  pelo seu link e ganhe **{N} pãezins quando o pão chegar na porta dele**. Quando houver bônus para
  o amigo: "e ele ganha **{Y}** no primeiro pedido".
- **Formas de entrar:** e-mail e senha, código no e-mail ou **Google**. Pelo Google, o Cheirin
  recebe **só o identificador da conta, o nome e o e-mail**, para criar e acessar a conta. **Não
  recebe a senha do Google nem outros dados da conta.**
- **Notificações:** o app avisa da entrega de amanhã, da entrega feita e dos pãezins acabando.

---

## 4. A página — seções, de cima para baixo

### S1. Topo
- Logo (`BreadMark` + "Cheirin de Pão").
- À direita, **"Entrar"** (link, para `/login`) e **"Criar conta"** (botão pequeno, para `/register`).
- No mobile, os dois cabem sem menu hambúrguer. Se não couber, só o "Entrar" fica no topo, e o
  "Criar conta" fica no hero.

### S2. Hero
- Título com o nome e a promessa, por exemplo **"Pão fresquinho na sua porta."**
- Subtítulo de 1–2 frases que diz **o que o app faz**, por exemplo: "O Cheirin de Pão entrega pão
  fresco na porta do seu apartamento, em condomínios parceiros. Você monta a agenda uma vez e o pão
  chega sozinho — {frase do turno}."
- **{frase do turno}** varia (seção 5):
  - "de manhã ou à tarde, no turno que você escolher";
  - "pela manhã";
  - "à tarde";
  - neutra: "nos dias que você escolher".
- CTAs: **"Criar minha conta"** (primário) e **"Já tenho conta · Entrar"** (secundário).
- Visual: pode usar o clima da splash (fundo espresso, brilho dourado) **ou** um bloco claro com
  ilustração. A frase do turno precisa caber nos 4 textos sem quebrar o layout.

### S3. Como funciona — 3 passos
1. **Compre pãezins** — combos por Pix ou cartão; cada pãozin vale um pão.
2. **Monte sua agenda** — quantos pães em cada dia da semana.
3. **Abra a porta e pegue** — o pão chega pendurado no seu gancho.

Desenhe com ícone, número e frase curta. No mobile os passos ficam empilhados; no desktop, em 3
colunas.

### S4. Pãezins, combos e agenda — o coração do app
Um bloco que liga as três coisas:
- **pãezins** são a moeda;
- **combos** enchem o saldo;
- a **agenda** usa o saldo sozinha;
- a **compra automática** recarrega quando precisa.

Pode ser um mini-diagrama (saldo → agenda → entrega) ou cards lado a lado. Inclua a frase
**"Pãezins não expiram"** em destaque.

### S5. Gancho na porta
Foto ou ilustração do gancho com a sacola. Três pontos curtos:
- sem furar;
- sem campainha;
- de graça com o combo.

### S6. Além do Pãozin
Uma faixa com 4–6 categorias (ícone ou foto) e a frase "Monte sua Cestinha — ela chega junto com o
seu pão". Diga que dá para pagar com pãezins.

### S7. Perguntas frequentes (acordeão)
Use os textos finais da seção 6, nesta ordem:
1. O que são pãezins?
2. Como funcionam os combos?
3. Como funciona a agenda semanal?
4. E se meus pãezins acabarem? (compra automática)
5. Até quando posso pedir ou mudar?
6. Posso pausar quando viajar?
7. Meu condomínio não é atendido. E agora?
8. Como funciona o Indique e Ganhe? (**só quando ligado** — seção 5)

### S8. Entrar com o Google — seus dados
Um card discreto, em tom de transparência:
- **título:** "Entrar com o Google";
- **texto:** as três formas de entrar e o que o Cheirin recebe do Google (seção 3);
- **links:** "Política de Privacidade" e "Termos de Uso".

Mostre o "G" oficial pequeno, sem alterar cores nem proporção, ou só o ícone `lock`.

### S9. Contato
- **E-mail:** `cheirindepao.contato@gmail.com` (link `mailto:`).
- **WhatsApp:** botão "Falar no WhatsApp", com o ícone `chat` (ou `phone`).

### S10. Rodapé
"Cheirin de Pão" + `BreadMark` pequeno, **Política de Privacidade**, **Termos de Uso**, o e-mail e
"© 2026 Cheirin de Pão". Fundo espresso ou surface 2.

### B1. Tela de boas-vindas (splash) do app — link novo (tela existente, só front)
Hoje ela tem: fundo espresso, logo centralizado, "PÃO FRESCO NA PORTA", o card translúcido de
instalar, o botão **"Já tenho conta · Entrar"** e o link **"Quero criar minha conta"**. Acrescente
um link **discreto** **"Conheça o Cheirin"** (ou "Como funciona?"), que abre a página `/sobre/`. Não
mexa no resto da tela.

---

## 5. Estados e variações (desenhe todos)

| Variação | Onde aparece | O que muda |
|---|---|---|
| **Turnos: manhã + tarde** | S2 (e S3 passo 3, se usar) | "de manhã ou à tarde, no turno que você escolher" |
| **Turnos: só manhã** | idem | "pela manhã" |
| **Turnos: só tarde** | idem | "à tarde" |
| **Turnos: neutro** (API fora do ar, ou robô sem JavaScript) | idem | "nos dias que você escolher" — **é o texto que vem no HTML**; os outros entram por cima |
| **Indique e Ganhe ligado, com bônus para o amigo** | S7, item 8 | "…ganha {N} pãezins quando o pão chegar na porta dele, e ele ganha {Y} no primeiro pedido." |
| **Indique e Ganhe ligado, sem bônus para o amigo** | S7, item 8 | só a parte de quem indica |
| **Indique e Ganhe desligado** | S7 | o item 8 **some** (o acordeão fica com 7) |
| **FAQ: item aberto × fechado** | S7 | — |
| **Mobile 390 × desktop 1280** | página toda | todas as seções |

---

## 6. Microcopy final do FAQ (o tom pode ser polido; os fatos não mudam)

1. **O que são pãezins?** — Pãezins são a moeda do app: cada pãozin vale um pão fresquinho. Você
   usa pãezins para agendar seu pão e também para pagar os itens do Além do Pãozin. E eles não
   expiram.
2. **Como funcionam os combos?** — Combos são pacotes de pãezins. Comprou, os pãezins caem na hora
   no seu saldo — e cada pão sai mais barato do que na compra avulsa. Pague por Pix ou cartão.
3. **Como funciona a agenda semanal?** — Você escolhe quantos pães quer em cada dia da semana e
   pronto: a agenda gera as entregas sozinha, toda semana, usando os pãezins do seu saldo. Mudou a
   rotina? Ajuste quando quiser. Prefere só um dia? Faça um pedido único.
4. **E se meus pãezins acabarem?** — Ative a compra automática: quando o saldo não cobrir uma
   entrega agendada, a gente recarrega sozinho o combo que você escolheu, no seu cartão cadastrado
   — sem digitar o CVV. Sem ela, você recebe um aviso para comprar antes.
5. **Até quando posso pedir ou mudar?** — Até o horário de corte de cada turno, que aparece no app.
   Depois do corte, aquela entrega já está fechada com a padaria.
6. **Posso pausar quando viajar?** — Pode. Pause a agenda num toque: nada é entregue enquanto ela
   estiver pausada, sua configuração fica guardada e seus pãezins continuam no saldo. Voltou? É só
   retomar.
7. **Meu condomínio não é atendido. E agora?** — Por enquanto entregamos só em condomínios
   parceiros. No cadastro, toque em "Meu condomínio não está aqui" e deixe seu contato: quando
   vários vizinhos pedem, o Cheirin chega mais rápido — e a gente te avisa.
8. **Como funciona o Indique e Ganhe?** *(só quando ligado)* — Indique um vizinho com o seu link:
   você ganha {N} pãezins quando o pão chegar na porta dele{, e ele ganha {Y} no primeiro pedido}.

**Dados de exemplo para o protótipo:** `N = 5`, `Y = 2`; turnos `{ manha: true, tarde: true }`.

---

## 7. Entregável (checklist do handoff)

1. **Página no protótipo:** `app/screens-sobre.jsx`, com S1–S10 nos dois palcos (390 e 1280) e todas
   as variações da seção 5 (um seletor de demonstração para turnos e Indique, **fora** da página).
2. **Integração na tela existente:** o link B1 na splash (`screens-onboarding.jsx` ou onde a splash
   estiver), com a rota em `app/app.jsx`.
3. **Imagens:** ilustração ou foto do gancho (S5) e das categorias (S6), como SVG ou com indicação
   clara do asset a produzir. Ícones novos entram no set de `brand.jsx`.
4. **`handoff-pagina-sobre.md`**, na mesma estrutura dos handoffs anteriores:
   1. conceito e regras (seção 1 deste brief);
   2. dados dinâmicos (turnos, Indique e Ganhe, WhatsApp) e o texto neutro que vem no HTML;
   3. cada seção com propósito, layout **mobile e desktop**, elementos, estados e textos finais;
   4. navegação (para onde vai cada link e botão);
   5. tokens usados (e qualquer exceção, como o "G" do Google);
   6. acessibilidade (hierarquia de títulos h1→h2→h3, FAQ navegável por teclado, foco visível,
      contraste, alvos de 44 px, `alt` das imagens) e pontas soltas.
