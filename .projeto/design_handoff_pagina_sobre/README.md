# Handoff: Página "Sobre" — apresentação pública (Cheirin de Pão)

## Sobre os arquivos deste pacote
Os arquivos em `design/` são **referências de design feitas em HTML/React (Babel no navegador)**. Eles mostram o visual, o texto e o movimento esperados. **Não são código de produção para copiar.** A tarefa é recriar a página como **HTML estático** em `https://app.cheirindepao.com.br/sobre/` (texto já no HTML, sem depender de JS) e acrescentar o link B1 na tela de boas-vindas do app.

## Fidelidade
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, raios, sombras, textos, estados e tempos de animação são finais. **A versão a implementar é a v2.** A v1 (§B) é a base da v2 e continua valendo para tudo que a §A não muda.

## Como abrir as referências
- `design/Cheirin de Pão - Sobre v2.html` — **o site com movimento**. No canto inferior direito: **Desktop | Mobile** (mostra a versão mobile numa moldura de celular), **Repetir animações** e o seletor de demonstração (turnos e Indique e Ganhe). Abaixo de 820 px de largura, a página abre direto no layout mobile.
- `design/Sobre v2 - Telas.html` — quadro estático com todas as seções e variações (estado final das animações). Dá para mover, dar zoom e focar cada quadro.

## Capturas
Na pasta `screenshots/`, cada imagem mostra um grupo de estados lado a lado:
- `00-kit.png` — botão-link, links, eyebrow, selo, FAQ aberto/fechado, ícones novos
- `01-pagina-mobile.png` — página completa · 390
- `02-pagina-desktop.png` — página completa · 1280
- `03-hero-mobile.png` — S1 + S2 com as 4 frases do turno + o push "Seu pão chegou!"
- `04-hero-desktop.png` — S1 + S2 com as 4 frases do turno
- `05-s4-p-ezins-agenda.png` — S4 com o card da agenda (mobile e desktop)
- `06-s6-alem-do-paozin.png` — S6 com o celular do Além do Pãozin (mobile e desktop)
- `07-s7-faq.png` — Indique com bônus · sem bônus · desligado · item aberto × fechado · desktop
- `08-b1-boas-vindas.png` — link "Conheça o Cheirin" na tela de boas-vindas (antes e depois)

As capturas mostram o **estado final** de cada animação; o movimento está descrito na §A.2 e pode ser visto no site v2.

## Arquivos de design
- `design/app/screens-sobre.jsx` e `design/app/screens-sobre2.jsx` — base (v1): config, primitivas e seções S1–S10.
- `design/app/screens-sobre-v2.jsx` e `design/app/screens-sobre-v2b.jsx` — v2: movimento, moldura do celular, mock da Home, hero, S3–S7 animadas, `SobrePageV2`.
- `design/app/screens-onboarding.jsx` — `InstallScreen` com o link B1 (prop `about`).
- `design/app/brand.jsx` — tokens e ícones (novos: `arrowR`, `bellOff`, `jar`, `cake`, `puff`, `cup`, `cheese`).
- `design/app/data.jsx` — `MARKET_CATS`; `design/app/screens-social-auth.jsx` — `GoogleG` (logo oficial).
- `design/assets/app-alem-do-paozin.jpg` — print real do Além do Pãozin (também usado nos recortes de produto do hero).

---

# A. v2 — o que implementar por cima da base



## 1. O que mudou

| Seção | v1 | v2 |
|---|---|---|
| S1 Topo | Absoluto sobre o hero | No site: **fixo**; depois de 24 px de rolagem fica espresso a 86 % + blur 16 px, e a altura cai de 84 para 68 (desktop) ou de 64 para 58 (mobile). |
| S2 Hero | Card da agenda | **Celular com a Home real do app** (`SobreHomeMock`, mesma estrutura do app): saudação + condomínio + sino; card do saldo (topo espresso "VOCÊ TEM · 38 pãezins · Rende ~9 dias no seu ritmo atual" + base branca com **Comprar pãezins** e **Extrato**); card "FIQUE DE OLHO NO CORTE · Garanta sua próxima fornada" (sem horários: "Manhã · Tarde"); atalhos Agenda · Avulso · Histórico; "Além do Pãozin · Pague com pãezins e economize até 17%" com produtos (fotos recortadas do print, selos NOVO e PROMO); tab bar real. O celular sai do hero, cortado pela borda de baixo. Atrás dele, um halo dourado. Push "Seu pão chegou! / Está pendurado no gancho da porta." no topo da tela do celular. |
| S4 | Cabeçalho + diagrama | Cabeçalho em 2 colunas: texto + selo à esquerda, **card da agenda** (o do hero v1) à direita. O aviso flutuante virou **"Compra automática ligada · Recarrega seu combo quando precisar."** (o push do hero já conta a entrega). |
| S6 | Bloco com 6 categorias | Bloco em 2 colunas: texto + 6 categorias (3 × 2 no desktop, 2 × 3 no mobile) e o **celular com a tela real do Além do Pãozin**, cortado pela borda de baixo do bloco. |
| S7 | Abre/fecha seco | Abertura suave da altura; o "+" vira "–" (a haste vertical some e o ícone gira). |

A tela do celular no hero é um **mock curado**, não um print, para não mostrar horários exatos (regra do brief) e para animar por dentro. Na implementação, ela pode virar um vídeo ou um PNG exportado do quadro, com o push e a contagem em HTML por cima.

## 2. Movimento

Princípios: **uma vez e calmo**. Cada elemento entra uma vez (só o hero tem dois loops suaves); nada pisca nem chama atenção sozinho; respeita `prefers-reduced-motion` (tudo aparece direto).

Curva padrão: `cubic-bezier(.16,1,.3,1)` (desaceleração longa). Entrada padrão (**reveal**): opacidade 0 → 1 em 700 ms + `translateY(18px)` → 0 em 900 ms. Dispara quando ~14 % do elemento entra na tela (IntersectionObserver, margem inferior de −6 %), uma vez só.

**Hero (no carregamento)**

| t (ms) | Elemento | Animação |
|---|---|---|
| 100 | Topo | fade 700 |
| 150 / 250 / 380 / 500 | Eyebrow · h1 · subtítulo · CTAs | sobe 22 px + fade, 900–1000 |
| 300 | Celular | sobe 70 px + escala .97 → 1, 1300 |
| 450 → 860 | Blocos dentro do app | sobem em cascata, 100 ms entre eles |
| 700 | "38" do saldo | contagem 0 → 38, 1400, ease-out cúbico, algarismos tabulares |
| 1800 → ∞ | Celular | flutua ±8 px, 7 s, ease-in-out |
| 2300 | Push | desce do topo (leve passada de 1,08), fica ~3,5 s e sobe de volta; dura 5,2 s ao todo |
| contínuo | Halo dourado | "respira" (opacidade .7 ↔ 1, escala 1 ↔ 1,06), 9 s |
| troca de turno | Frase do turno | fade 600 (quando a API responde por cima do texto neutro) |

**Seções (ao entrar na tela)**
- **S3** — cabeçalho com reveal. Os círculos "pulam" em cascata a cada 260 ms (escala .6 → 1, `cubic-bezier(.3,1.35,.5,1)`), cada texto sobe logo depois do seu círculo, e o traço tracejado se desenha da esquerda para a direita (desktop) ou de cima para baixo (mobile) em 1100 ms.
- **S4** — o card da agenda sobe 26 px. Os 7 dias pulam em cascata a cada 70 ms (escala .82 → 1). Depois entra o selo "Ativa" (820 ms), o saldo conta até 38 (a partir de 500 ms, 1200) e o aviso de compra automática desliza 24 px da direita (1100 ms). Os 4 cards do diagrama sobem a cada 120 ms, e as setas aparecem depois de cada card. O "U" da compra automática se desenha da Agenda até os Combos (`clip-path`, 1200, a partir de 650 ms), a ponta da seta aparece em 1650 ms e o card do meio sobe em 900 ms.
- **S5** — a foto sobe 30 px; texto e os 3 pontos sobem em cascata a cada 110 ms.
- **S6** — o bloco sobe 30 px. Título, texto e as categorias entram em cascata a cada 70 ms. O celular sobe 80 px em 1300 ms. Hover nas categorias: sobe 3 px + sombra forte (350 ms).
- **S7** — o card do FAQ sobe 24 px. Abrir: altura via `grid-template-rows: 0fr → 1fr` (550 ms) + a resposta com fade e 6 px (400 ms, 80 ms de atraso). A haste vertical do ícone some (`scaleY`), o ícone gira 180° e o fundo passa de surface2 para espresso.
- **S8 + S9** — reveal do bloco inteiro. **Rodapé** — sem animação.

**Implementação na página estática**
- O HTML vem completo e visível. O JS adiciona `class="js"` no `<html>`, e só aí os elementos com `[data-reveal]` começam escondidos; o IntersectionObserver põe `.in`. Sem JS, nada fica escondido (o robô do Google lê tudo).
- Acordeão com `<details>`: animar com `::details-content` + `interpolate-size: allow-keywords` onde houver suporte; nos outros navegadores, abre seco.
- Só `transform` e `opacity` (e `clip-path` no U), para rodar a 60 fps. Nada de animar `height`, `top` ou `box-shadow` no scroll.
- `@media (prefers-reduced-motion: reduce)`: sem entradas, sem flutuar, sem respirar, push fixo, contagem direto no valor final.

## 3. Acessibilidade (além da v1)

- O celular do hero e o card da agenda são `role="img"` com `aria-label`. O conteúdo de dentro é `aria-hidden` (é ilustração, não interface).
- O push não usa `aria-live` (é decorativo e se repete na ilustração).
- No FAQ, a resposta fechada recebe `inert`, para não entrar no Tab nem no leitor de tela.
- O topo fixo não cobre âncoras: usar `scroll-margin-top` = altura do topo, se criarem links internos.

## 4. Pontas soltas (novas)

- O print do Além do Pãozin é do app real (com os preços de hoje). Se os produtos mudarem, trocar `assets/app-alem-do-paozin.jpg` (largura ≥ 763 px).
- Hero no desktop: se quiserem um vídeo curto do app em vez do mock, manter a moldura, o halo e o push por cima.
- A contagem "38" e os dias da agenda são exemplos fixos; não vêm da conta de ninguém.


---

# B. Base (v1) — especificação completa da página



## 1. Conceito e regras

A verificação de marca do Google foi reprovada porque a página inicial cadastrada abria no login e não explicava o app. Esta página resolve isso:
- **Abre sem login**, com todo o conteúdo visível. Fica em `/sobre/` e é a página inicial cadastrada no Google.
- O **primeiro bloco já diz o que o Cheirin faz** (h1 + subtítulo).
- O nome é sempre **"Cheirin de Pão"**, igual ao da tela de consentimento do Google.
- **S8** explica por que o app pede login com o Google e o que recebe.
- Links visíveis para **Política de Privacidade** (`/privacidade`) e **Termos de Uso** (`/termos`) em S8 e no rodapé.
- Contato por **e-mail** e **WhatsApp** (S9 e rodapé).
- **HTML estático:** todo o texto vem no HTML, para o robô ler sem JavaScript. Sem carrossel, abas nem modal. O FAQ é `<details>/<summary>`: as perguntas aparecem sempre e as respostas ficam no HTML mesmo fechadas.
- Tema **claro** apenas; o hero e o rodapé usam o espresso da splash.

## 2. Dados dinâmicos

```js
SOBRE_CFG = {
  turnos: { manha: true, tarde: true },             // API pública (sem login) · null = neutro
  indique: { ativo: true, recompensa: 5, bonusAmigo: 2 },
  email: 'cheirindepao.contato@gmail.com',
  whatsapp: '5511900000000',                        // placeholder
}
```

| Dado | Onde | No HTML (sem JS) | Com JS |
|---|---|---|---|
| Turnos | S2, frase final do subtítulo (`<span data-sb-turno>`) | **"nos dias que você escolher"** | manhã + tarde → "de manhã ou à tarde, no turno que você escolher" · só manhã → "pela manhã" · só tarde → "à tarde". API fora do ar ou sem resposta: fica o neutro. |
| Indique e Ganhe | S7, item 8 | **sem o item 8** (o FAQ tem 7 itens) | Se `ativo`, o JS acrescenta o item 8 no fim. Com `bonusAmigo > 0`, inclui a parte do amigo. Desligado: o item não entra. |
| WhatsApp | S9 (botão) | link fixo `https://wa.me/<número>`, gerado no build pela config | — |
| E-mail | S9 e rodapé | `mailto:` fixo | — |

- Plural: `1 pãozin` · `N pãezins` (`sbPz`).
- O item 8 fica fora do HTML para o robô não ler um programa que pode estar desligado.

## 3. A página

Medidas (`SB_DIMS`): **mobile 390** com margem lateral 20, seções com 64 px em cima e embaixo, h1 38, h2 27, h3 18, corpo 15,5, subtítulo do hero 16,5. **Desktop 1280** com coluna de 1080 (margem lateral 40), seções com 104 px, h1 62, h2 40, h3 21, corpo 17, subtítulo 19,5. Corpo com linha de 1,55–1,6 e no máximo ~60–64 caracteres (`max-width: 60ch`). Ponto de troca sugerido: **820 px**.

Ordem: S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 + S9 → S10. Fundos: espresso (S1+S2) · appBg (S3) · surface2 em faixa inteira (S4) · appBg (S5–S9) · espresso (S10).

### S1 · Topo
`<header>` sobre o hero (posição absoluta), 64 px no mobile e 84 no desktop. Logo (`BreadMark` dourado 30/38 + "Cheirin de Pão", Bricolage 700, 16,5/20, creme) → link `/sobre/`. À direita: **Entrar** (link creme, alvo 44, sublinhado dourado no hover) e **Criar conta** (`SBBtn` gold `sm`, 44 de altura). Cabe nos 390 px sem menu hambúrguer.

### S2 · Hero
Fundo espresso + brilho radial dourado da splash. Mobile: uma coluna. Desktop: grade 1,05 : 0,95, centrada na vertical.
- Eyebrow "PÃO FRESCO NA PORTA" (dourado, com traço de 18 × 3).
- **h1** "Pão fresquinho na sua porta." — Bricolage 800, −0,03em, `text-wrap: balance`.
- Subtítulo (creme secundário): "O Cheirin de Pão entrega pão fresco na porta do seu apartamento, em condomínios parceiros. Você monta a agenda uma vez e o pão chega sozinho — {frase do turno}." As 4 frases cabem: no mobile ficam em 5 linhas, no desktop em 4.
- CTAs: **Criar minha conta** (gold, 54) e **Já tenho conta · Entrar** (contorno creme 28 %). No mobile ocupam a largura toda, um embaixo do outro; no desktop ficam lado a lado.
- **Ilustração do app** (`SobreHeroArt`, `role="img"` + `aria-label`; os detalhes internos são `aria-hidden`): card branco "Sua agenda · Repete toda semana · Ativa", os 7 dias com a quantidade de pães (Seg 2 · Ter 2 · Qua 2 · Qui 2 · Sex 3 · Sáb 4 · Dom –), "38 pãezins no saldo · Seg · amanhã" e, por cima do canto, o aviso "Seu pão chegou! / Está pendurado no gancho da porta." Atrás, um `BreadMark` gigante a 7 %. Na implementação, pode ser HTML/CSS ou um SVG exportado do quadro.

### S3 · Como funciona
Eyebrow "COMO FUNCIONA" · h2 "Três passos, e o pão chega sozinho." Lista `<ol>` com 3 passos: círculo espresso com ícone dourado (52/64), "PASSO N", h3 e frase curta.
1. `wallet` **Compre pãezins** — "Escolha um combo e pague por Pix ou cartão. Cada pãozin vale um pão."
2. `calendar` **Monte sua agenda** — "Diga quantos pães quer em cada dia da semana. É uma vez só."
3. `hook` **Abra a porta e pegue** — "O pão chega pendurado no seu gancho, sem tocar a campainha."

Mobile: linha do tempo vertical, com traço tracejado accent (45 %) ligando os círculos. Desktop: 3 colunas, com o traço horizontal passando pelos centros.

### S4 · Pãezins, combos e agenda
Faixa surface2. Cabeçalho: eyebrow "PÃEZINS, COMBOS E AGENDA" · h2 "Um saldo de pães que trabalha por você." · "Pãezins são a moeda do Cheirin. Os combos enchem o saldo, a agenda usa sozinha e a compra automática recarrega quando precisa." Ao lado (desktop) ou abaixo (mobile), o selo **"Pãezins não expiram"** (pill gold, check em círculo espresso, Bricolage 800 17/20).

Diagrama (`<ol>`), cards brancos com ícone em quadrado goldSoft e uma seta espresso/dourada (28) entre eles:
1. `wallet` **Combos** — "Pacotes de pãezins, por Pix ou cartão. Cada pão sai mais barato do que na compra avulsa."
2. `coin` **Saldo de pãezins** — "Comprou, caiu na hora. Cada pãozin vale um pão — e também paga o Além do Pãozin."
3. `calendar` **Agenda semanal** — "Gera as entregas sozinha, toda semana, usando os pãezins do saldo."
4. `bag` **Entrega** — "Mudou a rotina? Ajuste até o horário de corte de cada turno, que aparece no app."

**Compra automática** (`repeat`): "Com um cartão cadastrado, quando o saldo não cobrir uma entrega agendada, o app recarrega sozinho o combo que você escolheu — sem digitar o CVV. Sem ela, você recebe um aviso de que os pãezins estão acabando."
- Desktop: 4 colunas. Um "U" tracejado sai da Agenda (3) e volta aos Combos (1), com a ponta da seta para cima. O card da compra automática fica no meio do U.
- Mobile: cards empilhados, com setas para baixo. A compra automática vem por último, num card com borda tracejada accent.

### S5 · Gancho na porta
Mobile: foto (280 de altura) e texto embaixo. Desktop: 2 colunas, com a foto de 460 de altura à esquerda.
- Eyebrow "GANCHO NA PORTA" · h2 "O pão te espera pendurado na porta." · "Um gancho de acrílico transparente que se encaixa na porta. O entregador pendura a sacola de pães nele — e você pega quando abrir a porta."
- `<ul>` com ícone em tile branco 46: `hook` **Sem furar** — "Encaixa na porta, sem ferramentas." · `bellOff` **Sem campainha** — "O entregador pendura a sacola e segue." · `gift` **De graça com o combo** — "Vem junto com a compra de um combo."
- **Asset a produzir:** foto do gancho de acrílico transparente encaixado numa porta de apartamento, com a sacola de pães pendurada. Proporção 4:3 (desktop) e 5:4 (mobile), em luz quente. No quadro é um `image-slot` (`sobre-gancho`): arraste a foto para testar.

### S6 · Além do Pãozin
Bloco goldSoft com raio 24/32 dentro da coluna. Os textos usam `text` (contraste AA sobre goldSoft).
- Eyebrow "ALÉM DO PÃOZIN" · h2 "Monte sua Cestinha — ela chega junto com o seu pão." · "Itens para o café da manhã, entregues na mesma sacola. Pague com pãezins, Pix ou cartão — e dá para combinar."
- 6 categorias (de `MARKET_CATS`), em tiles brancos com ícone em círculo surface2: `jar` Geleias & Mel · `cake` Bolos & Doces · `puff` Pão de Queijo & Salgados · `cup` Bebidas · `cheese` Frios & Frescos · `gift` Especiais. Mobile: 2 colunas, ícone à esquerda. Desktop: 6 colunas, ícone em cima.
- Fotos são opcionais: os ícones resolvem. Se quiserem fotos, uma por categoria, quadrada, fundo claro.

### S7 · Perguntas frequentes
Mobile: título e lista empilhados. Desktop: grade 0,75 : 1,6, com o título à esquerda. Eyebrow "TIRA-DÚVIDAS" · h2 "Perguntas frequentes" · "Não achou sua resposta? Fale com a gente — o contato está logo abaixo."
Lista em card branco. Cada item: pergunta em `<h3>` > botão com 64/72 de altura mínima e Hanken 700 16/17,5. O ícone fica num círculo de 34: `plus` sobre surface2 (fechado) ou `minus` dourado sobre espresso (aberto). A resposta usa corpo `textSec`. No hover do item fechado, o fundo muda para surfaceAlt. Vários itens podem ficar abertos; no protótipo, o 1º começa aberto.

Textos finais:
1. **O que são pãezins?** — Pãezins são a moeda do app: cada pãozin vale um pão fresquinho. Você usa pãezins para agendar seu pão e também para pagar os itens do Além do Pãozin. E eles não expiram.
2. **Como funcionam os combos?** — Combos são pacotes de pãezins. Comprou, os pãezins caem na hora no seu saldo — e cada pão sai mais barato do que na compra avulsa. Pague por Pix ou cartão.
3. **Como funciona a agenda semanal?** — Você escolhe quantos pães quer em cada dia da semana e pronto: a agenda gera as entregas sozinha, toda semana, usando os pãezins do seu saldo. Mudou a rotina? Ajuste quando quiser. Prefere só um dia? Faça um pedido único.
4. **E se meus pãezins acabarem?** — Ative a compra automática: quando o saldo não cobrir uma entrega agendada, a gente recarrega sozinho o combo que você escolheu, no seu cartão cadastrado — sem digitar o CVV. Sem ela, você recebe um aviso para comprar antes.
5. **Até quando posso pedir ou mudar?** — Até o horário de corte de cada turno, que aparece no app. Depois do corte, aquela entrega já está fechada com a padaria.
6. **Posso pausar quando viajar?** — Pode. Pause a agenda num toque: nada é entregue enquanto ela estiver pausada, sua configuração fica guardada e seus pãezins continuam no saldo. Voltou? É só retomar.
7. **Meu condomínio não é atendido. E agora?** — Por enquanto entregamos só em condomínios parceiros. No cadastro, toque em "Meu condomínio não está aqui" e deixe seu contato: quando vários vizinhos pedem, o Cheirin chega mais rápido — e a gente te avisa.
8. **Como funciona o Indique e Ganhe?** *(só ligado)* — Indique um vizinho com o seu link: você ganha {N} pãezins quando o pão chegar na porta dele{, e ele ganha {Y} pãezins no primeiro pedido}.

Estados: ligado com bônus · ligado sem bônus · desligado (7 itens) · item aberto × fechado.

### S8 · Entrar com o Google
Card branco discreto: borda `border`, sem sombra, raio 22. Tile 44 com o **"G" oficial** (22 px, cores originais) + **h2** "Entrar com o Google" (Bricolage 700, 22/26).
- "Dá para entrar no Cheirin de três jeitos: com e-mail e senha, com um código no e-mail ou com a sua conta Google."
- Duas caixas surfaceAlt. **O Cheirin de Pão recebe**: ✓ O identificador da sua conta · ✓ Seu nome · ✓ Seu e-mail — "Só para criar e acessar a sua conta." **E não recebe**: ✕ A senha do Google · ✕ Outros dados da sua conta. (Os títulos das caixas são h3.) Mobile: empilhadas. Desktop: lado a lado.
- Links: `lock` **Política de Privacidade** (`/privacidade`) · `doc` **Termos de Uso** (`/termos`).

### S9 · Contato
Card surface2 (no desktop, ao lado do S8, na proporção 1,55 : 1, com a mesma altura). Ícone `chat` em quadrado espresso · **h2** "Fale com a gente" · "Dúvida, sugestão ou algum problema com a entrega? É só chamar." · **Falar no WhatsApp** (primário espresso, ícone `chat`, largura total) · link `mail` **cheirindepao.contato@gmail.com**.

### S10 · Rodapé
Espresso. `BreadMark` 34 + "Cheirin de Pão" · `<nav aria-label="Rodapé">` com Política de Privacidade · Termos de Uso · e-mail (links creme com sublinhado dourado e alvo 44; empilhados no mobile, em linha no desktop) · divisor · "© 2026 Cheirin de Pão".

### B1 · Boas-vindas do app
Na tela atual, logo abaixo de "PÃO FRESCO NA PORTA", entra o link **"Conheça o Cheirin →"**: Hanken 700 13,5, cor `#C7B595`, sublinhado dourado a 55 % e alvo de 44 px. Abre `/sobre/`. O resto da tela não muda (o quadro mostra "Com o link" e "Hoje").

## 4. Navegação

```
Boas-vindas (app) ─ Conheça o Cheirin → /sobre/
/sobre/ ─┬ Entrar (topo) · Já tenho conta · Entrar (hero)      → /login
         ├ Criar conta (topo) · Criar minha conta (hero)        → /register
         ├ Política de Privacidade (S8, rodapé)                → /privacidade
         ├ Termos de Uso (S8, rodapé)                          → /termos
         ├ Falar no WhatsApp (S9)                              → https://wa.me/<número> (nova aba)
         ├ e-mail (S9, rodapé)                                 → mailto:cheirindepao.contato@gmail.com
         └ Logo                                                → /sobre/
```
Usuário já logado que abre `/sobre/`: a página aparece igual (sem redirecionar). Opcional: "Entrar" vira "Abrir o app" (não desenhado).

## 5. Tokens

Tudo vem de `THEMES.light` (`useT()`): `appBg`, `surface`, `surfaceAlt`, `surface2`, `text`, `textSec`, `textTer`, `border`, `border2`, `accent`, `gold`, `goldSoft`, `espresso`, `primaryBtn(Text)`, `onGold`, `good(Soft)`, `shadowSoft`, `shadow`. Sobre o espresso, o texto usa `THEMES.dark.text` (`#FAF5EC`) e `THEMES.dark.textSec` (`#C7B595`). Brilho do hero: `radial-gradient(120% 80% at 50% -10%, rgba(227,172,63,0.18), transparent 60%)`. Tipos: Bricolage Grotesque (700–800, −0,02 a −0,03em) e Hanken Grotesk. Raios: botão 16 · card 18–22 · bloco S6 24/32 · pill 999.

- **`SBBtn`** é o `Btn` em `<a>`, com a mesma geometria: raio 16, Hanken 700, alturas 44/48/54 e hover −1 px + brilho. Variantes `primary`, `gold`, `ghost` e `ghostDark` (contorno `rgba(250,245,236,.28)`).
- **Exceção:** o "G" do Google (`GoogleG`) mantém as cores e a proporção oficiais, num tile branco.
- **Ícones novos em `brand.jsx`:** `arrowR`, `bellOff`, `jar`, `cake`, `puff`, `cup`, `cheese`. Reaproveitados: `hook`, `wallet`, `coin`, `calendar`, `bag`, `repeat`, `gift`, `chat`, `mail`, `lock`, `doc`, `check`, `x`, `plus`, `minus`, `chevR`, `chevD`.

## 6. Acessibilidade e pontas soltas

- **Hierarquia:** um único `h1` (hero) → `h2` por seção (Como funciona, Pãezins…, Gancho, Além do Pãozin, Perguntas frequentes, Entrar com o Google, Fale com a gente) → `h3` nos passos, cards, perguntas do FAQ e caixas do S8. Marcos: `<header>`, `<main>`, `<footer>`, `<nav aria-label="Conta">` e `<nav aria-label="Rodapé">`.
- **FAQ:** `<details><summary>` na implementação estática. No protótipo, `button[aria-expanded][aria-controls]` + `role="region"`. Navega por Tab, Enter e Espaço.
- **Foco visível:** contorno dourado de 3 px com 3 px de afastamento em todos os links e botões (`SB_CSS`).
- **Contraste AA:** o texto pequeno usa `text` ou `textSec` sobre os fundos claros e creme sobre o espresso. Eyebrows ficam em `textSec`, e o accent (`#B0702A`) só aparece em detalhes. Os links são `text` com sublinhado accent, porque o accent em texto pequeno sobre o creme fica abaixo de 4,5:1. No bloco goldSoft, tudo usa `text`.
- **Alvos ≥ 44 px:** botões 44–54, links de texto com `min-height: 44`, itens do FAQ com 64/72.
- **Imagens:** `alt` da foto do gancho: "Gancho de acrílico transparente encaixado na porta de um apartamento, com uma sacola de pães pendurada." A ilustração do hero é `role="img"` com `aria-label`. Ícones e o `BreadMark` decorativo ficam `aria-hidden`; o logo do topo fica dentro do link com `aria-label="Cheirin de Pão"`.
- **SEO / robô:** `<title>` "Cheirin de Pão — Pão fresquinho na sua porta" e `meta description` com a frase do hero (já no `Cheirin de Pão - Sobre.html`). Página indexável, sem `noindex`.
- **Pontas soltas:**
  - Número real do WhatsApp (placeholder `5511900000000`).
  - Endpoint público dos turnos (sem login) e tempo limite para cair no neutro (sugestão: 2 s).
  - Endpoint público da config do Indique e Ganhe (`ativo`, `recompensa`, `bonusAmigo`).
  - Foto do gancho (S5) a produzir; fotos das categorias são opcionais.
  - O brief descreve a splash com "Já tenho conta · Entrar" (botão) e "Quero criar minha conta" (link). O protótipo ainda mostra "Instalar e criar conta" e "Já tenho conta — entrar". O link B1 fica sob o logo, então vale para as duas versões.
  - O passo 3 (S3) não usa a frase do turno. Se quiserem, ele aceita "…chega pendurado no seu gancho, {de manhã | à tarde}".
  - Conferir com as diretrizes atuais de verificação de marca do Google antes de reenviar (nome, logo e links iguais aos do consentimento).
