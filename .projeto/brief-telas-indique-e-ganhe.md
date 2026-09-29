# Brief de telas — "Indique e Ganhe" (para o Claude Design)

> **Como usar:** cole este documento inteiro no Claude Design, dentro do projeto do protótipo do
> Cheirin de Pão (o mesmo usado para o "Além do Pãozin").
> **Fluxo:** gerar os designs → revisar → entregar o handoff → entrar no plano de implementação
> ([`docs/plano-indique-e-ganhe.md`](./docs/plano-indique-e-ganhe.md), §11).
>
> ✅ **Handoff entregue em 28/09/2026:** [`design_handoff_indique_e_ganhe/`](./design_handoff_indique_e_ganhe/README.md).
> A conferência contra o plano e os adendos estão na §11 do plano.

---

## Pedido

Desenhe, no protótipo existente do **Cheirin de Pão** (`Cheirin de Pão - App.html` + `app/*.jsx`),
todas as telas da nova funcionalidade **Indique e Ganhe**, para os perfis **Cliente** e **Admin**,
em **alta fidelidade**, com todos os estados listados abaixo.

Ao final, entregue um **handoff** no mesmo formato do handoff do Além do Pãozin (seção 8 deste
brief): arquivos de tela novos no protótipo, integrações nas telas existentes, dados de exemplo e
um documento `handoff-indique-e-ganhe.md` com a especificação de cada tela.

**Não** recrie o "chrome" de demonstração do protótipo (troca de perfil/tema/variação). Tema
**claro** apenas. Idioma **português (BR)**, no tom aconchegante e descontraído da marca.

---

## 1. O app hoje — o protótipo está desatualizado, siga isto

O app real evoluiu depois do protótipo original. Desenhe as telas novas **encaixadas no app como
ele é hoje**:

- **Vocabulário:** os créditos se chamam **pãezins** (singular **pãozin**). 1 pãozin = 1 pão. O
  saldo pode ter fração (ex.: "12,5 pãezins").
- **Tab bar do cliente (5 itens, não adicione outro):** Início · Agenda · Pãezins · Cestinha ·
  Perfil. "Meus pedidos" fica dentro do Perfil.
- **Perfil (hub do cliente):** cartão do cliente no topo; depois seções com rótulo pequeno e um
  card de linhas (ícone em quadrado suave, título, descrição curta, chevron):
  **Pedidos** (Meus pedidos) · **Conta** (Minha conta, Meus cartões, Compra automática, Meu gancho)
  · **Notificações** (toggle) · **Ajuda** (Falar com o suporte, Rever tutorial) · botão Sair.
- **Home (ordem dos blocos):** saudação com sino → faixa de aviso (banner) → convite para ativar
  notificações → card de saldo espresso ("Carteira") → carrossel da entrega de hoje → alerta de
  risco → ações rápidas (3 colunas) → bloco "Além do Pãozin" → próximos dias.
- **Cadastro (5 passos com dots):**
  1. "Seus dados" — nome, CPF, nascimento;
  2. "Como falamos com você?" — e-mail, celular, senha + confirmação;
  3. "Onde você mora?" — busca de condomínio. Vazio: "Seu condomínio ainda não é parceiro";
  4. "Seu endereço" — bloco, complemento, apartamento;
  5. "Confirme seu cadastro" — código de 4 dígitos enviado por e-mail.
- **Central de notificações:** cards com ícone em círculo colorido por tom (verde = bom, dourado =
  atenção/presente, neutro); item novo com borda dourada; um botão de ação por tipo.
- **Overlays na abertura do app, nesta ordem:** tutorial → consentimento do gancho →
  **(novo) comemoração da indicação** → pop-up de banner. Nunca dois ao mesmo tempo.
- **Admin:** navegação inferior com 6 abas (Painel · Pedidos · Separação · Entregas · Clientes ·
  Gestão).
  - **Gestão** é um hub de cards (ícone, título, descrição).
  - **Relatórios** é um hub com três grupos: "Vendas & performance", "Aquisição & clientes" e
    "Operação & financeiro". Cada relatório tem seletor de período.
  - O **detalhe do cliente** tem as abas Geral · Pedidos · Financeiro · Atividade. A Geral mostra
    métricas, o card Cadastro (com a linha "Membro desde"), o card de saldo (+ / − pãezins),
    ganchos, agenda, pedidos recentes, notas e sessões.
- **Ícones existentes** (traço 24×24, `currentColor`): home, bag, calendar, clock, lock, user,
  plus, minus, check, bell, pin, building, truck, x, edit, card, coin, spark, list, phone, mail,
  gift, star, settings, wallet, trend, logout, repeat, download, doc, percent, ban, route, alert,
  factory, scissors, refresh, users, power, search, basket, trash, camera.
  - **Faltam `share` e `copy`.** Desenhe os dois no mesmo estilo e liste no handoff qualquer outro
    que criar (ex.: `link`, balão de conversa).
  - Não use o logotipo do WhatsApp: um balão de conversa + o texto "WhatsApp" basta.

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
  card 15–18, corpo 13–15, rótulos 11–12,5, números de destaque 24–56.
- **Raios:** campo 14 · botão 16 · card 18–22 · pill 999.
- **Sombras:** suave `0 1px 2px rgba(43,26,12,.05), 0 4px 14px -8px rgba(43,26,12,.18)`; forte
  `0 1px 2px rgba(43,26,12,.05), 0 10px 30px -12px rgba(43,26,12,.22)`.
- **Primitivas a reutilizar:** `Btn`, `Card`, `Pill`, `Field`, `AppBar`, `Stepper`, `Switch`,
  `Row`, `StatusBar`, o símbolo `BreadMark` e os ícones `Icon`/`Ic`.
- **Palco:** mobile, **390 px** de largura. Alvos de toque **≥ 44 px**.
- **Identidade da área:** o **dourado** é o fio condutor (presente, recompensa) e o **espresso**
  entra nos blocos de destaque — como o card de saldo da Home. Sem emoji na marca; emoji só em
  texto de mensagem e notificação.

---

## 3. A funcionalidade — regras que a interface precisa mostrar

- **Quem indica** ganha **X pãezins**. **O amigo indicado** ganha **Y pãezins** de boas-vindas.
  X e Y são definidos pelo admin, e **Y pode ser 0**: nesse caso nada sobre bônus do amigo aparece.
  Desenhe as variantes **com** e **sem** bônus do amigo nas telas C1, C4 e na mensagem.
- **Quando paga:** quando o amigo **paga e recebe a primeira entrega** (pão ou Cestinha). Os dois
  ganham no mesmo momento. Não é na hora do cadastro — a interface deve deixar isso claro sem
  parecer letra miúda.
- **Estados de uma indicação, na visão de quem indicou:**

  | Estado | Significado |
  |---|---|
  | Cadastro em andamento | O amigo começou o cadastro, mas ainda não entrou no app |
  | Aguardando 1º pedido | Cadastrou e entrou; falta pagar e receber a primeira entrega |
  | Em análise | O admin está conferindo (ex.: mesmo apartamento) |
  | Ganhou +X | Recompensa creditada |
  | Não valeu | O admin recusou (mostrar só um motivo genérico) |
  | Prazo encerrado | O amigo não fez o 1º pedido no prazo |

- **Extras configuráveis:**
  - **Campanha** por período (ex.: "Semana em dobro": X × 2 para quem indicar nesses dias) — quando
    ativa, merece destaque;
  - **Metas** (ex.: na 5ª indicação, +10 pãezins; na 10ª, +25) — mostrar o progresso;
  - **Prazo** para o amigo fazer o 1º pedido (ex.: 60 dias);
  - **Compra mínima** do amigo em R$ (0 = qualquer);
  - **Limite por mês** (acima disso vai para análise; o cliente não vê esse número).
- **Código e link:** código como `JOAO7K2F` (nome + 4 caracteres); link
  `app.cheirindepao.com.br/?ref=JOAO7K2F`.
  - **No iPhone o link pode se perder** quando o amigo instala o app. Por isso o código precisa ser
    **fácil de ler, ditar e digitar**, e a mensagem compartilhada leva o código escrito.
- **Privacidade:** quem indica vê só o primeiro nome + inicial ("Maria S.") e o estado. Nunca
  endereço, condomínio ou contato.
- **Programa desligado:** as entradas somem. Quem já tem indicações ainda abre a tela, em estado
  "programa pausado", com o histórico.
- **Mensagem padrão compartilhada** (o admin edita): "Oi! Recebo pão fresquinho na porta com o
  Cheirin de Pão 🥖 Cadastra com o meu código JOAO7K2F e ganha 3 pãezins no primeiro pedido:
  app.cheirindepao.com.br/?ref=JOAO7K2F"

---

## 4. CLIENTE

### C1. Tela "Indique e ganhe" (Perfil › Indique e ganhe)
- **Propósito:** o coração do programa — entender quanto ganha, compartilhar em 1 toque e
  acompanhar os amigos.
- **Elementos:**
  - AppBar com voltar;
  - **hero** (espresso ou dourado) com a proposta: "Indique um vizinho e ganhe X pãezins" + "seu
    amigo ganha Y no primeiro pedido";
  - selo da **campanha** quando ativa ("Semana em dobro · até 11/10");
  - **código** grande e legível com botão **copiar** (feedback "Copiado!");
  - ações de compartilhar: principal **"Enviar no WhatsApp"**, secundárias **"Mais opções"** (menu
    nativo do celular) e **"Copiar link"**;
  - **"Como funciona"** em 3 passos: 1. Compartilhe seu código · 2. Seu amigo se cadastra e faz o
    1º pedido · 3. Quando o pão chegar na porta dele, vocês dois ganham;
  - **resumo**: pãezins ganhos, indicações que valeram, em andamento;
  - **metas** com progresso ("Faltam 2 indicações para ganhar +10 pãezins");
  - **lista de indicados**: nome curto, data, pill de estado, "+X" quando ganhou;
  - **"Regras"** recolhível: prazo, compra mínima, "o bônus não vira dinheiro nem expira", "pode
    passar por análise", "o programa pode ser encerrado; o que já foi indicado continua valendo".
- **Estados:** carregando (skeleton) · sem indicações (vazio convidativo) · com indicações em todos
  os estados · campanha ativa · meta atingida · sem bônus do amigo (Y = 0) · programa pausado
  (só histórico, sem compartilhar) · erro ao carregar.

### C2. Entrada no Perfil
- **Elemento:** nova linha no hub do Perfil — sugestão: seção própria acima de "Conta" — com ícone
  (`gift` ou `users`), título "Indique e ganhe", descrição "Ganhe X pãezins por amigo" e um pill
  opcional ("Semana em dobro" / "novo").
- **Estados:** normal · campanha ativa · programa desligado (a linha some).

### C3. Card na Home
- **Propósito:** lembrar do programa sem competir com o saldo e a entrega do dia.
- **Onde:** proponha a posição (sugestão: depois das ações rápidas, antes do Além do Pãozin).
- **Elementos:** card compacto com a proposta, CTA "Indicar agora" → C1 e botão fechar (X).
- **Regra:** aparece só para quem já recebeu ≥ 1 entrega; fechado, some por 30 dias.
- **Estados:** normal · campanha ativa.

### C4. Cadastro com indicação
- **Propósito:** o amigo ver que veio indicado e o que ganha, e poder digitar o código se o link
  se perdeu.
- **Onde:** proponha. Sugestão: selo no topo do passo 1 ("Seus dados") quando veio pelo link, e um
  link discreto "Tenho um código de indicação" que abre o campo.
- **Elementos:**
  - **selo** "Indicado por João M. · você ganha Y pãezins no 1º pedido", com "trocar/remover";
  - **campo** de código com validação ao sair do campo.
- **Estados:**
  - veio pelo link (selo preenchido);
  - digitando;
  - validando;
  - código válido (mostra "Indicado por João M.");
  - código inválido — aviso suave, **o cadastro continua**;
  - sem bônus do amigo (Y = 0): o selo diz só "Indicado por João M.";
  - programa desligado: nada aparece.

### C5. Comemoração (modal na abertura do app)
- **Propósito:** o momento "uau" — aparece uma vez por recompensa.
- **Variantes:**
  - **quem indicou:** "Você ganhou X pãezins! A Maria recebeu o primeiro pedido";
  - **o amigo:** "Presente de boas-vindas: Y pãezins por ter vindo pela indicação do João";
  - **meta atingida:** "+10 pãezins pela 5ª indicação".
- **Elementos:** ilustração/símbolo dourado, número grande, CTA "Indicar mais" (quem indicou) ou
  "Ver meu saldo" (amigo), fechar.
- **Estados:** uma recompensa · várias acumuladas ("Você ganhou 15 pãezins com 3 indicações").

### C6. Notificações (4 tipos novos na central existente)
| Tipo | Título | Corpo | Botão |
|---|---|---|---|
| Amigo se cadastrou | "Sua indicação chegou! 🎉" | "Maria se cadastrou com o seu código. Quando ela receber o 1º pedido, você ganha X pãezins." | Ver indicações |
| Você ganhou | "Você ganhou X pãezins!" | "Maria recebeu o 1º pedido. Obrigado por espalhar o cheirinho de pão 🥖" | Ver saldo |
| Boas-vindas (amigo) | "Presente de boas-vindas 🎁" | "Você ganhou Y pãezins por ter vindo pela indicação do João." | Ver saldo |
| Convite após a 1ª entrega | "Gostou do pãozin?" | "Indique um vizinho: quando ele receber o 1º pedido, você ganha X pãezins." | Indicar agora |

Defina ícone e tom de cada uma no padrão existente.

### C7. Extrato de pãezins
Duas linhas novas no extrato existente: "Indique e ganhe" (+X) e "Boas-vindas por indicação" (+Y),
e a meta ("Meta de 5 indicações", +10). Mostre como elas se distinguem de "Compra de pãezins".

### C8. Lista de espera — condomínio não atendido
- **Onde:** passo 3 do cadastro ("Onde você mora?"), no estado vazio da busca.
- **Elementos:** link/botão "Meu condomínio não está aqui" → formulário curto: nome do condomínio,
  CEP (opcional), cidade, seu nome, e-mail **ou** celular → "Avisar quando chegar".
- **Estados:** formulário · enviando · sucesso ("Anotado! Avisamos quando o Cheirin chegar aí") ·
  erro.

---

## 5. ADMIN

### A1. Card no hub Gestão
"Indique e Ganhe" · descrição "Recompensas, regras e indicações", com **badge** da contagem em
análise ("3 em análise").

### A2. Hub "Indique e Ganhe"
AppBar + chips/segmentos **Configuração · Indicações** (e atalho para o relatório).

### A3. Configuração
- **Elementos:**
  - toggle **Programa ativo**;
  - **Recompensa de quem indica** (stepper, pãezins) com equivalente em R$ ("≈ R$ 5,00");
  - **Bônus do amigo** (stepper; 0 = sem bônus);
  - **Compra mínima do amigo** (R$; 0 = qualquer);
  - **Limite por indicador/mês** ("acima disso vai para análise"; 0 = sem limite);
  - **Prazo para o 1º pedido** (dias; 0 = sem prazo);
  - **Campanha:** toggle + rótulo + multiplicador (2× a 5×) + data de início e fim;
  - **Metas:** lista editável de "na N-ésima indicação, +B pãezins" (até 5), adicionar/remover;
  - **Mensagem de compartilhamento:** textarea com as variáveis `{codigo}` `{link}` `{nome}`
    `{bonus}` (chips para inserir) e **prévia** como balão de conversa;
  - Salvar.
- **Estados:** programa desligado · tentar ligar com recompensa 0 (erro) · campanha ativa · metas
  vazias · mensagem sem `{codigo}` nem `{link}` (erro) · `{bonus}` com bônus 0 (aviso) · salvando ·
  salvo.

### A4. Indicações (lista + detalhe)
- **Lista:**
  - chips de filtro: **Em análise** (primeiro, com contagem) · Aguardando · Recompensadas ·
    Recusadas · Expiradas · Todas;
  - busca por nome;
  - linha: "João Silva → Maria Souza", data, pill de estado, **sinais** em chips ("Mesmo
    apartamento", "Mesmo aparelho", "Limite do mês", "Indicador bloqueado").
- **Detalhe (sheet ou tela):** as duas pessoas (com atalho para o detalhe de cada cliente), valores
  congelados (X, Y, campanha), **linha do tempo** (cadastro · 1º login · 1º pagamento · 1ª entrega ·
  recompensa/análise) e ações **Aprovar** / **Recusar** (motivo obrigatório; o cliente vê só "Não
  valeu").
- **Estados:** vazio por filtro · carregando · confirmação de aprovar/recusar · sucesso.

### A5. Detalhe do cliente (aba Geral)
- linha **"Indicado por João Silva"** (clicável) perto de "Membro desde";
- card **"Indicações"**: quantas fez, quantas valeram, pãezins ganhos, lista curta com estados;
- ação **"Vincular indicação"** (para quem esqueceu o código): sheet com campo de código →
  valida → confirma. Estados: já tem indicação (ação indisponível) · código inválido · próprio
  cliente · sucesso.

### A6. Relatório "Indicações" (Relatórios › Aquisição & clientes)
- **Elementos:**
  - seletor de período;
  - **KPIs:** cadastros por indicação, recompensadas, conversão, pãezins concedidos, custo
    estimado em R$;
  - **funil:** visitas pelo link → cadastros → confirmados → recompensados;
  - **custo × receita** gerada pelos indicados;
  - **top 5 indicadores**;
  - distribuição por estado.
- **Estados:** carregando · sem dados no período.

### A7. Lista de espera de condomínios (Gestão › Condomínios)
Seção **"Pedidos de novos condomínios"**: agrupado por condomínio (nome, cidade, nº de pedidos,
quantos vieram por indicação), expansível com os contatos, e ação "Marcar como tratado".

### A8. Preferências de notificação do admin
Três toggles novos na tela existente: "Indicação para analisar", "Indicação recompensada",
"Pedido de novo condomínio".

---

## 6. Dados de exemplo (para o protótipo — ficam em `app/data.jsx`)

```js
REFERRAL_CFG = {
  ativo: true, recompensa: 5, bonusAmigo: 3, compraMinima: 0,
  limiteMensal: 10, prazoDias: 60,
  campanha: { rotulo: 'Semana em dobro', multiplicador: 2, inicio: '05/10', fim: '11/10' }, // ou null
  metas: [{ quantidade: 5, bonus: 10 }, { quantidade: 10, bonus: 25 }],
  mensagem: 'Oi! Recebo pão fresquinho na porta com o Cheirin de Pão 🥖 Cadastra com o meu código {codigo} e ganha {bonus} pãezins no primeiro pedido: {link}',
}
MY_CODE = 'JOAO7K2F'
MY_REFERRALS = [ // um de cada estado
  { nome: 'Maria S.',   estado: 'ganhou',     data: '12/09', ganho: 5 },
  { nome: 'Pedro A.',   estado: 'ganhou',     data: '03/09', ganho: 10 }, // campanha 2×
  { nome: 'Ana L.',     estado: 'aguardando', data: '20/09' },
  { nome: 'Carlos M.',  estado: 'cadastro',   data: '26/09' },
  { nome: 'Júlia R.',   estado: 'analise',    data: '18/09' },
  { nome: 'Rafael T.',  estado: 'expirou',    data: '10/07' },
]
REFERRAL_REPORT = {
  visitas: 240, cadastros: 38, confirmados: 31, recompensados: 17,
  paesIndicador: 85, paesAmigo: 51, custo: 136.0, receitaIndicados: 1920.0,
}
```

Crie também `ADMIN_REFERRALS` (cerca de 8, com sinais variados) e `CONDO_INTERESTS` (cerca de 4).

---

## 7. Tom e microcopy

- Aconchegante, direto, com o humor leve da marca ("espalhar o cheirinho de pão").
- **Diga sempre quando o prêmio chega:** "quando o pão chegar na porta do seu amigo".
- Nunca acusar o cliente: "Em análise" e "Não valeu", nunca "fraude" ou "suspeito". Os sinais só
  aparecem para o admin.
- Números: "5 pãezins", "1 pãozin", "R$ 5,00".

---

## 8. Entregável (checklist do handoff)

1. **Telas novas no protótipo:**
   - `app/screens-referral.jsx` — cliente: C1, C3, C4, C5, C8 e os componentes reutilizáveis
     (card do código, botões de compartilhar, pill de estado, item da lista);
   - `app/screens-referral-admin.jsx` — admin: A2–A7.
2. **Integrações nas telas existentes:** rotas em `app/app.jsx`; entrada do Perfil (C2); card na
   Home (C3) em `screens-home.jsx`; cadastro (C4, C8) em `screens-onboarding.jsx`; notificações
   (C6) e extrato (C7); hub de Gestão (A1), detalhe do cliente (A5), relatórios (A6), condomínios
   (A7) e preferências (A8) nos arquivos de admin.
3. **Mocks** da seção 6 em `app/data.jsx`.
4. **Ícones novos** (`share`, `copy` e outros) no set de `brand.jsx`, no mesmo traço.
5. **`handoff-indique-e-ganhe.md`**, na mesma estrutura do handoff do Além do Pãozin:
   1. conceito e regras;
   2. modelo de dados (mock → backend);
   3. cada tela com propósito, layout, elementos, **todos os estados** e textos finais;
   4. navegação (rotas e de onde se chega a cada tela);
   5. tokens usados;
   6. acessibilidade (selos com texto, não só cor; foco; alvos de 44 px) e pontas soltas.
