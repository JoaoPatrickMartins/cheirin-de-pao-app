# Handoff: Melhorias do app do Entregador (Cheirin de Pão)

> ⚠️ **Este README foi montado a partir do código do pacote em 01/10/2026.** O
> `handoff-app-entregador.md` do Claude Design (citado em `design/app/data.jsx` como "§2") não veio
> na exportação. Se ele for exportado depois, salve-o nesta pasta e confira contra este README e
> contra a §2 do plano ([`../docs/plano-app-entregador.md`](../docs/plano-app-entregador.md)).

## Sobre os arquivos deste pacote

Os arquivos em `design/` são **referências de design feitas em HTML/React (Babel no navegador)**.
Eles mostram o visual e o comportamento esperados, mas **não são código de produção para copiar**.
A tarefa é **recriar essas telas no código real**, com os padrões e componentes que o app já tem.
Os mocks de `data.jsx` indicam o formato dos dados, que deve vir do backend.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, raios, sombras, textos e estados são
finais. Duas exceções:

- **Mapas:** o protótipo usa tiles da Esri porque o preview bloqueia o OpenStreetMap. No app, use
  os tiles do OSM que já estão no `CourierMap`.
- **Fotos:** aparecem como placeholders listrados (`CRPhotoPh`). No app, use `<img>`.

## Como abrir as referências

- `design/App Entregador - Telas.html`: quadro **Entregador 1** (Kit, E1–E8).
- `design/App Entregador - Telas 2.html`: quadro **Entregador 2** (E9–E18).
- `design/App Entregador - Telas 3.html`: quadro **Admin + Cliente** (A1–A10, C1–C3).
  Os três HTML são iguais; muda só `window.CR_PART` ('a' | 'b' | 'c').
- `design/Cheirin de Pão - App.html`: protótipo navegável. Em Entregador, `CourierApp` simula
  escanear → confirmado → foto → volta à lista.

## Capturas (`screenshots/`)

| Arquivo | Conteúdo |
|---|---|
| `00-kit.png` | Botões grandes, selos (sempre ícone + texto), faixas de sincronização, linha de parada, dock do rodapé (3 modos), 21 ícones novos |
| `01-e1-tela-principal.png` | E1 em 9 estados: em rota, pronta + push desligado, dois turnos, encerrada, sem sinal, entregas novas, carregando, sem entregas, folga |
| `02-e2-scanner.png` | E2: permissão, negada, lendo, lanterna, lido, câmera indisponível |
| `03-e3-digitar-codigo.png` | E3: vazio, não está na rota, já confirmada |
| `04-e4-resultado-scan.png` | E4: sucesso, gancho na rota, sem sinal, já confirmada, outra rota, não encontrado, pela lista |
| `05-e5-foto.png` | E5: obrigatória, opcional (Pular), prévia, "não consigo tirar", salva |
| `06-e6-confirmar-nao-entrega.png` | E6: sheet de confirmar, motivo escolhido, "Outro" + texto |
| `07-e7-predio-acesso.png` | E7: acesso completo, sem dicas, sugerir correção |
| `08-e8-iniciar-rota.png` | E8: normal, sem localização |
| `09-e9-rota-ativa.png` | E9: em rota, pronta, reordenando, dois turnos, tudo entregue, variações, escolher app de mapas |
| `10-e10-encerrar-rota.png` | E10: com pendências, sem pendências, encerrada |
| `11-e11-realizadas.png` | E11: lista com reportado, sheet "Reportar problema", vazio |
| `12-e12-e13-operacao-ganhos.png` | E12 ocorrência · E13 ganhos (3 modalidades, sem consumo, sem modalidade) |
| `13-e14-perfil.png` | E14: normal, com foto/sem veículo, sair, sair com pendências |
| `14-e15-cracha.png` | E15: ativo, sem foto, desativado |
| `15-e16-recados.png` | E16: escolhendo, cliente desligou |
| `16-e17-e18-numeros-escala.png` | E17 números (dados, vazio) · E18 escala (normal, hoje folga) |
| `20-a1-comprovante.png` | A1: com foto, outros estados, tela cheia |
| `21-a2-entregas.png` | A2: em andamento, posição velha, nenhuma iniciada, encerradas, filtro "Sem foto" |
| `22-a3-entregadores.png` | A3: lista, edição, novo, variações por seção |
| `23-a4-rota-entregador.png` | A4: 1ª sugestão, sugestão pendente, ajustando, salvo, alterações do entregador |
| `24-a5-rotas-comprovante.png` | A5: hub com card novo, configurado, base não definida |
| `25-a6-acesso-condominio.png` | A6: vazio, preenchido com sugestões |
| `26-a7-gancho-na-rota.png` | A7: fila com 4 estados, sheet "Enviar na rota" |
| `27-a8-pagamentos.png` | A8: propostas, editar, aprovar, histórico |
| `28-a9-a10-relatorios-avisos.png` | A9 combustível & rotas · A10 notificações, preferências, entregas & falhas |
| `30-c1-c2-acompanhamento.png` | C1/C2: agendado, a caminho, entregue, não entregue, visualizador, histórico |
| `31-c3-notificacoes.png` | C3: central, Perfil › Notificações |

Os nomes dos estados correspondem aos valores de `st` / `kind` / `variant` dos componentes.

---

## Arquivos da feature

- `design/app/screens-courier.jsx` — **kit** (`CRLabel`, `CRBig`, `CRIconBtn`, `CRSpin`, `CRSkel`,
  `CRTag`, `CRProof`, `CRCesta`, `CRPhotoPh`, `CRAvatar`, `CRSheet`, `CRToast`, `CRNote`, `CRSync`,
  `CRHeader`, `CRTurnoChip`, `CRRouteLine`, `CRRouteCard`, `CRSeg`, `CRProgress`, `CRDock`,
  `CRCheck`, `CRStopRow`, `CRAccess`, `CRBuilding`, `CRTurnoSection`, `CRWeekMini`) + **E1**
  `CourierHome` + **E7**.
- `design/app/screens-courier2.jsx` — câmera contínua: **E2** `ScanScreen`, **E3**
  `CRCodeSheet`, **E4** `CRResult`, **E5** `PhotoScreen` + `CRNoPhotoSheet`, **E6**
  `CRConfirmSheet` / `CRFailSheet`, mais `CRChoice` e `CRTextarea`.
- `design/app/screens-courier3.jsx` — rota: `CRMap`, **E8** `CRStartSheet`, `CRNavSheet`,
  `CRNextStop`, `CRStopOrder`, **E9** `CRRouteTab` (+ `CRRouteVariants`), **E10**
  `CREndScreen`, **E11** `CRDoneList` + `CRReportSheet`.
- `design/app/screens-courier4.jsx` — **E12** `CROpsScreen`, **E13** `CREarnings`, **E14**
  `CRProfile`, **E15** `CRBadgeScreen` (`CRSeal`, `CRSecRing`, `crNow`), **E16**
  `CRRecadoSheet`, **E17** `CRNumbers`, **E18** `CRSchedule`, mais `CRRow` e `CRPage`.
- `design/app/screens-courier-admin.jsx` — `CATabs`, `CAHead`, `CAScreen`, `CASwitchRow`,
  `CASeg`, `CASec`, `CRPhotoViewer`; **A1** `CAOrderProof`, **A2** `CAEntregas`, **A3**
  `CACourierList` / `CACourierForm`, **A4** `CARoute`, **A5** `CARouteCfg`.
- `design/app/screens-courier-admin2.jsx` — `CAGestaoHub` (card novo), **A6** `CACondoAccess`,
  **A7** `CAHooks`, **A8** `CAPayouts` / `CAPayCard`, **A9** `CAFuelReport`, **A10**
  `CAAdminNotifs` / `CAFailReport`.
- `design/app/screens-courier-client.jsx` — **C1/C2** `CCTrack`, `CCPhotoViewer`, `CCHistory`;
  **C3** `CCNotifs`, `CCNotifPrefs`; `CourierApp` (navegável).
- **Integrações:**
  - `app.jsx` — Entregador usa `CourierApp`; `track` do cliente usa `CCTrack`;
  - `brand.jsx` — 21 ícones novos: camera, flash, keyboard, navigate, locate, play, flag, fuel,
    moto, car, bike, walk, image, cloudUp, cloudOff, hook, gate, badge, grip, dayoff, send. O
    `box` é usado em `CRFailSheet`/`CROpsScreen`/`CATabs`, mas **não foi desenhado**;
  - `data.jsx` — mocks `COURIER`, `ROUTE_CFG`, `ROTAS_HOJE`, `CR_ENTREGAS`, `FILA_OFFLINE`,
    `GANHOS`, `NUMEROS_30D`, `ADMIN_ROUTE_SUGGESTION`, `ADMIN_PAYOUTS`, `ADMIN_FUEL_REPORT`,
    `MOTIVOS_NAO_ENTREGA`, `MOTIVOS_CLIENTE`, `RECADOS`, `MODALIDADES`.
- Telas do protótipo que **não mudaram**: todas as outras (`screens-admin*`, `screens-home`,
  `screens-roles` etc.). As integrações em telas existentes (detalhe do pedido, hub de Gestão,
  condomínio, ganchos, acompanhamento) estão desenhadas **dentro** dos arquivos novos.

## Fluxos principais (do código)

1. **Câmera contínua (E2→E4→E5):** lê o QR → congela + bipe → pop-up E4 com contagem de 3 s
   (tocar adianta) → foto E5 na mesma câmera → prévia → "Usar foto" → toast "Foto salva ·
   escaneie o próximo" → volta a ler.
   - Com **gancho na rota**, a E4 pergunta "Deixou o gancho também?" e não avança sozinha.
   - **Erros** ("já confirmada", "outra rota", "não encontrado") não avançam e pedem "Entendi".
2. **Pela lista (E6):** sheet com Apto em 50 px → "Confirmar entrega" → E4 (fundo claro) → E5.
   "Não consegui entregar" → motivo → foto (obrigatória ou opcional) → envia.
3. **Rota:**
   1. dock "Iniciar rota · turno" → sheet E8 (base / minha localização);
   2. em rota, o dock vira "Escanear cupom 7/12" + teclado;
   3. tudo resolvido → "Encerrar rota" → E10 (pendências bloqueiam).
4. **Rota do admin (A4):** sugestão (1ª ou nova) → Usar / Manter / Ajustar (arrastar) → salvar.
   "Alterações do entregador" → Adotar como rota padrão.
5. **Pagamento (A8):** proposta semanal por entregador → Aprovar ("pago agora" ou "a pagar") →
   vira despesa Entregador + Combustível. Também dá para Editar ou Descartar.
