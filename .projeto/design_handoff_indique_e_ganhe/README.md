# Handoff: Indique e Ganhe (Cheirin de Pão)

## Sobre os arquivos deste pacote
Os arquivos em `design/` são **referências de design feitas em HTML/React (Babel no navegador)**. Eles mostram o visual e o comportamento esperados. **Não são código de produção para copiar.** A tarefa é **recriar essas telas no código real do app Cheirin de Pão**, usando os padrões, componentes e bibliotecas que ele já tem. Os mocks de `data.jsx` indicam o formato dos dados, que deve vir do backend.

## Fidelidade
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, raios, sombras, textos e estados são finais. Reproduza com precisão usando os tokens do design system do app, que batem com `design/app/brand.jsx`.

## Como abrir as referências
- `design/Indique e Ganhe - Telas.html`: quadro com **todas as telas e estados** (cliente C1–C8, admin A1–A8). Abra no navegador; dá para mover e dar zoom, e cada quadro tem modo foco.
- `design/Cheirin de Pão - App.html`: protótipo navegável com a feature integrada. Use o seletor Cliente/Admin no topo.
  - **Cliente:** aba Perfil › Indique e ganhe; Home (card + comemoração); cadastro (código no passo 1, lista de espera no passo 3).
  - **Admin:** Gestão › Indique e Ganhe.
- Os componentes aceitam `st` / `variant` para forçar cada estado. Veja a tabela de estados de cada tela abaixo.

## Capturas
`screenshots/` traz uma imagem por grupo de telas, com todos os estados lado a lado:
- `01-c1-indique-e-ganhe.png`
- `02-c2-perfil.png`
- `03-c3-home.png`
- `04-c4-cadastro.png`
- `05-c5-comemoracao.png`
- `06-c6-c7-notificacoes-extrato.png`
- `07-c8-lista-de-espera.png`
- `08-a1-a3-gestao-configuracao.png`
- `09-a4-indicacoes.png`
- `10-a5-detalhe-cliente.png`
- `11-a6-a8-relatorio-condominios-prefs.png`

Os nomes dos estados em cada captura correspondem aos valores de `st` / `variant` dos componentes.

## Plano de implementação sugerido
1. **Backend:**
   - modelos `ReferralConfig`, `Referral`, `CondoInterest` e os tipos novos no extrato (§2);
   - geração do código;
   - endpoint público de validação do código, com rate limit;
   - gatilho da recompensa na **1ª entrega recebida** (idempotente).
2. **Admin:** A3 Configuração → A4 lista/detalhe (aprovar/recusar) → A1 badge → A5 → A6 → A7 → A8.
3. **Cliente:** C4 (captura do `?ref=` e do código digitado) → C1 → C2/C3 → C6/C7 → C5 (fila de overlays) → C8.
4. **Ícones novos:** `share`, `copy`, `link`, `chat`, `target`, `ticket` (paths SVG em `design/app/brand.jsx`, objeto `Ic`).
5. **Tokens novos:** `danger #B23A2E` e `dangerSoft #F6E0DC`.

---

## Especificação completa

Especificação do programa de indicação. Referências visuais:
- **`Indique e Ganhe - Telas.html`**: quadro com todas as telas e estados, cliente e admin.
- **`Cheirin de Pão - App.html`**: protótipo navegável, já com as telas integradas.

Tokens e primitivas ficam em `app/brand.jsx`; os mocks, em `app/data.jsx`.

**Arquivos da feature**
- `app/screens-referral.jsx`: componentes reutilizáveis do cliente (`RefStatePill`, `RefCode`, `RefCodeCard`, `RefShareButtons`, `RefItem`, `RefHero`, `RefHowItWorks`, `RefSummary`, `RefGoals`, `RefRules`, `RefSkel`, `RefToast`) e a tela **C1** (`ReferralScreen`).
- `app/screens-referral2.jsx`:
  - **C2**: `ProfileHub` e `ProfRow`, o hub do Perfil como está hoje, com a seção nova;
  - **C3**: `RefHomeCard`;
  - **C4**: `RegisterReferral`, `RefBadge`, `RefCodeField`.
- `app/screens-referral3.jsx`:
  - **C5**: `RefCelebration`;
  - **C6**: `RefNotifs` e `REF_NOTIFS`;
  - **C7**: `RefStatement`;
  - **C8**: `RefWaitlist`.
- `app/screens-referral-admin.jsx`:
  - **A1**: `RAGestaoCard`;
  - **A2**: `RAHub`;
  - **A3**: `RAConfig`;
  - **A4**: `RAList` e `RADetail`;
  - auxiliares: `RAPill`, `RASignal`, `RAChips`, `RAInline`.
- `app/screens-referral-admin2.jsx`:
  - **A5**: `RAClientGeral` e `RALinkSheet`;
  - **A6**: `RAReport`;
  - **A7**: `RACondoInterests`;
  - **A8**: `RANotifPrefs`.
- **Integrações:**
  - `app/app.jsx`: rotas, tab bar de 5 itens (Início · Agenda · Pãezins · Cestinha · Perfil) e o overlay C5;
  - `screens-home.jsx`: `HomeRefSlot`;
  - `screens-onboarding.jsx`: `OnbRefCode` no passo 1 e o botão da lista de espera no passo 3;
  - `screens-client-extra.jsx`: os tipos novos na central de notificações;
  - `screens-admin2.jsx`: card no hub de Gestão, sub-rotas `indique` e `indique-rel`, e o A7 dentro de Condomínios.

> Todo componente aceita `st` / `variant` para forçar um estado. No app real, o estado vem dos dados.

---

### 1. Conceito e regras

- **Quem indica** ganha **X** pãezins (`recompensa`). **O amigo** ganha **Y** (`bonusAmigo`). Se Y = 0, **nenhum texto sobre bônus do amigo aparece**: hero, passo 3 do "Como funciona", selo do cadastro, mensagem e notificações.
- **Gatilho:** o amigo **paga e recebe a 1ª entrega** (pão ou Cestinha). Os dois são creditados no mesmo evento. A interface repete isso em linguagem simples: "Vale quando o pão chegar na porta dele".
- **Campanha:** X × multiplicador para indicações **feitas** no período. A campanha aplicada fica congelada na indicação.
- **Metas:** um bônus extra ao atingir a N-ésima indicação *que valeu*. O limite é de até 5 metas.
- **Prazo** (`prazoDias`, 0 = sem prazo): se o amigo não receber a 1ª entrega a tempo, o estado vira `expirou`.
- **Compra mínima** (`compraMinima`, 0 = qualquer valor): vale para o 1º pedido do amigo.
- **Limite mensal** (`limiteMensal`): acima do limite, a indicação vai para `analise`. **O cliente nunca vê esse número.**
- **Privacidade:** quem indica vê só o primeiro nome + inicial e o estado.
- **Programa desligado:**
  - as entradas somem (C2, C3, C4);
  - `ReferralScreen` continua acessível a quem já tem indicações, em estado `paused`: só histórico, sem compartilhar.
- **Código:** o formato é `NOME` + 4 caracteres, por exemplo `JOAO7K2F`.
  - Sempre maiúsculo e sem caracteres ambíguos (evitar 0/O e 1/I no sufixo).
  - Aparece em 2 grupos visuais (`JOAO` · `7K2F`) e tem `aria-label` soletrado.
- **Link:** `app.cheirindepao.com.br/?ref=CODIGO`. No iPhone o link pode se perder na instalação, por isso **a mensagem sempre leva o código escrito**.

### Estados (visão de quem indicou → admin)
| chave | Cliente vê | Admin vê | Pill |
|---|---|---|---|
| `cadastro` | Cadastro em andamento | Cadastro | neutral + edit |
| `aguardando` | Aguardando 1º pedido | Aguardando | gold + clock |
| `analise` | Em análise | Em análise | neutral (cliente) / gold (admin) + search |
| `ganhou` | Ganhou +X | Recompensada | good + check |
| `recusada` | Não valeu | Recusada (+ motivo) | neutral + x |
| `expirou` | Prazo encerrado | Expirada | neutral + clock |

---

### 2. Modelo de dados (mock → backend)

```
ReferralConfig { ativo, recompensa, bonusAmigo, compraMinima (R$), limiteMensal, prazoDias,
                 campanha: { rotulo, multiplicador (2..5), inicio, fim } | null,
                 metas: [{ quantidade, bonus }] (≤5), mensagem (com {codigo} {link} {nome} {bonus}) }
Referral { id, indicadorId, indicadoId, codigo, estado, criadoEm,
           x, y, campanha (congelados no cadastro),
           sinais: ['mesmo_apto'|'mesmo_aparelho'|'limite_mes'|'indicador_bloqueado'],
           timeline: { cadastro, login, pagamento, entrega, recompensa },
           motivoRecusa? (só admin) }
Customer += { codigoIndicacao, indicadoPor?: referralId }
CondoInterest { id, condominio, cep?, cidade, nome, contato (email|celular), viaIndicacao, codigo?, criadoEm, tratado }
Ledger (extrato) += tipos: 'indicacao' (+X) · 'boas_vindas_indicacao' (+Y) · 'meta_indicacao' (+B)
```

- **Mocks:** `REFERRAL_CFG`, `MY_CODE`, `MY_REFERRALS`, `REFERRAL_REPORT`, `ADMIN_REFERRALS`, `CONDO_INTERESTS`.
- **Helpers:** `refMsg(cfg, code, nome)` monta a mensagem e remove o trecho do bônus quando Y = 0; `paez(n)` escreve "1 pãozin" / "5 pãezins"; `REF_LINK(code)` monta o link.
- **`REF_UNIT` (R$ 1,00 por pãozin)** é o custo estimado usado no "≈ R$" e no relatório. No app, derive do pricing real. O `avulsoUnit` atual do protótipo é R$ 1,20, e o brief usa "5 ≈ R$ 5,00".

---

### 3. CLIENTE

#### C1 — Indique e ganhe (`ReferralScreen`, rota `referral`)
**Layout, de cima para baixo:**
1. AppBar com voltar, que leva ao Perfil.
2. **Hero espresso:**
   - eyebrow "INDIQUE E GANHE" e selo dourado da campanha ("Semana em dobro · até 11/10");
   - título "Indique um vizinho e ganhe **X pãezins**", com X em dourado; com campanha, entra também "Em vez de 5…";
   - linha do amigo: "Seu amigo ganha Y no primeiro pedido. Vale quando o pão chegar na porta dele.";
   - **cartão-tíquete do código** com contorno pontilhado dourado e botão **Copiar**, que vira "Copiado!" em verde por 1,8 s.
3. **Compartilhar:**
   - principal: **Enviar no WhatsApp**, botão espresso com ícone `chat`, que abre `wa.me/?text=`;
   - secundárias: **Mais opções** (Web Share API) e **Copiar link** (vira "Link copiado").
4. **Seu resumo:** pãezins ganhos (verde) · indicações que valeram · em andamento.
5. **Metas:** mensagem ("Faltam N indicações para ganhar +B pãezins"), barra dourada e marcos (5ª +10, 10ª +25).
6. **Seus indicados**, com a nota "Só você vê": avatar com a inicial, nome curto, pill de estado + data, "+X" à direita e "em dobro" quando foi campanha.
7. **Como funciona:** 3 passos numerados, sendo o 3º um presente dourado. Sem indicações, esse bloco sobe para antes da lista.
8. **Regras**, recolhível (`aria-expanded`): prazo, compra mínima, uma indicação por pessoa, "não vira dinheiro nem expira", análise, encerramento.

**Estados:**
| Estado | Como fica |
|---|---|
| `loading` | skeleton com shimmer |
| `empty` | lista vazia convidativa com o BreadMark: "Sua lista começa aqui" |
| `full` | lista com todos os estados |
| `campaign` | selo da campanha no hero |
| `goal` | card da meta verde com estrela: "Meta atingida! +10 pãezins pela 5ª indicação" + próxima meta |
| `nobonus` | sem linha do amigo; passo 3 = "Você ganha" |
| `paused` | hero "O programa está pausado", sem código nem compartilhar, sem metas; resumo + lista + regras |
| `error` | card "Não conseguimos carregar" + Tentar de novo |

#### C2 — Entrada no Perfil (`ProfileHub`, rota `profile`, aba Perfil)
- Seção própria **"Indique e ganhe"** entre Pedidos e Conta.
- A linha tem ícone `gift` em quadrado dourado suave, título, a descrição "Ganhe X pãezins por amigo" e um pill.
- O pill diz "novo", ou "Semana em dobro" durante a campanha.
- **Desligado:** a seção inteira some.

#### C3 — Card na Home (`RefHomeCard` via `HomeRefSlot`)
- **Posição:** depois das ações rápidas, antes de "Além do Pãozin".
- **Conteúdo:** card compacto branco com ícone dourado, título "Indique um vizinho, ganhe X pãezins", "Quando o pão chegar na porta dele.", CTA "Indicar agora" e X de fechar (alvo de 44 px).
- **Campanha:** fundo `goldSoft`, ícone em gold e o eyebrow "SEMANA EM DOBRO · ATÉ 11/10".
- **Regras:**
  - só aparece se o cliente já tem ≥ 1 entrega recebida (a implementar com dados reais);
  - fechado, fica escondido por 30 dias (no protótipo, `localStorage` `cheirin_ref_home`).

#### C4 — Cadastro com indicação (passo 1 "Seus dados")
- **Veio pelo link:** selo dourado **acima do título**: "Indicado por João M." + "Você ganha Y pãezins quando o 1º pedido chegar", com o link "Trocar" (abre o campo).
- **Sem link:** link discreto "Tenho um código de indicação" abaixo dos campos, que abre o **campo** (maiúsculas automáticas, fonte Bricolage espaçada).
- **Estados do campo:**
  - digitando: dica de formato;
  - validando: spinner + "Conferindo o código…";
  - válido: borda verde, check e o selo abaixo;
  - inválido: aviso suave em accent ("Não achamos esse código. Confira as letras — ou siga sem ele, sem problema.") — **o Continuar nunca é bloqueado pelo código**, só durante a validação;
  - sem bônus (Y = 0): o selo mostra só "Indicado por João M.";
  - programa desligado: nada aparece.
- A validação acontece ao sair do campo. No protótipo integrado há um link "Validar", e `JOAO7K2F` é o código válido.

#### C5 — Comemoração (`RefCelebration`)
- **Ordem dos overlays na abertura:** tutorial → consentimento do gancho → **comemoração** → pop-up de banner. Nunca dois ao mesmo tempo. Aparece uma vez por recompensa, e várias recompensas pendentes se agrupam num só modal.
- **Layout:** sheet inferior com radius 28 e halo `goldSoft`; medalhão espresso com o BreadMark dourado; eyebrow; número de destaque **+N** (56 px) + "pãezins"; título; texto; CTA primário; "Agora não".
- **Variantes:**
  - `referrer`: "Você ganhou 5 pãezins!", CTA **Indicar mais**;
  - `friend`: "Chegou presente pra você · 3 pãezins… indicação do João", CTA **Ver meu saldo**;
  - `goal`: "+10 pãezins pela 5ª indicação";
  - `multi`: "Você ganhou 15 pãezins com 3 indicações", com avatares das iniciais.
- `role="dialog"`, `aria-modal`, título em `aria-labelledby`, fechar com 44 px.

#### C6 — Notificações (4 tipos novos)
Ícone em **círculo**; item novo com **borda dourada**; o botão fica em gold quando o tom é dourado e em `surface2` nos outros.
| Tipo | Ícone | Tom | Botão |
|---|---|---|---|
| Amigo se cadastrou | users | verde | Ver indicações → `referral` |
| Você ganhou | gift | dourado | Ver saldo → `statement` |
| Boas-vindas (amigo) | gift | dourado | Ver saldo |
| Convite após a 1ª entrega | spark | neutro | Indicar agora → `referral` |
Os textos são os do brief. O emoji só aparece no texto.

#### C7 — Extrato (`RefStatement`, rota `statement`)
- Cabeçalho espresso com o saldo (aceita fração, "12,5") + "Bônus de indicação +15 este mês".
- As linhas de bônus ("Indique e ganhe" +5, "Meta de 5 indicações" +10, "Boas-vindas por indicação" +3) têm **ícone em círculo dourado**, **pill "Bônus"** e valor em accent.
- A "Compra de pãezins" fica em círculo neutro, com valor em verde e o meio de pagamento/R$ na descrição.
- Usos (entrega, Cestinha) aparecem em neutro com "−".
- Rodapé: "Pãezins de bônus não viram dinheiro e não expiram."

#### C8 — Lista de espera (passo 3 → `waitlist`)
- **Entrada:** estado vazio da busca, "Seu condomínio ainda não é parceiro" + botão gold **Meu condomínio não está aqui**.
- **Formulário:** nome do condomínio, CEP (opcional) + cidade, seu nome, "E-mail ou celular" (um dos dois basta) e o botão **Avisar quando chegar**.
- **Estados:** enviando (spinner, campos esmaecidos) · erro (faixa `dangerSoft`, "Seus dados continuam aqui", **Tentar de novo**) · sucesso ("Anotado! Avisamos quando o Cheirin chegar no …").
- Se o cliente veio com código de indicação, ele fica guardado no interesse (`viaIndicacao` + `codigo`).

---

### 4. ADMIN

- **A1 — Gestão:** card "Indique e Ganhe · Recompensas, regras e indicações" no topo do hub, com o badge gold "N em análise".
- **A2 — Hub (`RAHub`):**
  - AppBar com atalho `trend`, que leva ao relatório;
  - segmento **Configuração · Indicações**, com contagem na aba Indicações.

#### A3 — Configuração (`RAConfig`)
- **Toggle "Programa ativo"**: quando ligado, o card ganha borda dourada; desligado, mostra o texto explicativo.
- **Recompensas:**
  - Quem indica ganha (stepper, "≈ R$");
  - Bônus do amigo (0 = sem bônus).
- **Regras:**
  - Compra mínima (R$);
  - Limite por indicador/mês;
  - Prazo (dias).
- **Campanha:** toggle + rótulo + multiplicador 2×–5× em botões + data de início/fim + a frase ao vivo "ganha 10 em vez de 5".
- **Metas:** linhas "Na [5ª] indicação, [+10]" com lixeira, "Adicionar meta" (desabilita em 5) e estado vazio.
- **Mensagem:** textarea + chips `{codigo}` `{link}` `{nome}` `{bonus}` + **prévia** em balão de conversa, com as variáveis substituídas.
- **Salvar**, desabilitado quando há erro.

**Estados:**
| Estado | Aviso |
|---|---|
| `off` | programa desligado |
| `zeroErr` | "defina uma recompensa maior que 0" |
| `noGoals` | metas vazias |
| `msgErr` | borda vermelha: "precisa de {codigo} ou {link}" |
| `bonusWarn` | aviso gold: "vai aparecer 'ganha 0 pãezins'" |
| `saving` | spinner |
| `saved` | "valem para novas indicações — as antigas mantêm os valores" |

#### A4 — Indicações
- **Lista:**
  - chips: **Em análise** (primeiro, com contagem) · Aguardando (inclui cadastro) · Recompensadas · Recusadas · Expiradas · Todas;
  - busca;
  - card "João Silva → Maria Souza", pill, data · condomínio e **sinais** como chips vermelhos com alerta;
  - itens em análise têm borda dourada.
- **Estados da lista:** loading (skeleton) · vazio por filtro.
- **Detalhe (sheet):**
  - as duas pessoas como botões (atalho para o cliente);
  - sinais;
  - valores congelados (Quem indicou +X · Amigo +Y · Campanha);
  - **linha do tempo** (cadastro · 1º login · 1º pagamento · 1ª entrega · recompensa/análise "aguardando você");
  - **Recusar** / **Aprovar**.
- **Estados do detalhe:**
  - confirmar aprovação: explica quem ganha o quê;
  - recusar: chips de motivo + detalhe obrigatório; "O cliente vê apenas 'Não valeu'"; botão em `danger`;
  - sucesso.

#### A5 — Detalhe do cliente · Geral
- **Card Cadastro:** a linha **"Indicado por João Silva ›"** logo abaixo de "Membro desde". Se o cliente não tem indicação, a linha vira a ação **Vincular indicação**.
- **Card Indicações:** o código do cliente; fez / valeram / pãezins ganhos; lista curta com pill.
- **Sheet "Vincular indicação":**
  - válido: mostra o dono do código e o que acontece ao confirmar;
  - inválido;
  - próprio cliente;
  - sucesso;
  - já tem indicação: a ação não aparece (a linha "Indicado por" fica no lugar).

#### A6 — Relatório "Indicações" (Relatórios › Aquisição & clientes)
- Chips de período.
- **KPIs** em grade 2 col (cadastros, recompensadas, conversão, pãezins concedidos) + **custo estimado** em card espresso de largura total, com a divisão indicador/amigo.
- **Funil** em barras, com % de passagem entre as etapas.
- **Custo × receita**, com "cada R$ 1 em bônus trouxe R$ X".
- **Top 5 indicadores.**
- **Distribuição por estado:** barra empilhada + legenda com contagem e %.
- **Estados:** carregando · sem dados.

#### A7 — Condomínios › Pedidos de novos condomínios
- Agrupado por condomínio: nome, cidade, nº de pedidos e pill "N por indicação".
- Cada grupo expande para mostrar os contatos (nome, contato, data, "indicado") e o botão **Marcar como tratado / Reabrir**.
- Grupos tratados ficam esmaecidos, com pill verde.

#### A8 — Preferências de notificação
Três toggles novos, com pill "novo":
- Indicação para analisar;
- Indicação recompensada;
- Pedido de novo condomínio.

---

### 5. Navegação

**Tab bar do cliente:** Início · Agenda · **Pãezins** (antiga "Créditos") · Cestinha · **Perfil** (substitui "Pedidos", que agora é Perfil › Meus pedidos).

| Rota | Tela | Chega por |
|---|---|---|
| `profile` | Perfil (C2) | aba Perfil |
| `referral` | C1 | Perfil › Indique e ganhe · card da Home · notificações · C5 "Indicar mais" |
| `statement` | C7 | notificações "Ver saldo" · C5 "Ver meu saldo" |
| `waitlist` | C8 | Cadastro passo 3 › "Meu condomínio não está aqui" |
| overlay C5 | — | abertura na Home (uma vez; no protótipo, `refCelebSeen`) |

**Admin:**
- Gestão › `indique` (A2/A3/A4) › `indique-rel` (A6);
- Gestão › Condomínios (A7 abaixo da lista);
- Clientes › detalhe › Geral (A5);
- Relatórios › Aquisição & clientes › Indicações (A6).

---

### 6. Tokens usados

- **Superfícies e texto:** `appBg`, `surface`, `surfaceAlt`, `surface2`, `text`, `textSec`, `textTer`, `border`, `border2`.
- **Identidade da área:**
  - `gold` é o fio condutor: selos, metas, CTA do código, borda de novo;
  - `goldSoft` e `accent` também fazem parte desse fio;
  - `espresso` fica nos blocos de destaque (hero C1, saldo do extrato, custo no relatório, medalhão C5).
- **Estados:** `good` / `goodSoft` para ganho e sucesso; **`danger #B23A2E` / `dangerSoft #F6E0DC`**, adicionados em `brand.jsx`, só para erros de formulário e sinais do admin.
- **Tipografia:** Bricolage Grotesque 700–800 em títulos e números (código 30 px, +N 56 px); Hanken Grotesk no restante.
- **Raios:** campo 14 · botão 16 · card 18–22 · hero 24 · sheet 26–28 · pill 999.
- **Sombras:** `shadowSoft` / `shadow`.
- **Ícones novos em `Ic`:** `share`, `copy`, `link`, `chat` (balão, usado no WhatsApp — sem logotipo), `target` (metas), `ticket` (código de indicação).
- **Keyframes** (no HTML): `rfShimmer`, `rfSpin`, `rfBlink`.

---

### 7. Acessibilidade e pontas soltas

**Acessibilidade**
- Todo estado tem **ícone + texto** no pill, sem depender de cor. Os sinais do admin também levam ícone de alerta.
- O código tem `aria-label` soletrado. Os feedbacks "Copiado!" e toast são `aria-live` / `role="status"`, e os erros usam `role="alert"`.
- Os modais e sheets têm `role="dialog"` + `aria-modal`. Implementar trap de foco e devolver o foco ao gatilho.
- Alvos ≥ 44 px: fechar, lixeira, "Trocar", link do código, botões de compartilhar (48) e steppers (os do admin são 34 px, herdados do `Stepper`; considerar aumentar).

**Pontas soltas**
- **Mensagem sem bônus:** `refMsg` remove o trecho "e ganha {bonus} pãezins no primeiro pedido". Com uma mensagem personalizada, o backend precisa de um template alternativo, ou o admin é avisado (estado `bonusWarn`).
- **Compartilhar:** o WhatsApp usa `https://wa.me/?text=` com `encodeURIComponent`. "Mais opções" usa `navigator.share` e, sem suporte, cai em copiar.
- **Sinais de análise:** calcular no servidor (apartamento, fingerprint do aparelho, limite mensal, indicador bloqueado). **Nunca expor ao cliente.**
- **C3:** a regra "≥ 1 entrega" e os 30 dias no servidor (preferência por usuário).
- **Fila de overlays da abertura:** implementar como fila única com prioridade.
- **Validação do código no cadastro:** o endpoint público precisa de rate limit e devolve só o primeiro nome + inicial do dono.
- **Campanhas sobrepostas:** não permitir (validar datas no A3).
