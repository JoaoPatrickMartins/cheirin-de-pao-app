# Plano — Correção: depois da 1ª entrega, o turno não pode mais ser recusado

> ✅ **Status:** **IMPLEMENTADO** em 06/10/2026 (execução direta, sem GSD). **Sem commit** até autorização
> explícita. Branch `feat/add-complementocliente`.
> Verificação: typecheck api + web ✅ · `vite build` ✅ · api **1.999 + 3 todo** · web **685 + 17 todo** ·
> shared **117 + 4 todo**. Os 4 testes novos do web falham com a tela antiga. Ver §7 para o que mudou em
> relação ao plano.
> Corrige a **implementação** da D-T5 de [plano-termos-legais.md](./plano-termos-legais.md) §5. A regra
> continua a mesma ("pode recusar até **iniciar a rota** (ou resolver a 1ª parada)"), e o Termo não muda.
> O problema é que a tela do entregador não segue essa regra.
> Decisões fechadas com o usuário em 06/10/2026.

## 1. O que está errado

**API: já está certa.** [`CourierShiftService.decline`](../../apps/api/src/modules/courier/courier-shifts.ts)
responde 409 `STARTED` ("A rota já começou. Para sair dela, fale com a operação.") nestes casos:
a `CourierRun` do turno está `STARTED`/`ENDED`, ou há pão ou Cestinha do turno `DELIVERED`/`NOT_DELIVERED`.
Além disso, a 1ª confirmação inicia a rota sozinha (`ensureStarted`).

**Tela: não segue a regra.** Em [`CourierScreen.tsx`](../../apps/web/src/pages/courier/CourierScreen.tsx)
(`visibleShifts`), o cartão do turno só some quando `data.routes[].state` vira `em_rota`/`encerrada`.
Esse estado vem do servidor e **não é recarregado** depois de uma confirmação: `markDelivered` só marca
a parada na sessão, sem refazer a rota. Por isso o cartão "Turno da manhã aceito · **Recusar**" continua
aparecendo depois da entrega:

- por até 60 s, até a próxima recarga em segundo plano;
- ou até o entregador tocar em "Atualizar", se a recarga trouxe entregas novas: aí ela fica parada no
  banner (M-1) e o estado da rota não muda.

### Consequências

| # | Caso | O que acontece | Gravidade |
|---|---|---|---|
| P-1 | Com sinal, entregou e tocou em Recusar | Escolhe o motivo, toca em "Recusar turno" e só então recebe o 409 dentro do sheet | UX |
| P-2 | **Sem sinal**, entregou (as confirmações ficaram na fila) e tocou em Recusar quando o sinal voltou | Para o servidor a rota não começou. Se a recusa chega **antes** de a fila subir, ela passa: os pedidos voltam para a divisão (`courierId: null`, `SEPARATED`), as confirmações guardadas recebem 403 e o app avisa "Uma entrega guardada não pôde ser enviada". Resultado: **pão entregue na porta, mas registrado como redistribuído** | **Alta** (dados e créditos) |
| P-3 | Rota só de gancho (gancho sozinho), gancho entregue | A recusa só é barrada porque a rota iniciou sozinha. Como o `ensureStarted` é *best-effort*, se ele falhar a recusa passa e o admin recebe "N paradas voltaram" sem nada para voltar | Baixa |

---

## 2. Decisões confirmadas (06/10/2026)

| # | Decisão | Detalhe |
|---|---|---|
| **R-1** | **A trava vale na 1ª parada resolvida ou ao iniciar a rota** | Entregue **ou** não entregue conta como resolvida, igual à API. Turno só aceito (ou sem resposta) e sem parada resolvida **continua recusável**. A D-T5 e o Termo não mudam |
| **R-2** | **Com a trava, o cartão some** | Igual ao que já acontece quando a rota é iniciada. O turno segue visível no card "Rota de hoje". Nada novo de tela |
| **R-3** | **Parada guardada na fila offline também trava** | A trava é calculada no aparelho, com as paradas da sessão e as da fila. Isso fecha o P-2: sem o botão, a recusa não tem como chegar antes da fila |
| **R-4** | **O 409 da recusa fecha o sheet** | Se o servidor barrar (por exemplo, entrega feita em outro aparelho ou o admin retirou o turno), o sheet fecha, o cartão sai, aparece um toast com a mensagem do servidor e a tela recarrega |

---

## 3. Mudanças

### 3.1 Web: a trava do cartão (`CourierScreen.tsx`)

O `routeLines` já calcula `done` por turno: `completedN`, as concluídas no servidor (`data.completed`),
mais `resolvedActive`, as resolvidas na sessão **e** as guardadas na fila (`confirmedIds`/`notDeliveredIds`
juntam as duas). A trava é uma condição a mais no filtro:

```ts
// O cartão do turno some quando a rota começa ou quando a 1ª parada daquele turno é resolvida —
// na tela, na fila offline ou no servidor (D-T5): aí não dá mais para recusar.
const visibleShifts = shifts.filter((s) => {
  const line = routeLines.find((l) => l.route.slotId === s.slotId)
  return !line || (line.route.state === 'pronta' && line.done === 0)
})
```

- O cartão some **na hora** da confirmação, sem recarregar (o `sessionConfirmed` muda o `done`).
- Continua sumido ao reabrir o app sem sinal, porque a fila persiste e o `confirmedIds` a inclui.
- A trava é **por turno**: uma parada resolvida na manhã não trava o cartão da tarde.

### 3.2 Web: o 409 na recusa (`onDeclineShift`)

Hoje, qualquer erro com sinal vira texto dentro do `DeclineShiftSheet`. Com 409, o turno não pode mais
ser recusado (`STARTED`, `PAST`, `DECLINED` ou `WITHDRAWN`), então manter o sheet aberto não faz sentido:

```ts
if (!r.ok && r.status === 409) {
  setDeclineFor(null)
  setShifts((list) => list.filter((x) => x.id !== declineFor.id))
  setToast({ text: r.error, icon: 'alert', tone: 'gold' })
  void load('manual')
  return null
}
```

Os outros erros, e a falta de sinal, continuam como estão.

### 3.3 API: gancho resolvido também trava (`courier-shifts.ts`)

Em `decline`, depois da contagem de pão e Cestinha, conta também o gancho sozinho resolvido no turno,
só quando os anteriores deram zero, no mesmo padrão do `marketResolved`:

```ts
const hookResolved = resolved + marketResolved > 0 ? 0
  : (await resolvedHookOnlyStops(this.prisma, [courierId], offer.date, offer.date, offer.slotId)).length
```

e inclui `hookResolved` na condição do 409 `STARTED`. Fecha o P-3 sem depender do `ensureStarted`.

### 3.4 Comentários e documentação

- `ShiftOffer.tsx` (JSDoc do `ShiftOfferCard`) e o comentário do `visibleShifts`: "a recusa é livre até
  iniciar a rota **ou resolver a 1ª parada**".
- `plano-termos-legais.md`, **VT-3**: acrescentar "…até iniciar a rota ou resolver a 1ª parada (na tela,
  inclusive a guardada sem sinal); ver plano-correcao-recusa-turno".
- `checklist-deploy-app-entregador.md`:
  - §1.2: nova linha "Correção recusa de turno" com os números;
  - §5 (Termo + turnos): novos itens no roteiro manual (ver §4.2 abaixo).

---

## 4. Testes

### 4.1 Automatizados

**web, `CourierScreen.test.tsx` (+5):**

1. Rota `pronta`, com uma parada do turno da manhã em `completed` → nenhum cartão de turno, nenhum "Recusar".
2. Rota `pronta`, turno aceito: confirmar uma parada pelo "Digitar código" → o cartão some na hora, sem
   nova chamada a `/courier/orders/today`.
3. Confirmação guardada na fila offline (rede caindo no `confirm`) → o cartão some; ao remontar a tela com
   a fila ainda cheia, continua sumido.
4. Parada resolvida no turno da **tarde** → o cartão da **manhã** continua com Aceitar / Recusar.
5. Recusar com resposta 409 `STARTED` → o sheet fecha, aparece o toast "A rota já começou…", o cartão sai
   e a tela recarrega.

O teste que já existe ("com a rota do turno iniciada, o cartão do turno some") continua valendo.

**api, `courier-shifts.test.ts` (+1):**

6. Gancho sozinho resolvido no turno, rota sem `CourierRun`, nenhum pão ou Cestinha resolvido → 409
   `STARTED`, nada é devolvido e o admin não é avisado.

### 4.2 Manual (entra no §5 do checklist)

- [ ] Turno aceito, **sem iniciar a rota**: confirmar a 1ª entrega → o cartão "Turno aceito · Recusar"
      some na hora.
- [ ] O mesmo **sem sinal** (modo avião): entregar 1 parada → o cartão some; fechar e abrir o app sem
      sinal → continua sumido; voltar o sinal → a fila sobe e a entrega fica certa no admin.
- [ ] Marcar 1 parada como **não entregue** → o cartão também some.
- [ ] Dia com manhã e tarde: entregar na manhã → o cartão da tarde continua recusável.
- [ ] Sheet de recusa aberto, entregar pelo outro aparelho (ou pela API) e confirmar a recusa → toast
      "A rota já começou…", o sheet fecha e o cartão sai.

---

## 5. Limites conhecidos

- **Corrida no servidor:** a recusa confere e depois devolve, sem transação. Uma confirmação que chegue
  no mesmo instante pode passar entre as duas etapas. A janela é de milissegundos e, com a trava na tela
  (R-3), a recusa não sai depois de uma entrega feita no próprio aparelho. Risco aceito.
- **Entrega feita em outro aparelho** com a tela deste ainda desatualizada: o botão aparece, mas o
  servidor barra e o R-4 trata.

---

## 6. Ordem de execução

1. **API**: §3.3 e o teste 6.
2. **Web**: §3.1 e §3.2, com os testes 1–5.
3. **Comentários e documentação**: §3.4.
4. **Verificação**: typecheck do api e do web, `vitest run` no api, no web e no shared, `vite build` do web.
5. **Checklist**: atualizar os números (§1.2) e o roteiro (§5) com o resultado real.

---

## 7. O que mudou em relação ao plano

- **Web: 4 testes em vez de 5.** O caso "parada resolvida na tarde não trava a manhã" entrou no teste 1,
  invertido: parada concluída na **manhã** no servidor, o cartão da manhã some e o da tarde fica. O que se
  prova é o mesmo (a trava é por turno), e o dia com dois turnos vem do servidor sem precisar abrir a
  lista dividida por turno.
- **Não entrega** ficou só no roteiro manual: ela soma no mesmo `done` (`notDeliveredIds`) que a
  confirmação.
- O teste antigo "com a rota do turno iniciada…" passou a usar os mesmos ajudantes (`turnRoute`,
  `withRoutes`) e espera as respostas chegarem (`settle`) antes de conferir que o cartão não aparece.
  Os testes que conferem ausência fazem o mesmo.
- O teste do 409 simula a entrega feita em outro aparelho: depois da recusa barrada, a rota volta
  `em_rota` e o cartão continua fora após a recarga.
