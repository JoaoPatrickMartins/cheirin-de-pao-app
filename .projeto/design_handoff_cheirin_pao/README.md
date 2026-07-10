# Handoff: Cheirin de Pão — App PWA

## Visão geral
Aplicativo (PWA) de entrega recorrente de pãezinhos em condomínios, baseado em **sistema de créditos**. Um crédito = um pão. O cliente compra créditos (combos ou compra personalizada), monta uma **agenda semanal** de entregas e a operação roda no automático todo dia de manhã. O produto tem **três perfis**:

- **Cliente** — compra créditos, agenda entregas, acompanha o pão do dia, recebe notificações.
- **Entregador** — recebe a rota do dia (lista + mapa) e marca as entregas.
- **Admin/Dono** — painel, geração do pedido ao fornecedor, controle de entregas, gestão de clientes/fornecedores/entregadores, pagamentos e financeiro.

> O modelo de negócio empurra o cliente para o combo: abaixo de um **limite** (configurável, ex. 20 pães) ele compra avulso a um preço/pão mais alto; a partir do limite, só via combo (mais barato por unidade).

## Sobre os arquivos deste pacote
Os arquivos aqui são **referências de design feitas em HTML/React (via Babel no navegador)** — protótipos que mostram aparência e comportamento pretendidos, **não** código de produção para copiar direto. A tarefa é **recriar estes designs no ambiente do codebase de destino** (React/Next, Vue, Flutter, React Native, SwiftUI, etc.), usando os padrões, a biblioteca de componentes e o estado já estabelecidos nele. Se ainda não existir um ambiente, escolha o framework mais adequado (para um PWA, sugestão natural: **React + Vite com vite-plugin-pwa**, ou **Next.js**) e implemente lá.

O protótipo usa um `styles`/CSS-in-JS inline e um `ThemeCtx` próprio só para fins de demonstração — no codebase real, use o sistema de temas/tokens da casa.

## Fidelidade
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios e estados finais estão definidos. Recrie a UI fielmente usando os componentes do codebase. Os tokens exatos estão na seção **Design Tokens**.

## Direção escolhida (IMPORTANTE)
Este handoff representa **uma única direção definida** — não há decisões em aberto:
- **Home: variação A ("Carteira")** — `HomeA`. As variações B e C existem no protótipo apenas como histórico de exploração; **não devem ser implementadas**. Implemente somente a Home A.
- **Tema: CLARO (creme).** O tema claro é o padrão do produto. O tema escuro existe no protótipo como recurso opcional e **não faz parte do escopo de implementação inicial** — pode ser ignorado (ou deixado para uma fase futura). Use os tokens da coluna **Tema CLARO**.

O "chrome" de demonstração no topo do protótipo (alternar perfil/tema/variação) é só andaime de apresentação — **não** é parte do produto e não deve ser recriado.

---

## Arquitetura do protótipo

| Arquivo | Conteúdo |
|---|---|
| `Cheirin de Pão - App.html` | Casca: carrega React 18 + Babel, monta o palco (tela 390px), o "chrome" de demo (alternar perfil/tema/variação de Home) e roteia entre as telas. |
| `app/brand.jsx` | **Sistema de marca**: tokens de tema claro/escuro (`THEMES`), o símbolo (`BreadMark`), lockup, ícones (`Icon`/`Ic`), e primitivas de UI (`Btn`, `Card`, `Pill`, `Field`, `AppBar`, `Stepper`, `Switch`, `Row`, `StatusBar`). |
| `app/data.jsx` | Dados mock + helpers (`BRL`, `DIAS`, `COMBOS`, `PRICING_DEFAULT`, `CONDOS`, `ORDERS`, `ENTREGAS`, `FORNECEDORES`, `ADMIN_CLIENTES`, `ENTREGADORES`, `PAGAMENTOS`, `PEDIDO_DIA`, `TRACK_STEPS`). |
| `app/screens-onboarding.jsx` | Cliente: Splash/Instalar PWA, Login por código, **Cadastro completo (5 passos)**. |
| `app/screens-home.jsx` | Cliente: Home (implementar **apenas `HomeA`**; `HomeB`/`HomeC` são exploração fora de escopo), Histórico, e blocos compartilhados (`Greet`, `TodayDelivery`, `QuickActions`, `NextDays`). |
| `app/screens-order.jsx` | Cliente: Comprar créditos (Combos / Compra personalizada), Confirmação, **Agenda semanal**, Pedido único. |
| `app/screens-client-extra.jsx` | Cliente: **Compra automática**, **Acompanhamento da entrega** (3 estados), **Central de notificações**. |
| `app/screens-roles.jsx` | **Entregador**: lista de entregas + **Rota (mapa)**. |
| `app/screens-admin.jsx` | **Admin (core)**: navegação inferior, Painel, **Pedido ao fornecedor** (4 passos). |
| `app/screens-admin2.jsx` | **Admin (gestão)**: Entregas, Clientes, e hub de Gestão (Combos/Promoções, Compra personalizada, Fornecedores, Entregadores, Condomínios, Pagamentos, Financeiro). |
| `app/app.jsx` | Orquestrador: estado global (tema, perfil, variação de Home, `pricing`), `localStorage`, tab bar do cliente, navegação inferior do admin. |

Padrão de navegação do protótipo: cada tela recebe `go(route)` e troca uma string de rota. No app real, substitua por roteador de verdade (React Router / Next routes) e por um store (Context/Zustand/Redux) para o estado compartilhado (saldo de créditos, `pricing`, perfil, tema).

---

## Telas / Views

### CLIENTE

#### 1. Splash / Instalar PWA (`InstallScreen`)
- **Propósito**: primeira abertura; convida a instalar o PWA e a criar conta.
- **Layout**: fundo espresso (`#1E1207`) com vinheta dourada radial no topo. Centro: ícone do app (quadrado 132px, raio 30%, fundo `#160C04`) com o símbolo dourado 86px; nome 32px e tagline `PÃO FRESCO NA PORTA` (12px, letter-spacing 0.26em, dourada). Rodapé: card "Instalar o Cheirin" + botão dourado **Instalar e criar conta** + link "Já tenho conta — entrar".
- **Ações**: criar conta → cadastro; entrar → login.

#### 2. Login por código (`LoginScreen`)
- **Propósito**: entrar com número/e-mail + código de 4 dígitos (sem senha).
- **Passos**: (a) campo de celular → "Enviar código"; (b) 4 inputs OTP (64×72px, raio 18, foco com borda dourada) → "Confirmar". Reenvio com contador.
- **Behavior**: digitar avança o foco automaticamente para o próximo dígito.

#### 3. Cadastro completo (`OnboardingScreen`) — 5 passos com dots de progresso
1. **Dados**: nome completo, CPF, data de nascimento.
2. **Contato**: telefone **e/ou** e-mail (pelo menos um) + escolha do **canal de confirmação** (SMS/e-mail; a opção fica desabilitada se o campo correspondente estiver vazio).
3. **Condomínio**: busca + lista de parceiros; empty state quando não encontra.
4. **Endereço**: bloco/torre (se o condomínio tiver) + apartamento.
5. **Verificação**: OTP de 4 dígitos enviado pelo canal escolhido → "Criar conta e ver meu pão".
- **Validação**: cada passo desabilita o botão até os campos obrigatórios estarem preenchidos.

#### 4. Home — **variação A "Carteira"** (`HomeA`) — ESTA é a Home a implementar
Estrutura: saudação (`Greet`, com sino → Notificações), card de **saldo** + **Entrega de hoje** (`TodayDelivery`, clicável → Acompanhamento), **Ações rápidas** (Agenda/Avulso/Histórico) e **Próximas entregas** (faixa de dias).
- **A — "Carteira" (ESCOLHIDA)**: saldo de créditos gigante em card espresso (`#1E1207`) com gradiente sutil para `#2E1D0D` e símbolo dourado de fundo a baixa opacidade; abaixo do número, "Rende ~N dias no seu ritmo atual"; rodapé do card com botão dourado **Comprar créditos** + botão soft **Extrato** (→ Histórico). Em seguida o card de Entrega de hoje, Ações rápidas e Próximas entregas.
- ~~B — "Hoje primeiro"~~ e ~~C — "Padaria"~~: **fora de escopo.** Existem em `HomeB`/`HomeC` apenas como exploração anterior; ignorar.

#### 5. Comprar créditos (`CombosScreen`) — dois modos (segmented control)
- **Combos**: 3 cards selecionáveis (radio). Mostra `qtd`, descrição, preço, preço/pão, badge de tag ("Mais popular"/"Melhor valor"). Rodapé fixo com total + CTA "Comprar {combo}".
- **Compra personalizada**: stepper grande (1…limite-1), preço/pão; **comparativo avulso × melhor combo** com **% mais barato por pão**; ao atingir o limite, surge um aviso empurrando para o combo. Rodapé com total (`qtd × preço avulso`).
- **Regra**: o limite e o preço/pão vêm de `pricing` (configurado no Admin).

#### 6. Confirmação de compra (`PurchasedScreen`)
- Ícone de check em círculo, "+N pães adicionados", CTAs "Montar minha agenda" / "Voltar ao início".

#### 7. Agenda semanal (`ScheduleScreen`)
- **Propósito**: definir quantos pães por dia + horário de entrega; é o coração da recorrência.
- Seletor de horário (06:30/07:00/07:30/08:00); 7 linhas (dias) com `Stepper` (0…12; 0 = folga, linha esmaecida).
- **Toggle "Lembrar de reconfigurar"** (aviso domingo à noite).
- **Alerta de cobertura**: se saldo < consumo semanal → banner dourado "compre um combo / ative reposição"; senão, atalho para **Compra automática**.
- Rodapé: consumo semanal + horário + "Salvar agenda".

#### 8. Pedido único (`SingleScreen`)
- Stepper grande de quantidade + escolha de data ("Amanhã cedo" / "Sábado").
- Usa créditos; se `qtd > saldo` → estado de **créditos insuficientes** (banner com "Comprar créditos" e "Usar {saldo}"). CTA "Reservar e confirmar" desabilitado quando insuficiente.

#### 9. Compra automática (`AutoBuyScreen`)
- Toggle mestre on/off. Modos: **"Quando estiver acabando"** ou **"Toda semana"** (com seletor de dia). Escolha do **combo a repor**. Aviso de cobrança no Pix salvo. CTA dinâmico com nome/preço do combo.

#### 10. Acompanhamento da entrega (`TrackScreen`)
- Header espresso com data, quantidade e endereço. **Timeline vertical de 3 estados**: Agendado → Saiu para entrega → Entregue (estado atual destacado com pill "agora"; passos concluídos com check dourado). Card do entregador com botão de telefone.

#### 11. Central de notificações (`NotifsScreen`)
- Lista de cards (ícone colorido por tom: gold/good/neutral). Itens novos com borda dourada. Tipos: crédito insuficiente, saiu para entrega, lembrete de entrega, reconfigurar semana, entrega realizada. Alguns com CTA que navega.

#### 12. Histórico (`HistoryScreen`)
- 2 cards de resumo (pães no mês / economia com combo) + lista de pedidos com ícone por tipo (agenda/avulso) e pill de status (A caminho / Entregue).

---

### ENTREGADOR (`CourierScreen`)
- **Header** com saudação + data. Card de **progresso** (paradas feitas/total + total de pães) com barra.
- **Segmented Lista / Rota**:
  - **Lista**: condomínios numerados (ordem), expansíveis; ao abrir, "ordem sugerida no prédio" com paradas marcáveis (checkbox), cliente e quantidade. Pill de status por condomínio.
  - **Rota** (`CourierRoute`): "mapa" estilizado em SVG (malha de ruas + polyline tracejada dourada + pinos numerados) e lista de paradas com horário estimado.

---

### ADMIN — navegação inferior: **Painel · Pedido · Entregas · Clientes · Gestão**

#### Painel (`AdminPainel`)
- 4 KPIs (pães hoje, receita do dia, clientes, condomínios) com pills de tendência. Atalho destacado "Pedido de amanhã". Gráfico de barras "Fornadas por dia". Card "Receita por tipo" (barra empilhada combos × compra personalizada).

#### Pedido ao fornecedor (`AdminPedido`) — 4 passos
1. **Conferir**: card de horário de corte (`PEDIDO_DIA.horaCorte`, status Aberto) + consolidado por condomínio (pães/paradas) + total.
2. **Ajustar**: stepper por condomínio (margem/arredondamento).
3. **Dividir**: entre **fornecedor principal** e **reserva** (steppers que mantêm a soma = total) com custo por fornecedor (`preço/pão`).
4. **Pronto**: resumo com total, **exportar PDF / Excel**, voltar ao início.

#### Entregas (`AdminEntregas`)
- Aba **Hoje**: **divisão sugerida** entre entregadores (aprovar) + progresso "agendadas vs realizadas" por condomínio (barras).
- Aba **Histórico**: dias anteriores com % de conclusão.

#### Clientes (`AdminClientes`)
- Filtro por condomínio (chips). Lista com saldo de créditos. Detalhe (somente leitura): dados, saldo, última compra, agendamento; **bloquear/desbloquear**.

#### Gestão (`AdminGestao` → sub-telas)
- **Combos e promoções** (`AdminCombos`): CRUD de combos + toggle de promoção 15% OFF (mostra preço riscado).
- **Compra personalizada** (`AdminAvulso`): configura **limite máximo** e **preço/pão**; prévia do incentivo recalcula o % ao vivo. **Reflete no app do cliente** (via `pricing`).
- **Fornecedores** (`AdminFornecedores`): CRUD; CNPJ, contato, **preço do pão**, marca principal.
- **Entregadores** (`AdminEntregadores`): CRUD + **ativar/desativar** (Switch); CPF, contato, condomínios atribuídos.
- **Condomínios** (`AdminCondos`): lista (nome, tipo, nº de clientes).
- **Pagamentos** (`AdminPagamentos`): status (pago/pendente/falhou) + **estornar** (vira "Estornado", valor riscado).
- **Financeiro** (`AdminFinanceiro`): seletor Dia/Semana/Mês; receita total + barras; por tipo (combos × avulso); por condomínio (barras).

---

## Interações & comportamento
- **Navegação**: protótipo usa `go(route)`; substituir por roteador real. Cliente tem tab bar (Início/Agenda/Créditos/Pedidos); Admin tem navegação inferior de 5 itens.
- **OTP**: avanço automático de foco; reenvio com contador (mock).
- **Steppers**: respeitam min/max; na divisão do pedido, os dois fornecedores somam sempre o total.
- **Toggles** (`Switch`): compra automática, reconfiguração semanal, promoções, ativar entregador.
- **Estados**: créditos insuficientes (pedido único / agenda), promoção on/off, pagamento estornado, entregador ativo/inativo, condomínio sem resultado (empty state).
- **Transições**: hover dos botões `translateY(-1px)` + brilho; transições de `border-color`/`box-shadow` ~.15s; barras/progresso animam `width`/`height` ~.3s.
- **Tema**: usar **`THEMES.light` (claro)** como tema do produto. `THEMES.dark` está fora do escopo inicial.
- **Persistência**: o protótipo guarda `themeName`, `role`, `homeVar`, `saldo`, `pricing` em `localStorage` (`cheirin_proto_v1`). No app real, isso vira backend/auth + store.
- **prefers-reduced-motion / acessibilidade**: hit targets ≥ 44px; manter contraste dos tokens.

## Gerência de estado (mínimo para o app real)
- **Sessão/usuário**: perfil (cliente/entregador/admin), dados de cadastro, condomínio/endereço.
- **Créditos**: `saldo` (debitado por entrega/pedido; creditado por compra).
- **Agenda semanal**: `{ seg..dom: number }` + horário + flag de reconfiguração.
- **Compra automática**: on/off, modo (`acabar`|`semanal`), dia, combo.
- **Pricing (admin → cliente)**: `{ avulsoLimite, avulsoUnit }` (ver `PRICING_DEFAULT`).
- **Operação (admin)**: pedido do dia, divisão por entregador, status de pagamentos, fornecedores, catálogo de combos/promos.

---

## Design Tokens

### Cores — Tema CLARO
| Token | Hex |
|---|---|
| Fundo da página | `#C9BBA2` |
| App background | `#FAF5EC` |
| Surface | `#FFFFFF` |
| Surface alt | `#FBF6EC` |
| Surface 2 | `#F4EBDA` |
| Texto | `#241608` |
| Texto secundário | `#7C6A50` |
| Texto terciário | `#A89A82` |
| Borda | `rgba(43,26,12,0.10)` |
| Borda 2 | `rgba(43,26,12,0.06)` |
| Accent | `#B0702A` |
| Gold (dourado) | `#E3AC3F` |
| Gold soft | `#F3DDA6` |
| Espresso | `#1E1207` |
| Botão primário | bg `#1E1207` / texto `#FBF3E4` |
| Sucesso | `#3E7C53` / soft `#DCEBDF` |

### Cores — Tema ESCURO (fase futura — fora do escopo inicial)
| Token | Hex |
|---|---|
| Fundo da página | `#0E0902` |
| App background | `#1E1207` |
| Surface | `#2A1B0E` |
| Surface alt | `#241608` |
| Surface 2 | `#33230F` |
| Texto | `#FAF5EC` |
| Texto secundário | `#C7B595` |
| Texto terciário | `#8B7A60` |
| Borda | `rgba(250,245,236,0.13)` |
| Accent / Gold | `#E3AC3F` |
| Gold soft | `#5A4218` |
| Botão primário | bg `#E3AC3F` / texto `#1E1207` |
| Sucesso | `#7FC893` / soft `#23381F` |

### Tipografia
- **Display / títulos / números**: `Bricolage Grotesque` (Google Fonts), pesos 700–800, `letter-spacing: -0.02em a -0.03em`.
- **Texto / UI**: `Hanken Grotesk` (Google Fonts), pesos 400–800.
- Escala usada: títulos de tela 26–32px; títulos de card 15–18px; corpo 13–15px; labels 11–12.5px; números de destaque 24–56px.

### Espaçamento, raios e sombras
- **Padding** de tela: `0 20–24px`. **Gaps** comuns: 10–14px.
- **Raios**: campos 14; botões 16; cards 18–22; ícone do app 30%; pills 999.
- **Sombra suave**: `0 1px 2px rgba(43,26,12,.05), 0 4px 14px -8px rgba(43,26,12,.18)` (claro).
- **Sombra forte**: `0 1px 2px rgba(43,26,12,.05), 0 10px 30px -12px rgba(43,26,12,.22)` (claro). Equivalentes em preto no escuro.
- **Hit target mínimo**: 44px.
- **Frame de referência**: 390px de largura (mobile).

## O símbolo da marca (`BreadMark`)
SVG (viewBox 0 0 100 100): **arco do pão** na base + **três ondas de aroma** (central com traço cheio; laterais a ~50% de opacidade). **Regra de redução**: abaixo de ~48px, ocultar as ondas laterais e engrossar o traço (prop `reduced`). Cor padrão dourada `#E3AC3F`. Recriar como componente de ícone no codebase (não usar screenshot).

## Assets
- **Fontes**: Bricolage Grotesque + Hanken Grotesk (Google Fonts).
- **Ícones**: set próprio de paths em `app/brand.jsx` (`Ic`), traço currentColor 24×24 — substituível pela biblioteca de ícones da casa (Lucide é a mais próxima visualmente).
- **Símbolo/Logo**: componente `BreadMark` (SVG inline). O HTML original da identidade está em `uploads/simbolo_combinado_aroma_pao_variacoes.html`.
- Sem imagens raster; nada de emoji na marca (os 🥖 nos protótipos são placeholders de demonstração — trocar por ícone próprio).

## Documentos de produto (fonte da verdade funcional)
Inclusos em `uploads/`: requisitos (`Cheirin_de_Pao_Requisitos_v01.docx`) e modelo de funcionamento (`Cheirin_de_Pao_Modelo_Funcionamento.docx`). Use-os para regras de negócio (corte de pedido, recorrência, créditos, preço diferenciado).

## Arquivos de design neste pacote
- `Cheirin de Pão - App.html` (entrada)
- `app/*.jsx` (todos os módulos listados acima)
- `uploads/simbolo_combinado_aroma_pao_variacoes.html` (identidade do símbolo)
- `uploads/*.docx` (requisitos + modelo de funcionamento)

## Como rodar o protótipo de referência
Abrir `Cheirin de Pão - App.html` em um servidor estático (os `.jsx` são carregados via `<script type="text/babel">`). O "chrome" no topo permite alternar **perfil** (Cliente/Entregador/Admin), tema e variação de Home — mas isso é só para navegar a referência. **Para implementação, a configuração canônica é: tema CLARO + Home variação A.**
