# Brief de telas — Melhorias do app do Entregador (para o Claude Design)

> **Como usar:** cole este documento inteiro no Claude Design, dentro do projeto do protótipo do
> Cheirin de Pão (o mesmo usado no Além do Pãozin e no Indique e Ganhe).
> **Fluxo:** gerar os designs → revisar → entregar o handoff em
> `.projeto/design_handoff_app_entregador/` → entrar no plano de implementação
> (`docs/plano-app-entregador.md`).
>
> ✅ **Decisões confirmadas em 30/09/2026:** passo a passo registrado na §10 de
> [`docs/levantamento-app-entregador.md`](./docs/levantamento-app-entregador.md). Este brief já
> segue essas decisões.

---

## Pedido

Desenhe, no protótipo existente do **Cheirin de Pão** (`Cheirin de Pão - App.html` + `app/*.jsx`),
as melhorias do **app do Entregador** e o que elas mudam nas telas do **Admin** e do **Cliente**,
em **alta fidelidade**, com todos os estados listados abaixo.

Ao final, entregue um **handoff** no mesmo formato dos handoffs anteriores (seção 9 deste brief):
arquivos de tela novos no protótipo, integrações nas telas existentes, dados de exemplo e um
documento `handoff-app-entregador.md` com a especificação de cada tela.

**Não** recrie o "chrome" de demonstração do protótipo (troca de perfil/tema/variação). Tema
**claro** apenas. Idioma **português (BR)**.

---

## 1. O app do entregador hoje — o protótipo está desatualizado, siga isto

O `CourierScreen` do `screens-roles.jsx` é a versão original. O app real evoluiu, e as telas novas
precisam **partir de como ele é hoje**.

### 1.1 Tela única do entregador (sem tab bar)

De cima para baixo:

1. **Cabeçalho:** quadrado espresso 46 px com o `BreadMark` dourado · "Bom dia," (12,5 px,
   terciário) + nome do entregador (Bricolage 18 px) · à direita, botão **Sair** (quadrado 40 px,
   borda, ícone `logout`). Ele desloga com um toque, sem confirmação.
2. **Card "Ativar notificações"** (toggle de push deste aparelho).
3. **Card "Rota de hoje":** rótulo pequeno em caixa-alta · data por extenso em Bricolage 19 px
   ("Sexta-feira, 27 de junho") · chips dourados dos turnos do dia ("☀️ Manhã · 06:30",
   "🌇 Tarde · 16:00") · linha "🧺 48 🥖 + 6 itens do Além do Pãozin" quando há Cestinha.
4. **Segmentado** com 3 abas: **Lista · Rota · Realizadas** (ícones `list`, `route`, `check`).
5. **Botão "Escanear cupom"**: largura total, espresso, ícone dourado, **no topo da lista**.
6. **Card de progresso** espresso: "PROGRESSO 3/12 paradas" · "Total de pães 18/64" · barra dourada.
7. **Aba Lista:** acordeão por **prédio**, com badge dourado numerado, nome em Bricolage 18 px,
   "N paradas", pill de progresso "3/5" (ou "✓ Ok") e chevron. Aberto, mostra **subtítulos por
   bloco** ("BLOCO 2") e as **linhas de parada**: número · checkbox 28 px (verde entregue / vermelho
   não entregue) · "Lado A — Apto 101" (o complemento fica visível mesmo sob o subtítulo do bloco)
   · nome do cliente · chips dourados dos itens da Cestinha ("2× Café 250 g") · quantidade
   "4 🥖" (ou 🧺 quando a parada é só Cestinha).
   **Dia com dois turnos:** a lista vira **uma seção por turno**, cada uma com chip do turno,
   "3/8 paradas · 12/30 🥖" e barra de progresso própria.
8. **Aba Rota:** mapa real (Leaflet, tiles do OpenStreetMap) de 290 px e raio 22, com a rota em
   **linha dourada tracejada**, marcadores **quadrados espresso com número dourado** e etiqueta
   "~9,2 km · 4 paradas". Embaixo, "ORDEM DE PARADAS" com prédio, "N paradas" e hora estimada.
9. **Aba Realizadas:** entregues e não entregues do dia, agrupadas por prédio e bloco, com hora.
10. **Confirmar entrega** (toque numa parada): modal central de 320 px com "Confirmar entrega?",
    "4 pães + 2 itens da Cestinha para Maria · Apartamento 101" e os botões **Confirmar entrega**
    (espresso), **Não consegui entregar** (contorno vermelho) e **Cancelar**. "Não consegui" troca
    o conteúdo por um textarea de motivo livre e "Confirmar não entrega".
11. **Scanner:** tela preta cheia, título "Escanear cupom", fechar (X), vídeo da câmera com
    moldura branca de 220 px e "Aponte para o QR do cupom". **Hoje não funciona no iPhone**: cai
    numa tela "a leitura por câmera não é suportada, use o botão Confirmar da lista".
12. **Resposta do scan:** hoje é só uma **faixa pequena inline** no topo ("Entrega de Maria
    confirmada"), que some em 3,5 s. Com a lista rolada, o entregador nem vê.

### 1.2 O cupom

Cada saquinho leva um cupom térmico impresso na separação, com marca, **nome do cliente,
condomínio, bloco/complemento, apto**, turno, pães, itens da Cestinha, **QR** e o **código curto
`#A7K2QX`** embaixo do QR.

### 1.3 Onde admin e cliente entram

- **Admin:** navegação inferior com 6 abas (Painel · Pedidos · Separação · Entregas · Clientes ·
  Gestão).
  - **Gestão** é um hub de cards. Os que importam aqui: **Entregadores** (lista + formulário com
    nome, CPF, telefone e e-mail, e ativar/desativar), **Condomínios**, **Solicitação de Gancho**
    (fila de ganchos a entregar, hoje entregues pelo admin) e **Financeiro** (despesas, com as
    categorias **🛵 Entregador** e **⛽ Combustível**).
  - **Relatórios** tem o grupo "Operação & financeiro", com **"Entregas & falhas"**.
  - **Entregas** mostra o acompanhamento do dia e a **divisão de entregas** (sugestão por
    entregador que o admin aprova).
  - O **detalhe do pedido** abre num sheet.
- **Cliente:** o **Acompanhamento** da entrega é uma timeline de 3 estados (Agendado → Saiu para
  entrega → Entregue). Hoje ele mostra um card **"Seu entregador: A definir"** fixo. Embaixo fica o
  **Histórico** (pão + Cestinha, últimos 30 dias). O Perfil do cliente tem **Notificações**.

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
- **Palco:** mobile, **390 px** de largura.
- **Ícones que já existem** (traço 24×24, `currentColor`): home, bag, calendar, clock, lock, user,
  plus, minus, check, chevR, chevL, chevD, arrowL, arrowU, bell, pin, building, truck, x, edit,
  card, coin, spark, list, phone, mail, gift, star, settings, wallet, trend, logout, repeat,
  download, doc, percent, ban, route, alert, factory, scissors, refresh, users, power, search,
  basket, trash, **camera**, share, copy, link, chat, target, ticket, shield, unlink, external.
  - **Faltam, no mesmo traço:** lanterna, teclado (digitar código), navegar (seta de GPS), minha
    localização (mira), play (iniciar), bandeira (encerrar), bomba de combustível, moto, carro,
    bicicleta, imagem/foto, nuvem com seta (enviando), nuvem cortada (sem sinal), gancho,
    portão/portaria, crachá, alça de arrastar, folga (calendário com traço). Liste no handoff todos
    os ícones que criar.
  - Não use logotipos de Google Maps, Waze, Apple ou WhatsApp. Use ícone genérico + o nome.

### 2.1 Regras de uso específicas do entregador

O contexto é **5 h da manhã**: corredor escuro, uma mão ocupada com as sacolas, pressa e sinal
fraco (elevador, garagem). O desenho precisa responder a isso:

- **Ações principais com alvo ≥ 56 px** e posicionadas na **metade de baixo da tela** (área do
  polegar). Nas demais, alvo ≥ 44 px.
- **Nada que dependa de ler texto pequeno:** o que importa numa confirmação (apto, bloco, nome)
  aparece **grande**.
- **Estado nunca só por cor:** sempre ícone + texto (entregue, não entregue, sem foto, pendente
  de envio).
- **Contraste alto** sob luz fraca e sob sol.
- Sem animação longa: resposta imediata e transições ≤ 250 ms. A exceção é o selo animado do
  crachá (E15).

---

## 3. Regras que a interface precisa mostrar

### 3.1 Scanner e confirmação

1. **O scan confirma na hora.** Leu o QR, a entrega **já está confirmada**, e o pop-up **mostra o
   resultado** (não pede "confirmar?").
2. **Câmera contínua.** Scanner e foto usam a **mesma câmera dentro do app**, sem fechar entre uma
   coisa e outra: **Escanear → Confirmado (pop-up ~3 s) → Foto → Escanear próximo**.
3. Sempre existe o **plano B "Digitar código"**, com o código curto do cupom (`#A7K2QX`).
4. **Lanterna** no scanner (onde o aparelho suportar) e **bipe** ao ler (com vibração no Android).
5. **Leitura no iPhone passa a funcionar**, sem tela de "não suportado".

### 3.2 Foto (comprovante)

6. **A obrigatoriedade da foto é definida pelo admin POR ENTREGADOR**, com dois toggles no cadastro
   dele:
   - "Exigir foto na entrega";
   - "Exigir foto na não entrega".
   Por isso existem duas variantes da tela de foto:
   - **obrigatória:** sem "Pular". A única saída é a exceção "Não consigo tirar a foto", com motivo
     rápido, e a parada fica marcada **"sem foto"** para o admin;
   - **opcional:** a mesma tela, com **"Pular"** visível.
7. **A foto sobe em segundo plano.** A confirmação vale na hora (o cliente recebe o aviso). A foto
   é enviada depois, e sem sinal fica guardada e sobe sozinha.
8. **O cliente vê a foto só se o admin ligar** a opção nas configurações (toggle global). A foto
   fica disponível por **90 dias**.

### 3.3 Sem sinal e não entrega

9. **Sem sinal não trava nada.** Confirmações, não entregas e fotos entram numa **fila** e sobem
   quando o sinal voltar. O entregador vê quantas estão pendentes.
10. **Motivos padronizados de não entrega:** Cliente ausente · Portaria não liberou ·
    Endereço/apto não encontrado · Sem lugar para deixar · Pedido danificado · Outro (com texto).
11. **Sem desfazer.** Uma entrega confirmada por engano é **reportada ao admin** ("Reportar
    problema"), que resolve.

### 3.4 Rota

12. **Uma rota por turno** (manhã e tarde separadas), partindo da **base de saída** cadastrada pelo
    admin. Ao iniciar, o entregador pode trocar para "Minha localização".
13. **Ciclo da rota salva:**
    1. o sistema **sugere a melhor rota** ao admin;
    2. o admin **aceita** (ou ajusta arrastando e salva);
    3. a rota fica **salva** para os próximos dias daquele entregador/turno;
    4. quando a rota muda (prédio novo, prédio que saiu), **aparece uma nova sugestão para o
       admin**. Até ele decidir, o dia usa a rota salva com o prédio novo na posição sugerida.
14. **Reordenar no app do entregador** só existe se o admin **liberar para aquele entregador**. A
    mudança **vale só naquele dia/turno**. O admin vê a alteração e pode adotá-la como rota padrão.
15. **Estados da rota** de cada turno: **Pronta (não iniciada) → Em rota → Encerrada**.
    **O cliente só vê "Saiu para entrega — a caminho" depois que o entregador inicia a rota.**
16. **Localização ao vivo:** com a rota iniciada, a posição do entregador aparece no mapa dele
    ("você está aqui") e no **mapa ao vivo do admin**. Fora da rota, não é compartilhada, e o
    entregador é avisado disso ao iniciar.
17. **Navegação** fica com o app de mapas do celular (Google Maps, Waze ou Apple Maps, escolhido
    pelo entregador e lembrado pelo app). O app não faz navegação curva a curva.
18. **Hora prevista** por prédio = trajeto entre as paradas + tempo médio por porta (configurado
    pelo admin).

### 3.5 Combustível e pagamento

19. **Km sempre estimado pela rota planejada.** Não há hodômetro nem GPS para contar km. A volta à
    base conta se o admin ligar. Tudo que é de combustível aparece como **"estimado"**.
20. **Combustível** = km estimado ÷ consumo do veículo (km/l, cadastrado pelo admin) × **preço do
    litro global** (definido pelo admin). **Não há registro de abastecimento.**
21. **Pagamento do entregador:** a **modalidade é definida pelo admin no cadastro**, uma de três:
    - **por entrega** (R$ por entrega realizada);
    - **por rota** (R$ por turno encerrado);
    - **semanal com valor fixo** (R$ por semana).
    Além disso, o **combustível é pago ao entregador**: o app calcula o valor estimado, e o admin
    define o valor final.
22. **Nada vira despesa sozinho.** O app monta uma **proposta de pagamento** por período
    (remuneração + combustível). O admin pode **aprovar, editar/corrigir ou descartar**. Aprovado,
    vira despesa (categorias Entregador e Combustível, favorecido = entregador), com status a pagar
    ou pago.

### 3.6 Dados definidos pelo admin

23. **Foto, veículo e consumo** do entregador são **definidos pelo admin no cadastro**. O consumo é
    opcional: sem ele, não há cálculo de combustível. O entregador **só vê** esses dados no perfil.
24. **Disponibilidade e folgas** são **cadastradas pelo admin**. A sugestão de divisão de entregas
    não inclui entregador de folga, e o entregador vê a própria escala **só para leitura**.
25. **Gancho na rota por decisão do admin:** na fila de ganchos, o admin marca **"Enviar na rota"**
    (data/turno). Marcado, o gancho entra na parada do cliente e o entregador confirma a entrega.
    Não marcado, **permanece na fila** como hoje.
26. **Recados ao cliente:** o entregador manda recados prontos por push ("Estou na portaria"…),
    **só se o admin liberar a função para aquele entregador**. O cliente pode desligar os recados
    em Perfil › Notificações (ligado por padrão).

### 3.7 Privacidade

27. O entregador **nunca vê telefone de cliente**.
28. Do entregador, o cliente vê só **primeiro nome + foto**.
29. A foto da entrega é vista pelo **cliente dono do pedido** (se liberado, regra 8) e pelo
    **admin**.

---

## 4. ENTREGADOR

### E1. Tela principal (reorganizada)

- **Propósito:** a mesma tela de hoje, mais usável com uma mão e com o estado da rota claro.
- **Mudanças:**
  - **Sair sai do cabeçalho.** No lugar, o **avatar do entregador** (foto ou iniciais) abre o
    **Perfil (E14)**.
  - **Card "Rota de hoje" ganha o estado da rota** por turno:
    - "Pronta · 12 paradas · ~9,2 km" com botão **Iniciar rota** (→ E8);
    - "Em rota desde 05:12" com o progresso;
    - "Encerrada às 06:40".
    Com dois turnos, uma linha por turno. Com a rota do dia reordenada pelo entregador, selo
    "ordem alterada hoje".
  - **Botão Escanear fixo no rodapé** (barra inferior ou botão flutuante grande), sempre visível
    com a lista rolada. Proponha a forma.
  - **Faixa de sincronização:** "Sem sinal — 2 entregas guardadas, sobem quando o sinal voltar"
    (nuvem cortada) / "Enviando 2…" / some quando zera.
  - **Faixa "3 entregas novas"** quando o admin atribui mais durante o dia, com "Atualizar".
    Puxar para atualizar na lista.
  - **Card de notificações** só aparece se o push estiver desligado (senão vai para o Perfil).
  - **Dia de folga:** "Hoje é sua folga 🌿" no lugar da rota.
- **Estados:** carregando · sem entregas hoje · folga · rota pronta · em rota · encerrada · dia com
  dois turnos (um encerrado e outro pronto) · sem sinal com fila · entregas novas.

### E2. Scanner (redesenhado)

- **Elementos:**
  - vídeo em tela cheia com moldura-guia;
  - topo: título, **contador da rota** ("7/12") e fechar;
  - rodapé: **lanterna** (liga/desliga, só aparece se o aparelho suportar) e **"Digitar código"**
    (→ E3).
- **Estados:**
  - pedindo permissão da câmera (explique por que o app precisa);
  - **permissão negada** (como liberar nos ajustes + "Digitar código");
  - lendo;
  - lido (congela o quadro por um instante, bipe, e abre E4);
  - câmera indisponível (→ E3).

### E3. Digitar código (sheet)

- **Elementos:** campo grande, em maiúsculas, com o formato do cupom (`#A7K2QX`), teclado
  alfanumérico, "Confirmar entrega" e a dica "o código fica embaixo do QR do cupom".
- **Estados:** vazio · digitando · validando · não encontrado na sua rota · já confirmado · ok
  (→ E4).

### E4. Pop-up de resultado do scan ⭐ (pedido principal)

- **Propósito:** o entregador bate o olho e confere que o saquinho certo está na porta certa.
- **Sucesso — elementos:**
  - check grande em verde + "Entrega confirmada";
  - **Apto e bloco em destaque máximo** (ex.: "Apto 101" em Bricolage 40–56 px, "Bloco 2 · Lado A");
  - **nome do cliente** e **condomínio**;
  - pães + chips da Cestinha;
  - selos quando houver: **"1ª entrega"** (dourado), **"🪝 tem gancho"** e **"+ gancho para
    entregar"** (quando o gancho foi enviado na rota, regra 25);
  - **barra de contagem de ~3 s**. Ao terminar, vai **sozinho para a foto (E5)** na mesma câmera.
    Tocar adianta.
- **Gancho na parada:** antes da foto, a pergunta rápida "Deixou o gancho também?" (**Sim** /
  **Ficou para outro dia**).
- **Erros** (vermelho ou âmbar, **não fecham sozinhos**, botão "Entendi"):
  - **Já confirmada** — "Essa entrega já foi confirmada às 06:42", com o resumo da parada;
  - **Não é da sua rota** — "Esse cupom é de outra rota." Não mostra dados do cliente;
  - **Não encontrado** — "Não achamos esse cupom." + "Digitar código";
  - **Sem sinal** — "Sem sinal agora. A entrega foi guardada e sobe sozinha." É um **sucesso com
    ressalva** (âmbar), segue para a foto normalmente.
- **Também usado** na confirmação manual pela lista (E6), para as duas formas de confirmar terem
  a mesma resposta.

### E5. Foto da entrega

- **Propósito:** prova de entrega rápida, sem sair da câmera.
- **Elementos:**
  - câmera em modo foto com a legenda fixa "Foto da entrega · Apto 101 · Bloco 2";
  - dica curta "Mostre o saquinho na porta ou no gancho";
  - **botão de disparo grande**;
  - prévia com **"Usar foto"** e **"Tirar outra"**;
  - depois de "Usar foto", toast "Foto salva" e volta a **escanear o próximo** (ou à lista, se veio
    da lista).
- **Duas variantes (regra 6):**
  - **obrigatória:** sem "Pular". Link discreto **"Não consigo tirar a foto"**, que abre um sheet
    com motivos rápidos (câmera com defeito, local sem luz, outro) e marca a parada como
    "sem foto";
  - **opcional:** botão **"Pular"** visível ao lado do disparo.
- **Estados:** câmera · prévia · enviando (nuvem com seta na parada) · enviada · **pendente de
  envio** (sem sinal) · falhou (tenta de novo sozinha) · sem foto (exceção) · pulada (opcional).

### E6. Confirmar pela lista + Não consegui entregar (redesenho)

- **Confirmar:** toque na parada abre um **sheet de baixo** (não mais o modal central) com o resumo
  grande da parada e **"Confirmar entrega"**. Confirmar leva à E4 e depois à E5.
- **Não consegui entregar:**
  - **chips de motivo** (regra 10); "Outro" abre texto;
  - **foto** no mesmo fluxo da E5, obrigatória ou opcional conforme o entregador (regra 6);
  - "Confirmar não entrega".
  - Com os recados liberados (regra 26), o sheet oferece "Avisar o cliente" (→ E16).
- **Estados:** motivo não escolhido (botão desabilitado) · "Outro" sem texto · enviando · sem sinal
  (guardado).

### E7. Linha da parada e cabeçalho do prédio (com indicadores)

- **Linha da parada**, além do que já tem:
  - selos **🪝 tem gancho** e **1ª entrega**;
  - item extra **"Entregar gancho"**, quando o admin enviou o gancho nesta rota;
  - status do comprovante nas resolvidas: 📷 foto ok · nuvem enviando · **sem foto** · pendente
    de envio;
  - ação "Recado" (balão), só quando a função estiver liberada (→ E16).
- **Cabeçalho do prédio aberto:** bloco **"Acesso"** com portaria (horário, se tem porteiro),
  portão/código de acesso, onde parar o veículo, observação livre e **foto da entrada** (toca para
  ampliar), além de **"Navegar até aqui"**.
  - **"Sugerir correção"** abre um sheet de texto que vai para o admin.
- **Estados:** prédio sem informações de acesso ("Nenhuma dica ainda · Sugerir") · com todas ·
  com foto da entrada.

### E8. Iniciar rota (sheet)

- **Elementos:**
  - turno ("☀️ Manhã · 12 paradas · ~9,2 km · ~1h10");
  - **ponto de partida**: "Base — Padaria Pão Nosso" (padrão) ou "Minha localização";
  - avisos:
    - "Ao iniciar, seus clientes veem que o pão saiu para entrega.";
    - "Sua localização é compartilhada com a operação só durante a rota.";
  - **"Iniciar rota"**.
- **Estados:** normal · sem permissão de localização (só base, e o mapa ao vivo não recebe
  posição) · iniciando.

### E9. Rota ativa (aba Rota redesenhada)

- **Elementos:**
  - **seletor de turno** quando o dia tem dois;
  - mapa com a rota, marcadores numerados, **"você está aqui"** (ponto com halo) e prédios
    concluídos esmaecidos com check;
  - botão "centralizar em mim";
  - **card "Próxima parada"** sobre o mapa ou logo abaixo: nº e nome do prédio, "5 portas ·
    18 pães · 2 Cestinhas", horário previsto e botões **"Navegar"** (principal) e **"Abrir
    lista do prédio"**;
  - **ordem de paradas** com horário previsto, concluídas riscadas.
  - A primeira vez que o entregador toca em Navegar, um sheet pergunta o app: **Google Maps ·
    Waze · Apple Maps** (este só no iPhone), com "lembrar minha escolha".
  - Ao chegar perto do prédio, o card vira **"Você chegou ao Residencial Jardins"** e abre a lista
    daquele prédio.
- **Reordenar hoje** (só quando o admin liberou, regra 14): botão "Reordenar" → modo de edição
  com **alças de arrastar** na ordem de paradas, aviso "vale só para hoje" e "Salvar ordem de
  hoje" / "Voltar à rota padrão".
- **Estados:** rota não iniciada (mostra a rota salva + Iniciar) · em rota · reordenando · ordem
  alterada hoje · sem permissão de localização (sem "você está aqui", com aviso) · prédio sem
  localização no mapa (aparece na lista com "sem mapa") · rota sem traçado (só pontos) · tudo
  entregue (→ E10).

### E10. Encerrar rota / resumo do turno

- **Propósito:** fechar o turno com os números e sem pendência esquecida.
- **Elementos:**
  - **pendências primeiro**, se houver: "2 paradas sem desfecho" (resolver agora), "1 sem foto",
    "3 envios pendentes";
  - resumo: entregues, não entregues, pães, Cestinhas, ganchos, duração (05:12 → 06:40);
  - **km estimado** da rota e **combustível estimado** ("~9,6 km · ≈ R$ 1,54");
  - "Encerrar rota".
  - Tela de fechamento leve e celebrativa ("Rota da manhã concluída 🥖").
- **Estados:** com pendências (Encerrar desabilitado até resolver) · sem pendências · sem consumo
  cadastrado (esconde o combustível) · encerrada.

### E11. Realizadas (com comprovante e "reportar problema")

- **Elementos:**
  - cada linha com hora, desfecho, motivo (na não entrega) e **miniatura da foto** (toca para
    ampliar), ou selo "sem foto" / "enviando";
  - **"Reportar problema"** na linha: sheet com "Confirmei por engano", "Deixei no apartamento
    errado", "Outro" + texto → vai para o admin. Não desfaz a entrega sozinho;
  - resumo do dia no topo.
- **Estados:** vazio · com entregues e não entregues · problema reportado (selo "reportado").

### E12. Falar com a operação

- **Onde:** Perfil e atalho no cabeçalho da rota.
- **Elementos:** "Chamar no WhatsApp" (número da operação) e **"Registrar ocorrência"**: tipo
  (Atraso · Problema no veículo · Acidente · Pedido faltando · Outro) + texto + foto opcional →
  "Enviar".
- **Estados:** enviando · enviado · sem sinal (guardado).

### E13. Meus ganhos

- **Elementos:**
  - **modalidade** do entregador em destaque ("Você recebe por entrega · R$ 1,50" / "por rota ·
    R$ 25,00" / "semanal fixo · R$ 400,00");
  - **período atual** (semana), com **"a receber (estimado)"**: remuneração + combustível estimado,
    separados;
  - **extrato de pagamentos**: período, remuneração, combustível, **valor final** (o que o admin
    aprovou), status **a pagar / pago** e data do pagamento;
  - quando o admin mudou o valor, mostrar "estimado R$ 62,40 → pago R$ 60,00", sem destaque
    negativo.
- **Estados:** sem modalidade definida ("fale com a operação") · semana em andamento · pagamento
  a pagar · pago · sem consumo cadastrado (sem linha de combustível).

### E14. Perfil do entregador

- **Estrutura** (padrão do Perfil do cliente: cartão no topo + seções com card de linhas):
  - **cartão:** foto, nome, telefone, "Entregador desde mar/2026". **Só leitura**: a foto e os dados
    são cadastrados pelo admin;
  - **Meu trabalho:** Crachá digital (E15) · Meus ganhos (E13) · Meus números (E17) · Minha
    escala (E18);
  - **Meu veículo** (só leitura): tipo, modelo/placa, combustível, consumo ("38 km/l"), ou "não
    cadastrado";
  - **Preferências:** App de mapas preferido · Notificações (toggle);
  - **Conta:** Trocar senha;
  - **Ajuda:** Falar com a operação (E12);
  - **Sair**, agora com confirmação ("Sair do app? As entregas guardadas sem sinal são enviadas
    antes.").
- Aviso: "Sua foto e seu primeiro nome aparecem para o cliente quando o pão sai para entrega."
- Dica: "Quer mudar algum dado? Fale com a operação."
- **Estados:** sem foto (iniciais) · com foto · sem veículo cadastrado · sair com envios pendentes
  (aviso mais forte).

### E15. Crachá digital ⭐ (novo)

- **Propósito:** o entregador mostra na portaria que é da Cheirin de Pão.
- **Elementos:**
  - tela cheia, pensada para ser **virada para o porteiro**: marca (BreadMark + "Cheirin de Pão"),
    **foto grande**, **nome completo**, função "Entregador", documento mascarado
    ("CPF ***.456.789-**");
  - status **"ATIVO"** em verde;
  - **selo animado + data e hora ao vivo** (segundos correndo), para mostrar que não é print de
    tela.
  - Proponha o acesso rápido: atalho no cabeçalho da E1 e linha no Perfil.
- **Estados:** ativo · entregador desativado pelo admin (o crachá não abre) · sem foto (iniciais,
  com aviso "peça sua foto à operação").

### E16. Recados ao cliente (sheet)

- **Só aparece se o admin liberou para o entregador.**
- **Elementos:**
  - destinatário ("Maria S. · Apto 101");
  - **modelos prontos**, sem texto livre: "Estou na portaria" · "Deixei com o porteiro" · "A
    portaria não liberou, pode avisar lá?" · "Seu pedido chega em alguns minutos";
  - "Enviar".
  - Nota: "O cliente recebe como notificação. Seu telefone não aparece."
- **Estados:** enviando · enviado ("Recado enviado às 05:41") · cliente desligou os recados
  (modelo indisponível, com aviso) · sem sinal (guardado).

### E17. Meus números

- **Elementos:**
  - período (7 · 30 dias);
  - entregas feitas, **taxa de sucesso**, pães entregues, tempo médio por rota, **km estimado** e
    **combustível estimado**;
  - gráfico simples de entregas por dia;
  - lista por dia (data, turnos, entregues/não entregues).
  - Tom motivador, sem ranking entre entregadores.
- **Estados:** sem histórico · com dados.

### E18. Minha escala (só leitura)

- **Elementos:** semana com os **dias de trabalho** e os turnos · **próximas folgas** (data +
  motivo curto, se o admin informou) · "Algo errado? Fale com a operação".
- **Estados:** sem folgas marcadas · com folgas · hoje é folga.

---

## 5. ADMIN

### A1. Detalhe do pedido — comprovante

- **Onde:** sheet de detalhe do pedido, nova seção **"Comprovante"**.
- **Elementos:** foto (miniatura → tela cheia), hora, entregador e, na não entrega, **motivo
  padronizado** + texto.
- **Estados:** com foto · **sem foto** (com o motivo da exceção) · foto pulada (entregador sem
  obrigatoriedade) · foto ainda subindo · não entrega com foto · problema reportado pelo entregador
  (selo + texto).

### A2. Aba Entregas — rotas, mapa ao vivo e "sem foto"

- **Elementos:**
  - por entregador e turno: **estado da rota** (Não iniciada · Em rota desde 05:12 · Encerrada
    06:40) + progresso + selo "ordem alterada hoje" (com "ver" → A4);
  - **Mapa ao vivo**: posição de cada entregador em rota (avatar no mapa), prédios concluídos e
    pendentes, "última posição há 2 min", **previsão de término** da rota;
  - na lista de paradas, selo **"sem foto"** e filtro **"Sem foto"**;
  - **divisão de entregas:** entregador **de folga** aparece como "de folga hoje" e fica fora da
    sugestão.
- **Estados:** nenhuma rota iniciada · rotas em andamento · entregador sem posição recente (app
  fechado / sem sinal) · todas encerradas.

### A3. Gestão › Entregadores — cadastro do entregador (ampliado)

- **Seções do formulário:**
  1. **Dados** (como hoje: nome, CPF, telefone, e-mail) + **foto** (câmera ou galeria, recorte
     redondo);
  2. **Veículo** (opcional): tipo (moto · carro · bicicleta · a pé), modelo, placa, combustível
     (gasolina/etanol/flex), **consumo km/l** (bicicleta/a pé escondem consumo e combustível);
  3. **Permissões e regras:**
     - **Exigir foto na entrega**;
     - **Exigir foto na não entrega**;
     - **Pode reordenar a rota** (vale só no dia);
     - **Pode enviar recados ao cliente**;
  4. **Pagamento:** modalidade (**por entrega · por rota · semanal fixo**) + valor em R$ + "pagar
     combustível estimado" (toggle, ligado);
  5. **Disponibilidade:** dias da semana e turnos em que trabalha + **folgas** por data (adicionar
     período + motivo opcional; lista de próximas folgas);
  6. **Rota** (→ A4).
- **Lista de entregadores:** mostra também "de folga hoje" e o selo "sugestão de rota nova" quando
  houver.
- **Estados:** novo entregador · edição · sem veículo · modalidade não definida (aviso) · folga
  sobreposta a uma rota já aprovada (aviso).

### A4. Rota do entregador — sugestão, aceite e rota salva

- **Onde:** cadastro do entregador › Rota (por turno), com atalho pela aba Entregas.
- **Elementos:**
  - **rota salva** (ordem atual) com minimapa, km e tempo estimados;
  - **sugestão do sistema**, quando houver, lado a lado ou em alternância: "Sugestão · 8,1 km
    (−1,1 km)" com o que mudou destacado (prédio novo, prédio que saiu, posições trocadas);
  - ações **"Usar sugestão"** · **"Manter a atual"** · **"Ajustar"** (lista com alças de
    arrastar) → **"Salvar rota"**;
  - **"Alterações do entregador"**: dias em que ele reordenou, com "ver ordem" e **"Adotar como
    rota padrão"**.
- **Estados:** sem rota salva (primeira sugestão) · rota salva sem sugestão nova · **sugestão nova
  pendente** (badge) · ajustando · salvo · alteração do entregador disponível.

### A5. Gestão › **Rotas e comprovante** (card novo no hub)

- **Elementos:**
  - **Base de saída:** endereço (busca) + pino arrastável no mapa;
  - **"Contar a volta à base no km"** (toggle);
  - **Tempo médio por porta** (stepper em minutos, usado na hora prevista);
  - **Preço do litro:** gasolina e etanol (R$, com "atualizado em");
  - **"Cliente vê a foto da entrega"** (toggle global; a obrigatoriedade é por entregador, em A3);
  - Salvar.
- **Estados:** base não definida (aviso: "a rota começa no primeiro prédio") · salvo.

### A6. Condomínio — "Acesso para o entregador"

- **Onde:** formulário do condomínio (Gestão › Condomínios), seção nova.
- **Elementos:** portaria (horário, tem porteiro?), portão/código de acesso, onde parar o veículo,
  observações, **foto da entrada**; lista de **sugestões dos entregadores** com "Aplicar" /
  "Descartar".
- **Estados:** vazio · preenchido · com sugestões pendentes (badge).

### A7. Solicitação de Gancho — "Enviar na rota"

- **Onde:** fila de ganchos existente (Gestão › Solicitação de Gancho).
- **Elementos:** em cada gancho a entregar, ação **"Enviar na rota"** → escolhe data e turno (o
  entregador vem da rota do cliente) → o gancho passa a **"Na rota de 01/10 · Manhã · Antônio"**.
  Ações: "Tirar da rota", e o registro manual de hoje continua.
- **Estados:** na fila (como hoje) · na rota (aguardando) · **entregue pelo entregador** (hora +
  nome) · não entregue na rota ("ficou para outro dia", volta para a fila).

### A8. Pagamentos dos entregadores ⭐ (novo)

- **Onde:** Gestão › Entregadores › **Pagamentos** (e atalho no Financeiro).
- **Elementos:**
  - período (semana), com lista por entregador das **propostas**: modalidade, base do cálculo
    ("208 entregas × R$ 1,50", "10 rotas × R$ 25,00", "semanal fixo"), **remuneração**,
    **combustível estimado** ("88 km ÷ 38 km/l × R$ 6,09"), **total estimado**;
  - ações por proposta:
    - **Aprovar**;
    - **Editar** (valor final da remuneração e do combustível, motivo do ajuste opcional);
    - **Descartar** (motivo);
  - ao aprovar: marcar **pago agora** (data, forma de pagamento) ou **a pagar** (vencimento). Vira
    despesa nas categorias **Entregador** e **Combustível** (favorecido = entregador);
  - **histórico** com estimado × pago, e link para a despesa criada.
- **Estados:** proposta pendente · editada (mostra estimado → final) · aprovada a pagar · paga ·
  descartada · entregador sem modalidade (proposta só de combustível, com aviso) · sem consumo
  cadastrado (sem combustível).

### A9. Relatório "Combustível & rotas" (Relatórios › Operação & financeiro)

- **Elementos:**
  - seletor de período;
  - **KPIs (estimados):** km, litros, R$, **custo por entrega**, **custo por pão**;
  - tabela por entregador (km, R$, entregas, custo/entrega);
  - economia das rotas sugeridas ("rotas aceitas economizaram ~42 km no mês");
  - atalho **"Ir para pagamentos"** (A8).
- **Estados:** carregando · sem dados.

### A10. Ocorrências e notificações do admin

- **Tipos novos** na central e nos toggles de preferência:
  - **Problema reportado** (E11);
  - **Ocorrência do entregador** (E12);
  - **Sugestão de acesso** (E7);
  - **Nova sugestão de rota** (A4);
  - **Pagamento a aprovar** (A8).
  Defina ícone e tom de cada um no padrão existente.
- **Relatório "Entregas & falhas"**: os motivos passam a ser os padronizados (regra 10). Mostre a
  distribuição por motivo.

---

## 6. CLIENTE

### C1. Acompanhamento — entregador e "a caminho"

- O card **"Seu entregador"** mostra **foto + primeiro nome** ("Antônio") em vez de "A definir", e
  **só aparece depois que a rota é iniciada**.
- A timeline continua com 3 estados, mas **"Saiu para entrega" só acende quando o entregador inicia
  a rota**, com a linha "a caminho desde 05:40". Antes disso, fica em "Agendado".
- **Estados:** agendado (sem card do entregador) · a caminho (com card) · entregue · não entregue.

### C2. Foto da entrega (só se o admin liberou)

- **Entregue:** no Acompanhamento, bloco **"Comprovante"** com a miniatura da foto e a hora
  ("Entregue às 06:12") → visualizador em tela cheia, com "Algo errado? Fale com o suporte".
- **Não entregue:** "Tentamos entregar às 05:52" + motivo em linguagem do cliente ("não
  conseguimos acesso pela portaria") + foto.
- **Histórico:** ícone `camera` na linha de pedido com comprovante, que abre o mesmo visualizador.
- **Estados:** com foto · sem foto ou função desligada (a seção não aparece) · foto expirada (mais
  de 90 dias: "o comprovante fica disponível por 90 dias").

### C3. Notificações

- **"Entrega realizada":** o botão passa a ser **"Ver foto"** quando houver comprovante e a função
  estiver ligada.
- **Recado do entregador** (tipo novo): "Antônio: Estou na portaria 🥖". Defina ícone e tom.
- **Perfil › Notificações:** toggle novo **"Recados do entregador"** (ligado por padrão).

---

## 7. Dados de exemplo (para o protótipo — ficam em `app/data.jsx`)

```js
COURIER = { nome: 'Antônio Ribeiro', primeiroNome: 'Antônio', foto: null, desde: 'mar/2026',
  cpfMascarado: '***.456.789-**', ativo: true,
  veiculo: { tipo: 'moto', modelo: 'CG 160', placa: 'ABC1D23', combustivel: 'gasolina', kmPorLitro: 38 },
  regras: { fotoEntrega: true, fotoNaoEntrega: true, podeReordenar: true, podeRecados: true },
  pagamento: { modalidade: 'por_entrega' /* 'por_rota' | 'semanal_fixo' */, valor: 1.5, pagaCombustivel: true },
  escala: { dias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], folgas: [{ de: '12/10', ate: '13/10', motivo: 'Folga' }] },
  appMapas: null /* 'google' | 'waze' | 'apple' */ }

ROUTE_CFG = { base: { nome: 'Padaria Pão Nosso', endereco: 'Rua das Flores, 120' },
  voltaBase: true, minPorPorta: 1, precoGasolina: 6.09, precoEtanol: 4.19, clienteVeFoto: true }

ROTAS_HOJE = [
  { turno: 'manha', rotulo: '☀️ Manhã · 06:30', estado: 'em_rota', inicio: '05:12', km: 9.2, paradas: 12, feitas: 7, ordemAlteradaHoje: false },
  { turno: 'tarde', rotulo: '🌇 Tarde · 16:00', estado: 'pronta', km: 6.1, paradas: 5, feitas: 0 },
]

ENTREGAS = [ // manhã — 4 prédios, na ordem da rota
  { condo: 'Residencial Jardins', bairro: 'Centro', eta: '05:25',
    acesso: { portaria: '24 h, com porteiro', portao: 'Interfone 0 — falar "pão"', parar: 'Vaga de visitante, à direita', obs: 'Bloco 2 tem entrada pelo Lado A e pelo Lado B', foto: true },
    paradas: [
      { bloco: '1', compl: null, ap: '101', cliente: 'Maria Souza', qtd: 4, cesta: [{ n: 'Café 250 g', q: 1 }], gancho: true, primeira: false, status: 'entregue', hora: '05:31', foto: 'ok' },
      { bloco: '1', compl: null, ap: '204', cliente: 'Pedro Alves', qtd: 6, gancho: false, primeira: true, status: 'entregue', hora: '05:33', foto: 'enviando' },
      { bloco: '2', compl: 'Lado A', ap: '12', cliente: 'Ana Lima', qtd: 3, gancho: false, ganchoNaRota: true, status: 'pendente' },
      { bloco: '2', compl: 'Lado B', ap: '31', cliente: 'Carlos Mendes', qtd: 0, cesta: [{ n: 'Queijo minas', q: 1 }, { n: 'Suco 1 l', q: 2 }], status: 'pendente' },
    ] },
  { condo: 'Condomínio Bela Vista', bairro: 'Jardim América', eta: '05:48', acesso: null, paradas: [ /* 3 paradas, 1 nao_entregue: motivo 'Portaria não liberou', foto 'ok' */ ] },
  { condo: 'Edifício Aurora', bairro: 'Vila Nova', eta: '06:02', paradas: [ /* 3 pendentes, 1 sem localização no mapa */ ] },
  { condo: 'Vila Verde', bairro: 'Santa Rita', eta: '06:15', paradas: [ /* 2 pendentes */ ] },
]

FILA_OFFLINE = { pendentes: 2 } // confirmações/fotos guardadas sem sinal

GANHOS = {
  semanaAtual: { de: '29/09', ate: '05/10', entregas: 142, remuneracao: 213.0, combustivel: 7.8, estimado: 220.8 },
  extrato: [
    { periodo: '22/09–28/09', remuneracao: 312.0, combustivel: 11.4, estimado: 323.4, final: 320.0, status: 'pago', pagoEm: '29/09' },
    { periodo: '15/09–21/09', remuneracao: 298.5, combustivel: 10.9, estimado: 309.4, final: 309.4, status: 'pago', pagoEm: '22/09' },
  ],
}

NUMEROS_30D = { entregas: 312, sucesso: 0.97, paes: 1180, tempoMedioRota: '1h 22min', km: 356, combustivel: 57.1 }

ADMIN_ROUTE_SUGGESTION = { entregador: 'Antônio R.', turno: 'Manhã',
  atual: { km: 9.2, ordem: ['Residencial Jardins', 'Bela Vista', 'Aurora', 'Vila Verde'] },
  sugestao: { km: 8.1, ordem: ['Residencial Jardins', 'Aurora', 'Bela Vista', 'Vila Verde', 'Parque das Águas'], novo: ['Parque das Águas'] } }

ADMIN_PAYOUTS = [ // semana 29/09–05/10
  { nome: 'Antônio R.', modalidade: 'por_entrega', base: '142 × R$ 1,50', remuneracao: 213.0, km: 49.3, combustivel: 7.8, estimado: 220.8, status: 'pendente' },
  { nome: 'Joana P.', modalidade: 'semanal_fixo', base: 'semanal fixo', remuneracao: 400.0, km: 51.0, combustivel: 8.2, estimado: 408.2, final: 405.0, status: 'editada' },
  { nome: 'Rui M.', modalidade: null, base: '—', remuneracao: 0, km: 12.0, combustivel: 1.9, estimado: 1.9, status: 'pendente' },
]

ADMIN_FUEL_REPORT = { km: 712, litros: 18.7, gasto: 114.0, porEntrega: 0.19, porPao: 0.05, economiaRotasKm: 42 }
```

---

## 8. Tom e microcopy

- **Curto e direto**, verbo no imperativo, uma ideia por frase. Quem lê está de pé, com pressa e no
  escuro.
- Números como o entregador fala: "Apto 101", "Bloco 2 · Lado A", "4 pães", "12 paradas",
  "~9,2 km", "06:42", "R$ 6,60".
- **Nunca culpar:** "Não conseguimos confirmar agora, guardamos para enviar" em vez de "Erro".
  Sinal fraco é normal, não é erro.
- **Estimado é estimado:** km, combustível e ganhos da semana aparecem sempre com "~" ou
  "estimado". Valor final é o que o admin aprovar.
- Para o cliente, manter o tom aconchegante da marca ("Seu pãozin chegou às 06:12 🥖").
- Exemplos:
  - pop-up de sucesso: "Entrega confirmada" · "Apto 101 · Bloco 2 · Lado A" · "Maria Souza ·
    Residencial Jardins";
  - já confirmada: "Essa entrega já foi confirmada às 06:42";
  - outra rota: "Esse cupom é de outra rota. Separe o saquinho e avise a operação.";
  - sem sinal: "Sem sinal agora. Guardamos a entrega e enviamos sozinhos.";
  - foto: "Foto da entrega · mostre o saquinho na porta ou no gancho";
  - reordenar: "Essa ordem vale só para hoje.".

---

## 9. Entregável (checklist do handoff)

1. **Telas novas no protótipo:**
   - `app/screens-courier.jsx` — **substitui** `CourierScreen`/`CourierRoute` de
     `screens-roles.jsx`, com E1–E18 e os componentes reutilizáveis: linha de parada com selos,
     cabeçalho do prédio com acesso, pop-up de resultado, câmera (scanner/foto), sheet de motivo,
     card "Próxima parada", faixa de sincronização, card de estado da rota, crachá;
   - `app/screens-courier-admin.jsx` — admin: A2–A5, A7–A9.
2. **Integrações nas telas existentes:**
   - rotas em `app/app.jsx`;
   - detalhe do pedido (A1), formulário de condomínio (A6), fila de ganchos (A7), hub de Gestão
     (card A5), Relatórios (A9), notificações e preferências (A10) nos arquivos de admin;
   - Acompanhamento, Histórico, central de notificações e Perfil › Notificações do cliente
     (C1–C3).
3. **Mocks** da seção 7 em `app/data.jsx`.
4. **Ícones novos** (§2) no set de `brand.jsx`, no mesmo traço.
5. **`handoff-app-entregador.md`**, na mesma estrutura dos handoffs anteriores:
   1. conceito e regras (§3);
   2. modelo de dados (mock → backend);
   3. cada tela com propósito, layout, elementos, **todos os estados** e textos finais;
   4. **fluxos passo a passo**:
      - câmera contínua (escanear → confirmado → gancho? → foto → próximo), nas variantes
        obrigatória e opcional;
      - não entrega;
      - iniciar e encerrar rota;
      - reordenar hoje;
      - sugestão de rota → aceite do admin;
      - proposta de pagamento → aprovar/editar/descartar;
      - gancho enviado na rota;
      - sem sinal;
   5. navegação (de onde se chega a cada tela);
   6. tokens usados;
   7. acessibilidade (estado com ícone + texto, alvos de 56/44 px, contraste) e pontas soltas.
   - Marque claramente o que é **só visual** numa tela existente e o que é **comportamento novo**.
