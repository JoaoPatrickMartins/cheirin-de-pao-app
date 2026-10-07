# Checklist — testes e deploy do app do Entregador

> 📝 **Para quê:** juntar num lugar só tudo o que precisa ser testado e feito **antes**, **durante**
> e **depois** do deploy das melhorias do entregador. É para rodarmos juntos, passo a passo.
>
> **Situação (06/10/2026):** ✅ **Ondas 0–11 + termo do entregador
> ([plano-termos-legais](./plano-termos-legais.md)) + rota padrão
> ([plano-rota-padrao](./plano-rota-padrao.md)) concluídos** · **nada commitado** · ✅ **pronto para
> executar**. Ordem sugerida: 1 → 2.1 → 2.2 (UAT em aparelho real, §5 inteira) → 2.3–2.7 → 3 → 4.
>
> Fonte dos detalhes: [`plano-app-entregador.md`](./plano-app-entregador.md) (§8 riscos e infra,
> §9 UAT, §10 registro por onda).

---

## 1. Testes automatizados

### 1.1 Como rodar (na raiz do monorepo)

```bash
# Typecheck
(cd apps/api && npx tsc --noEmit)
(cd apps/web && npx tsc --noEmit)

# Testes
(cd apps/api && npx vitest run)
(cd apps/web && npx vitest run)
(cd packages/shared && npx vitest run)

# Build do front (confere o bundle e o service worker do PWA)
(cd apps/web && npx vite build)
```

### 1.2 Números esperados (atualizar a cada onda)

| Onda | api | web | shared |
|---|---|---|---|
| Base (antes) | 1.736 + 3 todo | 426 + 17 todo | 82 + 4 todo |
| 0 | 1.745 + 3 | 435 + 17 | 82 + 4 |
| 1 | 1.763 + 3 | 446 + 17 | 100 + 4 |
| 2 | 1.789 + 3 | 472 + 17 | 100 + 4 |
| 3 | 1.820 + 3 | 501 + 17 | 100 + 4 |
| 4 | 1.821 + 3 | 532 + 17 | 100 + 4 |
| 5 | 1.878 + 3 | 559 + 17 | 100 + 4 |
| 6 | 1.891 + 3 | 586 + 17 | 103 + 4 |
| 7 | 1.911 + 3 | 601 + 17 | 108 + 4 |
| 8 | 1.936 + 3 | 633 + 17 | 110 + 4 |
| 9 | 1.940 + 3 | 638 + 17 | 110 + 4 |
| 10 | 1.949 + 3 | 644 + 17 | 110 + 4 |
| 11 | 1.959 + 3 | 658 + 17 | 115 + 4 |
| Termo + turnos (final) | 1.976 + 3 | 672 + 17 | 117 + 4 |
| Correção recusa de turno (06/10) | 1.999 + 3 | 685 + 17 | 117 + 4 |
| Rota padrão (06/10) | **2.045 + 3** | **696 + 17** | **117 + 4** |

Tudo verde em cada linha. `vite build` ok desde a Onda 2.

### 1.3 O que o CI faz e o que não faz

- **Backend** (`mainBackend.yml`, todo push): instala, `prisma generate`, **roda os testes da API** e
  o build. O deploy só acontece na `main`.
- **Frontend** (`mainFrontend.yml`): **não roda os testes do web**. Por isso o passo 1.1 do web é
  obrigatório antes do merge na `main`.

---

## 2. Antes do deploy

### 2.1 Código
- [ ] Todas as ondas concluídas e registradas no plano (§10).
- [ ] Testes, typecheck e build do passo 1.1 verdes, com os números da última onda.
- [ ] Commits feitos **com a sua autorização** (regra do projeto), branch `feat/add-complementocliente`
      → `development` → `main` (o deploy dispara na `main`).

### 2.2 Teste em celular de verdade, ainda sem deploy
A câmera só funciona em HTTPS. Sem ambiente DEV, o caminho é o **túnel HTTPS** do Vite local
(ngrok ou Cloudflare), como na §10.3 do `plano-login-social.md`, com a API local apontada para o
**banco de teste** (`cheirin-de-pao-teste`).
- [ ] iPhone: Safari em aba **e** PWA instalado.
- [ ] Android: Chrome em aba **e** PWA instalado.
- [ ] Rodar o roteiro da **§5** inteiro nos dois.

#### 2.2.1 Dados de teste prontos (seed do entregador)

O script `apps/api/src/scripts/seed-courier-test.ts` cria **pedidos de HOJE, turno da manhã**, no
banco de teste (ele se recusa a rodar em outro banco). Entregador: **Joao Patrick Martins**
(`entregador@gmail.com`).

```bash
cd apps/api
npm run seed:courier-test                 # cria e gera a folha de QR (/tmp/cheirin-cupons-teste.html)
npm run seed:courier-test -- --sheet      # só gera a folha de novo
npm run seed:courier-test -- --clean      # apaga tudo o que criou (e o que o teste gerou no dia)
npm run seed:courier-test -- --clean --reset-terms   # e o aceite do termo, para testar o bloqueio de novo
```

Os dados são do **dia em que o script rodou**: em outro dia, `--clean` e criar de novo.

| Parada | Testa |
|---|---|
| Ana Souza · Aurora · A-101 · 4 pães | entrega simples: scan → foto |
| Bruno Lima · Aurora · A-202 · 6 pães + Cestinha | pão e Cestinha na mesma parada |
| Carla Dias · Aurora · B-103 · só Cestinha | QR é o id da Cestinha |
| Diego Rocha · Aurora · B-204 · 3 pães | ✨ 1ª entrega (app e cupom) |
| Elisa Melo · Aurora · A-303 · 4 pães + gancho | 🪝 "Deixou o gancho também?" (Sim / Ficou para outro dia) |
| Fábio Nunes · Bela Vista · 11 · 2 pães | recado com o cliente que desligou os recados |
| Gabi Torres · Bela Vista · 22 · 5 pães | cliente que já tem gancho (selo) |
| Hugo Reis · Bela Vista · 33 · 4 pães | "Não consegui entregar" (motivo + foto da porta) |
| **Sua conta** (joaopatrick27) · Curumim · 1 ou A-102 · 4 pães | lado do cliente: "Saiu para entrega", entregador, foto, recados |
| Folha: "Cupom de OUTRO entregador" | "Não é da sua rota" |
| Folha: "QR que não é cupom" | "Não achamos esse cupom" |

O "Residencial Aurora" já tem as **dicas de acesso** (portaria, porteiro, portão, onde parar);
o "Bela Vista" não tem ("Nenhuma dica ainda · Sugerir").

**Rodar no celular** (API e web locais, banco de teste):
1. `cd apps/api && npm run dev` e, em outro terminal, `cd apps/web && npm run dev`.
2. **Android:** cabo USB, `chrome://inspect` no computador › *Port forwarding* `5173` →
   `localhost:5173`, e abrir `http://localhost:5173` no Chrome do celular (localhost libera a câmera).
   **iPhone:** túnel HTTPS — `ngrok http 5173` (ou `cloudflared tunnel --url http://localhost:5173`) e
   abrir o endereço `https://…` no Safari. As chamadas vão pelo proxy `/api` do Vite.
3. Abrir a folha de QR no computador e escanear da tela.

**Roteiro sugerido com esses dados:**
1. **Admin › Separação** (turno da manhã): 3 prédios, o ✨ do Diego, ver/imprimir os cupons, separar e
   concluir.
2. **Admin › Entregas:** a divisão sugere tudo para o Joao Patrick → **Aprovar**.
3. **App do entregador:** o **termo** bloqueia → aceitar; o cartão **Turno oferecido** → Aceitar. (Para
   testar a recusa: Recusar → o admin recebe "Turno recusado" e vê as paradas voltarem → aprovar de
   novo.)
4. **Iniciar rota** (pela base ou GPS) → a sua conta de cliente recebe "Saiu para entrega".
5. **Escanear** cada parada da tabela (foto em cada uma; Hugo pela lista com "Não consegui entregar";
   recado para o Fábio e para a sua conta); repetir um cupom já confirmado → "Já confirmada"; os dois QR
   especiais; **digitar** um código de 6 e um de 4 caracteres.
6. **Modo avião** em 1–2 paradas → faixa "guardadas" → voltar o sinal → sobem.
7. **Encerrar rota** → resumo; conferir A1 (foto/comprovante), A2 (mapa e cards), A10 e o **crachá**
   (QR mudando a cada 30 s), Perfil › Termo, Meus números e Meus ganhos.
8. **Cliente** (sua conta): acompanhamento, card do entregador, foto da entrega, recado.
9. Terminar com `npm run seed:courier-test -- --clean`.

### 2.3 Banco de produção (MongoDB Atlas)
- [ ] **Snapshot/backup** do cluster de produção antes do deploy.
- [ ] Saber o que muda: só **acréscimos** (campos opcionais em `User` — inclusive o
      `badgeSecret` do crachá v3, Onda 11 —, `Order`, `MarketOrder`, `Condominium`, `HookRequest`,
      `CourierRouteTemplate.acceptLog`; 11 coleções novas — inclusive `LegalAcceptance` e
      `CourierShiftOffer` do termo e `DefaultRoute` da rota padrão, com o índice único `key` —; 8 tipos
      novos de notificação, com `ADMIN_SHIFT_DECLINED`). Nada é removido.
- [ ] O `prisma db push` **roda sozinho** no deploy do backend (playbook do Ansible, depois do
      `up -d`, **sem** `--accept-data-loss`). Não precisa rodar à mão.
- [ ] Os índices únicos **parciais** (`User.badgeNumber_1`, `CourierReport.clientOpId_1`) são
      criados pelo `ensure-indexes` no boot da API.

### 2.4 Armazenamento das fotos (S3)

O app usa o **AWS S3** (`lib/storage.ts`). Pastas **públicas**: `products/`, `banners/`,
`receipts/`, `couriers/` (foto do entregador) e `condos/` (entrada do prédio, A6). Pastas
**privadas** (só por URL assinada de 10 min): `deliveries/` (foto da entrega) e `reports/` (foto da
ocorrência, E12). Nos comandos abaixo, troque `BUCKET` pelo valor do secret `S3_BUCKET_PROD`.

- [ ] **Secrets no GitHub:** `S3_REGION_PROD`, `S3_BUCKET_PROD`, `S3_ACCESS_KEY_ID_PROD` e
      `S3_SECRET_ACCESS_KEY_PROD` (`S3_PUBLIC_BASE_URL_PROD` é opcional). Eles entram no `.env` da
      imagem. Sem eles, a foto não sobe (503) e o app segue "sem foto" (R-1).
- [ ] **Regra de ciclo de vida: 90 dias para `deliveries/` e `reports/`** (R-2, V-79). O app já
      trata como expirada depois de 90 dias; a regra é o que apaga de fato.
      1. Ver se já existe regra: `aws s3api get-bucket-lifecycle-configuration --bucket BUCKET`.
         O `put` abaixo **substitui** todas as regras: se já houver alguma, junte as duas no JSON.
      2. Ver se o versionamento está ligado: `aws s3api get-bucket-versioning --bucket BUCKET`.
         Se estiver `Enabled`, inclua em cada regra `"NoncurrentVersionExpiration": {"NoncurrentDays": 1}`.
         Sem isso, a versão antiga fica guardada.
      3. Salvar como `lifecycle.json` e aplicar com
         `aws s3api put-bucket-lifecycle-configuration --bucket BUCKET --lifecycle-configuration file://lifecycle.json`:
         ```json
         {
           "Rules": [
             { "ID": "fotos-entrega-90d", "Filter": { "Prefix": "deliveries/" }, "Status": "Enabled", "Expiration": { "Days": 90 } },
             { "ID": "fotos-ocorrencia-90d", "Filter": { "Prefix": "reports/" }, "Status": "Enabled", "Expiration": { "Days": 90 } }
           ]
         }
         ```
         Pelo console: S3 › bucket › **Management** › **Lifecycle rules** › *Create*, uma regra por
         prefixo, "Expire current versions of objects" = 90 dias.
      4. Conferir: o `get-bucket-lifecycle-configuration` mostra as 2 regras.
- [ ] **Política do bucket: leitura pública só nas pastas públicas** (R-2b). **Nunca** em
      `deliveries/*` nem em `reports/*`.
      1. Ver a atual: `aws s3api get-bucket-policy --bucket BUCKET --query Policy --output text`.
      2. Se ela libera `arn:aws:s3:::BUCKET/*` (o bucket inteiro), trocar o `Resource` por esta lista.
         Mantenha os outros statements que existirem:
         ```json
         {
           "Version": "2012-10-17",
           "Statement": [
             {
               "Sid": "LeituraPublicaSoPastasPublicas",
               "Effect": "Allow",
               "Principal": "*",
               "Action": "s3:GetObject",
               "Resource": [
                 "arn:aws:s3:::BUCKET/products/*",
                 "arn:aws:s3:::BUCKET/banners/*",
                 "arn:aws:s3:::BUCKET/receipts/*",
                 "arn:aws:s3:::BUCKET/couriers/*",
                 "arn:aws:s3:::BUCKET/condos/*"
               ]
             }
           ]
         }
         ```
         Aplicar com `aws s3api put-bucket-policy --bucket BUCKET --policy file://policy.json`.
      3. **`couriers/` e `condos/` são novas:** se a política atual já lista prefixos (e não `/*`),
         inclua as duas. Sem elas, a foto do entregador e a da entrada do prédio não abrem.
      4. **Se houver CDN** (o `S3_PUBLIC_BASE_URL_PROD` aponta para um CloudFront, por exemplo): a
         permissão do CloudFront no bucket **também** não pode cobrir `deliveries/*` nem
         `reports/*`. Use os mesmos prefixos acima.
- [ ] **Permissão da chave (IAM)** usada pela API: além do que já tem para as pastas públicas,
      `s3:PutObject` e `s3:GetObject` nas privadas. A URL assinada usa a mesma chave:
      ```json
      { "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject"], "Resource": ["arn:aws:s3:::BUCKET/deliveries/*", "arn:aws:s3:::BUCKET/reports/*", "arn:aws:s3:::BUCKET/couriers/*", "arn:aws:s3:::BUCKET/condos/*"] }
      ```

### 2.5 Variáveis do front (WhatsApp)
- [ ] Secret **`SUPPORT_WHATSAPP_PROD`** com o número real, só dígitos, com DDI e DDD (ex.:
      `5511987654321`). É o "Fale com o suporte" da foto do cliente e o "Falar com a operação" do
      entregador (H-4), além do suporte que já existia no Perfil e no Gancho. Sem ele, o link vai para
      o número de exemplo `5599999999999`.
- [ ] O número entra **no build** do front (variável `VITE_`): o secret precisa existir **antes** do
      deploy do frontend. Se for criado depois, é preciso rodar o deploy do front de novo.

### 2.5b Rotas (OSRM e mapas): nada a criar
- [ ] `OSRM_URL` **não precisa** existir: sem ela, a API usa o OSRM público
      (`router.project-osrm.org`, D-8). Só criar o secret (e a linha no `mainBackend.yml`) se um dia
      subirmos um OSRM próprio.
- [ ] A busca do endereço da base (A5) usa o Nominatim público pelo servidor (com User-Agent): uso
      baixo, só quando o admin digita.
- [ ] O container da API precisa **sair para a internet** por HTTPS (OSRM e Nominatim). Já sai hoje
      para o Mercado Pago e o OneSignal, então não deve mudar nada. A conferência fica na 4.1.

### 2.5c Textos legais
- [ ] `/privacidade` e `/termos` já estão com o texto do app do entregador (Onda 9, "Atualizado em
      02/10/2026"). Eles **continuam sem revisão jurídica** (decisão de 30/09). Se o jurídico for
      revisar antes do deploy, mande as seções novas: "Foto da entrega", "Recados do entregador",
      "Se você é entregador" e as linhas novas em "Por quanto tempo" e nos Termos.

### 2.6 Combinados com a equipe
- [ ] Avisar os **entregadores**: fluxo novo (escanear → foto → próximo), foto **obrigatória por
      padrão** até o admin ajustar cada um, e que é preciso **fechar e abrir o app** depois do deploy
      para pegar a versão nova.
- [ ] Avisar também que, **sem sinal, o app guarda** as entregas e fotos e envia sozinho quando o
      sinal volta (faixa "Sem sinal — N entregas guardadas"). Com entregas guardadas, **não sair do
      app, não desinstalar o PWA e não limpar os dados do navegador** — elas ficam só no aparelho.
- [ ] Pedir que cada entregador **abra o app com sinal** no começo do dia (a rota fica guardada para
      abrir no corredor sem sinal).
- [ ] Explicar o **"Iniciar rota"**: é ele que avisa os clientes ("Saiu para entrega") e libera o
      scanner no dock. Se esquecer, a 1ª confirmação inicia sozinha. No fim, **"Encerrar rota"**
      (só libera sem pendências).
- [ ] Avisar que, com a rota iniciada, a **localização** vai para a operação (só a última posição,
      só durante a rota, **apagada ao encerrar**) e a tela fica acesa. Está escrito na Política de
      Privacidade, seção "Se você é entregador".
- [ ] Mostrar o **Perfil** (tocar na foto/nome no topo): crachá digital para a portaria (com o
      relógio ao vivo — print não vale), meus números, minha escala. **"Sair" agora fica no Perfil**
      e sempre pede confirmação.
- [ ] Combinar com as **portarias** dos condomínios o **crachá v3** (Onda 11): foto grande, selo
      "Ativo", relógio andando e o **código que muda a cada 30 s** ("0427 · K3WD") — print não muda.
      A leitura do QR pela portaria vem depois, com o perfil Portaria.
- [ ] **Termo do Entregador Parceiro:** avisar que, ao abrir o app depois do deploy, cada um precisa
      **ler e aceitar o termo** (com sinal). Explicar os pontos principais: parceria **sem vínculo de
      emprego**, sem exclusividade, e que **pode recusar qualquer turno sem penalidade** (até iniciar a
      rota). O texto fica em `/termos-entregador` e no Perfil.
- [ ] Combinar na operação: quando um entregador **recusa o turno**, chega "Turno recusado" e as
      paradas voltam para a divisão em Entregas — **redistribuir e aprovar** de novo. Recusa **não**
      pode virar cobrança, bronca ou corte de turnos (é a prova da autonomia).
- [ ] Pedir que cada entregador **abra o crachá uma vez com sinal**: é quando o celular recebe o que
      precisa para gerar o QR. Depois disso o crachá abre sem sinal.
- [ ] Explicar **"Meus ganhos"** (Perfil): a semana em andamento é **estimativa**; o valor que
      vale é o que a operação aprovar na segunda. Só **rota encerrada** conta — esquecer o
      "Encerrar rota" deixa o turno fora do cálculo.
- [ ] Combinar na operação: **toda segunda** chega "Pagamento a aprovar" (8h); aprovar em
      Gestão › Entregadores › Pagamentos lança as despesas no Financeiro.
- [ ] Mostrar aos entregadores a **operação** (Onda 8): bloco "Acesso" do prédio e "Sugerir
      correção"; "Reportar problema" nas Realizadas (a entrega não é desfeita); "Falar com a
      operação" no Perfil (WhatsApp + ocorrência com foto); a pergunta "🪝 Deixou o gancho também?";
      e o **recado** (só para quem o admin liberar no A3).
- [ ] Combinar na operação quem olha **Gestão › Entregadores › Problemas e ocorrências** (o selo do
      card soma pagamentos e reportes em aberto) e quando usar "Marcar não entregue" (só corrige o
      status: sem aviso ao cliente e sem devolver pãezins — o estorno é à parte).
- [ ] Clientes não precisam fazer nada.

### 2.7 Padrões que valem até o admin configurar
| Configuração | Padrão | Onde muda |
|---|---|---|
| Foto obrigatória na entrega / na não entrega | **sim / sim** (todos os entregadores) | Cadastro do entregador (A3, Onda 6) |
| Entregador pode reordenar a rota / mandar recados | não / não | A3 (Onda 6) |
| Cliente vê a foto | **sim** | Rotas e comprovante (A5, Onda 5) |
| Volta à base · minutos por porta | sim · 1 min | A5 |
| Base de saída · preço da gasolina/etanol | **vazios** (sem estimativa de combustível) | A5 |
| Escala do entregador | **novo:** seg a sáb, todos os turnos · **já cadastrado:** todos os dias (ninguém some da divisão) | A3 › Disponibilidade |
| Validade do crachá | **novo:** 31/12 do ano · **já cadastrado:** sem validade (fica ativo) | A3 › Dados |
| Nº do crachá | gerado no boot para quem não tem (do mais antigo ao mais novo) | automático |
| Pagamento do entregador | **já cadastrado:** sem modalidade, combustível pago (a proposta sai só com o combustível) | A3 › Pagamento |
| Entregador vê km/combustível em **Meus números** · no **Fim da rota** | **não · não** | A5 › O que o entregador vê (Onda 10) |
| Entregador vê a **conta do combustível em Meus ganhos** | **não** (só o valor, V-91) | A5 › O que o entregador vê |
| Início das propostas de pagamento | a semana anterior à **1ª abertura** de Pagamentos (semanas mais antigas nunca são geradas) | automático (`Setting.courierPayoutsSince`) |

---

## 3. Deploy

1. [ ] **Backend primeiro.** A API nova continua aceitando o app antigo (confirmação sem corpo,
       não entrega só com `reason`), então o front pode vir depois.
2. [ ] No GitHub Actions, acompanhar: testes → release → build da imagem → deploy → **"Sincronizar
       schema do Prisma"** verde.
3. [ ] **Frontend** em seguida (mesmo acompanhamento, sem o passo do schema).

---

## 4. Depois do deploy

### 4.1 Conferências técnicas (primeiros 15 min)
- [ ] Log da API no boot: `ensure-indexes` "garantidos" e sem erro no seed das configurações de rota.
- [ ] Atlas: coleções novas (`DeliveryProof`, `CourierRun`, …) e índices criados.
- [ ] Admin → Rotas e comprovante (A5): **sem** o aviso "Armazenamento de fotos não configurado".
- [ ] Abrir o PWA no celular, fechar e abrir de novo: a versão nova aparece (o service worker
      atualizou).
- [ ] iPhone: a primeira leitura de QR funciona (o leitor `.wasm` é baixado ao abrir a tela do
      entregador).
- [ ] Na primeira abertura de cada entregador (ou na 1ª divisão aprovada), chega ao admin uma
      **"Sugestão de rota"** por entregador/turno — é esperado (ainda não há rota salva).
- [ ] Log do 1º boot: `[boot] nº do crachá gerado para entregadores sem número` com `numbered` =
      nº de entregadores. No 2º boot, a linha **não** aparece (idempotente). Se aparecer
      `falha ao numerar crachás`, ver o índice `User.badgeNumber_1`.
- [ ] A3: os entregadores antigos aparecem com Nº (0001, 0002, …) e sem validade.
- [ ] Abrir **Gestão** uma vez: o selo/atalho de Pagamentos grava o início das propostas (no Atlas,
      `Setting` `courierPayoutsSince` = segunda da semana anterior). Se a semana anterior ao deploy
      já foi paga por fora, **descartar** as propostas dela com o motivo "pago antes do sistema".
- [ ] Na 1ª segunda-feira, às 8h: log `[cron] courierPayouts — aviso de N proposta(s) a aprovar` e
      a notificação "Pagamento a aprovar" no admin (só se houver proposta aberta).
- [ ] Na 1ª meia-noite: log `[cron] clearStaleCourierPositions concluído` com `cleared` (posições de
      rotas de dias anteriores apagadas; nas noites seguintes, só as rotas que ficaram sem encerrar).
- [ ] **OSRM a partir da VPS:** no A4 (rota de um entregador), o traçado aparece no mapa, e não o aviso
      "só pontos". Se aparecer o aviso, ver a saída HTTPS do container (2.5b).
- [ ] **WhatsApp:** Perfil do entregador › "Falar com a operação" abre o WhatsApp com o **número
      real**, e não `5599999999999`.
- [ ] `/privacidade` mostra "Atualizado em 02/10/2026" e as seções novas.
- [ ] `/termos-entregador` abre (versão 1.0) e o A3 mostra "termo pendente" para todos até aceitarem.

### 4.2 Configuração inicial no admin
- [ ] **A5 Rotas e comprovante:** base de saída, preços dos combustíveis (gasolina e etanol por
      litro, **GNV por m³**), "Cliente vê a foto" e **"O que o entregador vê"** (os 3 switches de km e
      combustível).
- [ ] **A3 Entregadores** (cada um): foto, veículo e consumo (carro com GNV: combustível **GNV** e
      consumo em km/m³), foto obrigatória (entrega e não
      entrega), reordenar, recados, **modalidade e valor do pagamento** e se paga combustível
      (antes da 1ª segunda — sem isso a proposta sai só com o combustível), **validade do crachá**
      (os antigos ficam sem validade até preencher).
- [ ] **Escala** (dias e turnos) de cada um e as **folgas** já combinadas — a divisão de entregas
      passa a respeitar.
- [ ] **A6 Acesso do condomínio** dos prédios principais.
- [ ] **Rota padrão** (A5 › Rota padrão), **antes da 1ª divisão**: conferir antes os prédios "fora do
      mapa" e "aproximado" em Condomínios; depois abrir a tela, conferir a sugestão para todos os
      condomínios e **Usar** (ou editar e salvar). Ela vira a rota de todo entregador sem rota própria,
      sem aprovar rota por rota ([plano-rota-padrao](./plano-rota-padrao.md)).
- [ ] **A4** (Entregas › card da rota, ou Gestão › Entregadores › botão de rota): só para quem precisa
      de ordem própria (Ajustar). Sem rota padrão salva, aceitar ou ajustar a primeira sugestão de cada
      entregador/turno.

### 4.3 Privacidade (obrigatório)
- [ ] Abrir direto no navegador a URL pública de um objeto `deliveries/…` → **acesso negado**. Monte a
      URL com a chave do Atlas (`DeliveryProof.photoKey`):
      `https://BUCKET.s3.REGIAO.amazonaws.com/deliveries/<uuid>.jpg`, ou com o `S3_PUBLIC_BASE_URL`.
- [ ] O mesmo para um objeto `reports/…` (`CourierReport.photoUrl` guarda a chave) → **acesso negado**.
- [ ] Um objeto de `products/` continua abrindo (a política não fechou demais), e a foto do
      entregador (`couriers/`) aparece no A3.
- [ ] A URL assinada da foto para de abrir depois de ~10 min.
- [ ] Logado como **outro cliente**, `GET /orders/<id de outro cliente>/proof` → 404.
- [ ] Encerrar uma rota de teste → no Atlas, o `CourierRun` fica sem `lastLat`/`lastLng`/`startLat`
      (nulos) e o card do A2 não mostra mais "posição há N min".

### 4.4 Teste em produção com contas de teste
- [ ] Um entregador de teste e um cliente de teste num condomínio de teste. Rodar o essencial da
      §5 (scan + foto, não entrega, modo avião, iniciar/encerrar rota, cliente vê a foto).
- [ ] Limpar os dados de teste depois (pedidos, despesas de pagamento de teste).

### 4.5 Primeira semana
- [ ] Paradas "sem foto" e "foto não chegou" no A1/A2: se aparecerem muito, ver sinal/aparelho.
- [ ] Faixa "Sem sinal" e envios que ficam guardados por muito tempo.
- [ ] Avisos "Saiu para entrega" e "Seu pãozin chegou" chegando uma vez por parada.
- [ ] Mapa ao vivo: entregadores com "última posição há N min" frequente → iPhone com a tela
      bloqueada (R-4) ou sem sinal.
- [ ] Sugestões de rota novas: aparecem só quando entra prédio novo; se aparecerem todo dia, ver.
- [ ] Rotas sem mapa (OSRM público fora): a lista continua funcionando (R-5).

---

## 5. Roteiro de testes manuais

Marque em cada aparelho: **iPhone Safari · iPhone PWA · Android Chrome · Android PWA**.

### Onda 0 — correções
- [ ] Dia com manhã **e** tarde: a aba Rota tem o seletor de turno e o mapa mostra só o turno.
- [ ] Editar um condomínio sem mudar o endereço: as coordenadas não mudam.
- [ ] Cliente com pedido não entregue: "Não entregue" em vermelho no acompanhamento e no histórico.
- [ ] Admin › Entregadores: desligar um entregador com a rede falhando → o botão volta.

### Onda 1 — fundação
- [ ] Admin › Notificações: os 5 avisos novos aparecem com o selo "novo" e ligados.

### Onda 2 — câmera e iPhone
- [ ] Escanear 3 cupons seguidos sem fechar a câmera (pop-up com contagem de 3 s em cada).
- [ ] Lanterna no corredor escuro (quando o aparelho tem).
- [ ] Digitar código de 6 caracteres e de 4 (cupom antigo).
- [ ] Escanear de novo um cupom já confirmado → "Já confirmada às HH:MM".
- [ ] Cupom de outra rota → "Não é da sua rota"; QR qualquer → "Não achamos esse cupom".
- [ ] Câmera bloqueada nas configurações → passos para liberar + "Digitar código".
- [ ] Entrega nova atribuída com o app aberto → faixa "1 entrega nova" → Atualizar.
- [ ] Puxar a lista para baixo atualiza.

### Onda 3 — comprovante e não entrega
- [ ] Entregador com foto **obrigatória**: depois do scan vem a foto; não há "Pular"; "Não consigo
      tirar a foto" pede o motivo; o A1 mostra "sem foto" com o motivo.
- [ ] Entregador com foto **opcional**: aparece "Pular"; o A1 mostra "foto pulada".
- [ ] Prévia: "Tirar outra" e "Usar foto".
- [ ] Câmera bloqueada no modo foto → "Usar a câmera do celular" funciona.
- [ ] Pela lista: tocar na parada → sheet grande → Confirmar → pop-up claro → foto.
- [ ] "Não consegui entregar": cada motivo; "Outro" sem texto não deixa enviar; depois vem a foto
      da porta/portaria.
- [ ] A1 (detalhe do pedido no admin): foto, tela cheia, "Baixar", não entrega com foto e motivo.
- [ ] Cliente: "Tentamos entregar às HH:MM — motivo", bloco Comprovante, tela cheia com "Fale com
      o suporte", câmera no histórico, aviso "Ver foto" abrindo a foto.
- [ ] "Cliente vê a foto" desligado no A5 → o cliente não vê nada de foto.

### Onda 4 — fila offline
- [ ] **Modo avião:** confirmar 2 por scan + 1 não entrega, todas com foto → pop-up "Confirmada · sem
      sinal" e "Guardado · seguir para a foto"; faixa "Sem sinal — 3 entregas guardadas"; selos
      "pendente de envio"; contador do dock conta as 3.
- [ ] Tirar do modo avião → "Enviando 3…" → a faixa some sozinha. No A1, as fotos aparecem e o
      horário é o **da entrega**, não o do envio.
- [ ] Com entregas guardadas, **fechar o app de vez** (tirar da memória) e abrir de novo ainda sem
      sinal → a rota guardada aparece com as entregas resolvidas e a faixa; com sinal, sobem.
- [ ] Abrir o app sem sinal **sem** ter aberto com sinal no dia → aviso "Abra o app com sinal uma vez…".
- [ ] Sinal fraco (corredor/elevador): a confirmação espera no máximo ~8 s e vai para a fila.
- [ ] Escanear de novo um cupom já guardado → "Já confirmada" (não guarda duas vezes).
- [ ] Com entrega guardada, o admin marca a parada como não entregue → quando o sinal volta, o
      entregador vê "Uma entrega guardada já tinha sido resolvida pela operação".
- [ ] "Sair" com entrega guardada → "Sair do app?" com o aviso; "Esperar o envio" fica; "Sair mesmo
      assim" sai. Sem nada guardado, sai direto.
- [ ] Dois entregadores no mesmo celular: o que ficou guardado de um não sobe com o outro logado.

### Onda 5 — rota
- [ ] **A5:** buscar e escolher o endereço da base, arrastar o pino, salvar; preços com vírgula;
      desligar "Cliente vê a foto" e conferir que o cliente não vê mais.
- [ ] **A4:** primeira sugestão aparece; "Usar sugestão"; depois um prédio novo no dia → aviso
      "Sugestão de rota" → "Manter a atual" e "Ajustar" (arrastar e ver o km mudar ao soltar).
- [ ] **E1/E8:** rota pronta mostra "Iniciar rota" no dock; iniciar pela base e por GPS
      (permitir e negar a localização); toast "Rota iniciada · N clientes avisados".
- [ ] **Cliente:** antes de iniciar, "Saiu" apagado; depois, push "Saiu para entrega", "{Nome} está a
      caminho", "a caminho desde HH:MM" e o card do entregador.
- [ ] **E9:** próxima parada com hora prevista; Navegar com Google Maps, Waze e (iPhone) Apple Maps,
      escolha lembrada e "trocar"; voltar ao app e ver "Você chegou" a ~80 m do prédio.
- [ ] Reordenar no dia: liberado e não liberado; "Voltar à rota padrão"; A4 mostra a alteração e
      "Adotar como rota padrão".
- [ ] Sem traçado (OSRM fora): aviso e os pontos na ordem; prédio sem coordenada com "sem mapa".
- [ ] **A2:** mapa ao vivo com a posição (e esmaecida após 10 min sem sinal), cards por rota,
      filtros Pendentes / Sem foto.
- [ ] **E10:** encerrar com pendência (bloqueia; "Tirar foto" e "Tentar agora" funcionam) e sem
      pendência (tela "Rota concluída" + combustível estimado; sem consumo cadastrado, o aviso).
- [ ] Esquecer o "Iniciar" e confirmar pela lista: a rota inicia sozinha e o cliente é avisado.
- [ ] Tela acesa durante a rota: não apaga em 5 min parada (Android; iPhone depende da versão).

### Onda 6 — pessoas
- [ ] **A3 cadastro novo:** validade já vem 31/12, seg a sáb marcados, "Salve o cadastro para
      marcar folgas"; modalidade sem valor não salva; CPF inválido recusado.
- [ ] **A3 foto:** câmera (celular) e galeria, recorte redondo, "Usar esta foto"; aparece na lista,
      no crachá e para o cliente quando o pão sai. Sem S3, a mensagem de armazenamento.
- [ ] **A3 edição:** CPF travado, Nº do crachá; trocar veículo (bicicleta/a pé escondem combustível;
      tocar de novo limpa); regras e pagamento salvam; abrir a rota do turno pela seção 6.
- [ ] **Folgas:** marcar uma folga num dia com rota já aprovada → aviso "A folga de DD/MM cai numa
      rota já aprovada (turno · N paradas)"; remover a folga.
- [ ] **Divisão de entregas:** quem está de folga (ou fora da escala/turno) não recebe na sugestão
      e aparece com "de folga" / "fora da escala"; atribuir à mão ainda funciona.
- [ ] **Lista de entregadores:** "de folga hoje" e "sugestão de rota nova".
- [ ] **E1 topo:** foto + primeiro nome abre o Perfil; botão **Crachá**; o "Sair" do topo sumiu.
- [ ] **E14 Perfil:** dados, veículo, app de mapas (escolher e ver na próxima navegação),
      notificações, Trocar senha, Falar com a operação (WhatsApp), **Sair** (sem pendência:
      Sair/Cancelar; com entrega guardada: o aviso da Onda 4).
- [ ] **E15 Crachá:** o design mudou na Onda 11 — ver o roteiro da Onda 11 abaixo.
- [ ] **E17 Meus números:** **sem** "Km estimado" e "Combustível estimado" no padrão (o admin liga no
      A5, Onda 10); 7 e 30 dias batem com o que foi entregue; entregador novo vê "Seus
      números começam na primeira rota" com o próximo turno.
- [ ] **E18 Minha escala:** semana com turnos e folgas, legenda, próximas folgas (com motivo).
- [ ] **E1 sem entregas:** em dia de folga → "Hoje é sua folga 🌿" com a semana e o próximo turno;
      dia normal sem pedidos → "Nenhuma entrega hoje"; "Ver minha escala".

### Onda 7 — pagamentos e combustível
- [ ] **Preparar:** 3 entregadores de teste — por entrega (moto, consumo), por rota (carro,
      "Pagar combustível" desligado), semanal fixo — e preços dos combustíveis no A5. Fazer
      entregas e **encerrar** rotas numa semana; deixar 1 rota iniciada sem encerrar.
- [ ] **E13 Meus ganhos** (cada entregador): modalidade, "a receber (estimado)", a conta do
      combustível (ou o motivo: sem consumo, não paga, bicicleta), aviso da rota não encerrada.
      Sem modalidade: "Forma de pagamento não definida" + combustível.
- [ ] **A8 na semana em andamento:** só estimativa, sem botões; "Próxima semana" travada.
- [ ] **A8 na semana fechada** (na segunda, ou mudando a data do teste): uma proposta por
      entregador; abrir de novo **não duplica**; "1 rota não foi encerrada" aparece.
- [ ] **Editar** (valor final + motivo) → "editada", estimado riscado → final.
- [ ] **Aprovar "pago agora"** (data + Pix) → em Financeiro › Despesas aparecem **2 despesas**
      ("Entregador" e "Combustível"), pagas, competência = mês do domingo da semana, favorecido =
      entregador. "Meus ganhos" mostra "pago DD/MM".
- [ ] **Aprovar "a pagar"** (vencimento) → 2 despesas em Contas a pagar; marcar como paga lá →
      o histórico do A8 e o extrato do entregador viram "pago".
- [ ] **Descartar** (motivo obrigatório) → nenhuma despesa; some do selo.
- [ ] **Mês fechado:** fechar o mês no Financeiro e tentar aprovar → mensagem para reabrir, nada
      lançado.
- [ ] Selo do card **Entregadores** no hub e o atalho "N propostas a aprovar"; entrada em
      Financeiro › Caixa e obrigações.
- [ ] **A9 Combustível & rotas:** 7/30 dias, Mês, Período; KPIs batem com as rotas encerradas;
      entregador sem consumo aparece no aviso; exportar; "Ir para pagamentos".
- [ ] **Economia das rotas:** com rota salva, um prédio novo gera sugestão → "Usar sugestão" →
      depois de turnos encerrados, o A9 mostra "−N km rotas sugeridas".

### Onda 8 — operação e comunicação
- [ ] **A6 Acesso:** Gestão › Condomínios › editar › aba **Acesso**: portaria, tem porteiro, portão,
      onde parar, observações e foto da entrada; salvar. No app, o prédio mostra o bloco "Acesso"
      (foto abre em tela cheia). Condomínio sem nada: "Nenhuma dica ainda · Sugerir".
- [ ] **E7 Sugerir correção** (com sinal) → aviso "Sugestão de acesso" ao admin → selo na lista de
      Condomínios → **Aplicar** troca o campo (Outro soma às observações) / **Descartar**.
- [ ] **E7 Navegar até aqui** no prédio (usa o app de mapas escolhido).
- [ ] **E16 Recado** (A3: liga "Pode mandar recados"): o botão de chat aparece nas paradas
      pendentes e em "Avisar o cliente" da não entrega; o cliente recebe "Antônio: Estou na portaria
      🥖"; o mesmo recado no mesmo dia → aviso "já foi enviado hoje"; sem a permissão, o botão some.
- [ ] **C3 Recados desligados:** o cliente desliga em Perfil › Notificações › "Recados do
      entregador" → no app, o recado mostra "Fulana desligou os recados".
- [ ] Recado **sem sinal** (modo avião) → "O recado sai assim que o sinal voltar" → sai sozinho.
- [ ] **E11 Reportar problema** nas Realizadas → aviso "Problema reportado" ao admin → no detalhe do
      pedido (A1) e em **Problemas e ocorrências**: **Marcar não entregue** (status corrigido, sem
      push ao cliente, sem crédito) e **Manter entregue**.
- [ ] **E12 Ocorrência** (Perfil › Falar com a operação) com e sem foto, e sem sinal (guardada) →
      aviso "Ocorrência do entregador"; a foto abre no admin (link assinado) → "Marcar como
      resolvida".
- [ ] **A7 Gancho na rota:** Solicitação de Gancho › **Enviar na rota** (só dias com entrega do
      cliente; mostra o entregador) → aprovar a divisão do dia → no app, a parada mostra "+ entregar
      gancho" e, ao confirmar, "🪝 Deixou o gancho também?": **Sim** (gancho entregue, push "Seu
      gancho chegou!", "Entregue por …" no admin) e **Ficou para outro dia** (volta para a fila,
      "Não entregue na rota"). Não entrega da parada também devolve o gancho. "Tirar da rota".
- [ ] **Gancho sozinho na rota** ([plano](./plano-gancho-sozinho-na-rota.md)): o `db push` do deploy
      cria o índice `DeliveryProof.hookRequestId` e o campo `HookRequest.routeFailedReason`.
      - [ ] Card da fila: em 360 px os botões não quebram; tocar no card abre o cliente, e os botões
            não abrem.
      - [ ] **Enviar na rota** mostra hoje e os próximos 6 dias, com "🥖 Vai junto com o pão" ou
            "🪝 Só o gancho". Num dia sem pão, escolher **Quem leva** (já vem com a sugestão) e enviar.
            O card mostra "Na rota de … · só o gancho".
      - [ ] No app do entregador, a parada mostra "🪝 Só gancho". Confirmar com **Gancho entregue**
            (foto conforme a regra dele): o cliente recebe "Seu gancho chegou!".
      - [ ] **Não consegui entregar** devolve o gancho para a fila, e o card mostra o motivo.
      - [ ] Turno só com gancho: inicia, encerra e o resumo mostra "Ganchos 1"; a parada conta em
            Meus ganhos (por entrega).
- [ ] **A10** Entregas & falhas: motivos padronizados com % e "N entregas sem foto · M 'local sem
      luz'"; os três avisos novos chegam e podem ser desligados em Notificações.

### Onda 9 — fechamento
- [ ] **`/privacidade`:** "Atualizado em 02/10/2026"; seções **Foto da entrega** (privada, 90 dias),
      **Recados do entregador** (modelos prontos, desligar em Perfil › Notificações, telefone não
      aparece) e **Se você é entregador** (localização só durante a rota, só a última posição,
      apagada ao encerrar); "Por quanto tempo" com a linha das fotos e da localização.
- [ ] **`/termos`:** em "Pedidos e pãezins", a linha da foto da entrega.
- [ ] **Posição apagada ao encerrar:** com a rota iniciada, o A2 mostra o entregador no mapa e
      "posição há N min"; depois de **Encerrar rota**, o card fica "encerrada" sem a posição.
- [ ] **Rota esquecida aberta:** iniciar e não encerrar; no dia seguinte, depois da meia-noite, a
      posição some (Atlas, ou o log da 4.1).
- [ ] **Foto da ocorrência com mais de 90 dias** (no banco de teste, mudar o `createdAt` de um
      `CourierReport` com foto para 91 dias atrás): em Problemas e ocorrências aparece **"foto
      expirada (90 dias)"**, sem miniatura.
- [ ] **Telas do Perfil (V-85):** em celular de tela baixa, Perfil, Crachá, Ganhos, Números, Escala e
      Operação rolam inteiras, e nenhum cartão aparece cortado (o do topo do Perfil, principalmente).
- [ ] UAT completo em aparelho real (2.2): a §5 inteira, nos quatro modos.

### Onda 10 — o que o entregador vê de km e combustível
- [ ] **A5 › O que o entregador vê:** abre com os **três desligados**; mudar, salvar, reabrir e ver
      gravado.
- [ ] **Padrão (tudo como veio):** Meus números sem "Km estimado"/"Combustível estimado"; Encerrar rota
      sem cartão nem aviso de combustível; Rota concluída com **"1h28 · na rua"** no lugar do km; Meus
      ganhos com "Combustível estimado ≈ R$ X" **sem** a conta; Perfil › Meu veículo sem "Usado no
      combustível estimado".
- [ ] **Meus números ligado:** os dois cartões aparecem (7 e 30 dias).
- [ ] **Fim da rota ligado:** o cartão "~9,6 km · ≈ R$ 1,54" (ou o aviso "sem consumo/preço") e o
      "~9,6 km · estimado" na rota concluída.
- [ ] **Meus ganhos ligado:** a conta (km ÷ km/l × preço) e os avisos "sem consumo"/"sem preço"
      aparecem; o total é o mesmo de desligado; o Perfil volta a dizer "Usado no combustível estimado".
- [ ] **Meus ganhos desligado:** "não paga combustível" continua aparecendo para quem não recebe.
- [ ] **O admin continua vendo tudo:** A2, A4, A8 (pagamentos) e A9 (Combustível & rotas) iguais; a
      distância "~9,2 km" na rota do entregador continua.

### Onda 11 — crachá v3 e GNV
- [ ] **Crachá ativo (frente):** cordão dourado, presilha e o cartão que **balança ao abrir**; foto
      grande com o selo "Ativo" (ponto que respira) e a marca no canto; nome, "Entregador parceiro ·
      desde mar/2026 · válido até 31/12/2026", CPF mascarado e veículo; relógio no topo com os
      segundos andando; rodapé com o QR, "0427 · XXXX" e "novo código em N s".
- [ ] **O código muda a cada 30 s** (a contagem chega a 1 e volta a 30 com um código novo).
- [ ] **Tocar no QR vira o crachá:** verso com o QR grande, o anel da contagem se esvaziando, "ou
      digite o código" e o código; tocar de novo volta.
- [ ] **Leitura do QR:** apontar a câmera de outro celular (app de câmera ou leitor de QR) para o QR
      grande e para o pequeno → lê um texto `cdp:b1:...`. Confere que os módulos arredondados e a
      marca no centro não atrapalham.
- [ ] **Sem sinal:** abrir o crachá uma vez com sinal; pôr em modo avião, fechar o app, abrir de novo
      e tocar em Crachá → abre com o QR mudando. Aparelho que nunca abriu com sinal → "Abra o app com
      sinal uma vez para gerar o QR".
- [ ] **Sair** do app e entrar de novo sem sinal → o crachá não abre (o Sair apaga o que estava
      guardado).
- [ ] **Sem foto:** iniciais grandes em fundo dourado + "Peça sua foto à operação".
- [ ] **Desativado** (bloquear no A3): foto em cinza, selo "Inativo", cordão apagado, "QR
      indisponível · Seu cadastro está desativado", relógio "Sem validade", "Falar com a operação".
- [ ] **Vencido** (validade no passado): selo "Vencido", "Seu crachá venceu em DD/MM/AAAA" e "A
      validade do seu crachá passou…". Reativar ou renovar → volta ao abrir com sinal.
- [ ] **Nome longo** cabe (reduz a fonte e, no limite, quebra em duas linhas); **bicicleta** mostra
      só "Bicicleta"; **sem veículo**, a coluna some.
- [ ] Tela pequena (iPhone SE): o crachá cabe ou rola, sem cortar o rodapé.
- [ ] A tela não apaga com o crachá aberto (Android; iPhone depende da versão).
- [ ] **A5:** campo **GNV · R$/m³** (salva, mostra "atualizado em" ao mudar); valor fora da faixa →
      "Preço do m³ do GNV entre R$ 0,01 e R$ 20,00."
- [ ] **A3:** "GNV" só aparece com **Carro**; ao escolher, o consumo vira **km/m³**; trocar para moto
      volta para Gasolina.
- [ ] **Entregador de carro com GNV:** encerrar uma rota → Fim da rota (com o switch ligado) mostra
      "12 km/m³ · GNV R$ 4,99"; Meus ganhos e Pagamentos mostram a conta em km/m³; Perfil mostra
      "GNV · 12 km/m³".
- [ ] **A9:** com GNV no período, o KPI vira "Litros · m³" ("~18,7 L · ~6,2 m³") e a planilha tem a
      coluna "m³ (GNV)".

### Termo do entregador e turnos ([plano-termos-legais](./plano-termos-legais.md))
- [ ] **1º acesso:** o app abre o **Termo do Entregador Parceiro** em tela cheia; "Aceitar e continuar"
      só com "Li e aceito"; aceitar libera o app. Sem sinal: "Sem sinal agora…".
- [ ] **A3:** depois do aceite, "termo v1.0 aceito em DD/MM/AAAA"; quem não aceitou, "termo pendente"
      (lista e edição); "ver o termo" abre a página pública.
- [ ] **Perfil › Termo do entregador:** mostra a versão e a data do aceite e o texto.
- [ ] **Versão nova** (no teste: mudar `LEGAL_DOCS.COURIER_TERMS.version` para 1.1): o app pede de novo
      ("O termo mudou").
- [ ] **Aprovar a divisão:** cada entregador recebe "Turno da manhã · N paradas às 06:30 · aceitar ou
      recusar"; no app, o cartão **TURNO OFERECIDO** com Aceitar / Recusar.
- [ ] **Aceitar** → "Turno da manhã aceito · Recusar". **Sem resposta** → o turno segue com ele.
- [ ] **Recusar** (com e sem motivo) → "Turno recusado. A operação foi avisada."; as paradas somem do app;
      o admin recebe "Turno recusado" e, em Entregas, vê "Fulano recusou o turno…", "N paradas já estão
      na rua…", o selo "recusou o turno" e a sugestão só das paradas que voltaram → aprovar → o novo
      entregador recebe a oferta. O gancho na rota vai junto.
- [ ] **Iniciar a rota** → o cartão some; tentar recusar depois (pela API) → 409 "A rota já começou".
- [ ] Turno aceito, **sem iniciar a rota**: confirmar a 1ª entrega → o cartão "Turno aceito · Recusar"
      some na hora ([plano-correcao-recusa-turno](./plano-correcao-recusa-turno.md)).
- [ ] O mesmo **sem sinal** (modo avião): entregar 1 parada → o cartão some; fechar e abrir o app sem
      sinal → continua sumido; voltar o sinal → a fila sobe e a entrega fica certa no admin.
- [ ] Marcar 1 parada como **não entregue** → o cartão também some.
- [ ] Dia com manhã e tarde: entregar na manhã → o cartão da tarde continua recusável.
- [ ] Sheet de recusa aberto, entregar pelo outro aparelho (ou pela API) e confirmar a recusa → toast
      "A rota já começou…", o sheet fecha e o cartão sai.
- [ ] **Sem sinal**, recusar → aviso com o WhatsApp da operação.
- [ ] **Reaprovar** sem mudar nada → não chega aviso de novo; passar todas as paradas de alguém para
      outro → a oferta dele some.

### Rota padrão ([plano-rota-padrao](./plano-rota-padrao.md))
- [ ] **A5:** a seção "Rota padrão" mostra "Sem rota padrão ainda" e o botão **Montar rota padrão**.
- [ ] **1ª vez:** a tela abre já com a **Primeira sugestão** (mapa, km, tempo, ordem); "Usar sugestão" →
      "Rota padrão salva…"; voltar → o card da A5 mostra "N prédios · ~X km · ~Y min · Salva em …".
- [ ] **Editar antes de usar:** arrastar → o km recalcula ao soltar → "Salvar rota padrão".
- [ ] **Sugerir rota** com a rota salva: abas **Atual × Sugerida** no mapa, "−X km", "subiu/desceu";
      **Descartar** não muda nada.
- [ ] **Prédio novo** (cadastrar em Condomínios, com endereço): em segundos ele aparece na rota padrão
      com "novo · encaixado"; o admin recebe "Rota padrão: … entrou na posição N (+X km)"; o card da A5
      mostra "1 para revisar"; **Está bom assim** tira o selo.
- [ ] **Mudar o endereço** de um prédio da rota → "reencaixado" + aviso. **Desativar** → sai da rota;
      **reativar** → entra de novo.
- [ ] Prédio **sem localização** aparece em "Fora do mapa" com "Corrigir em Condomínios".
- [ ] **Entregador sem rota própria:** aprovar a divisão → **não** chega "Sugestão de rota"; no app, a
      rota do dia sai na ordem da padrão, só com os prédios dele; no A4, "Segue a rota padrão".
- [ ] **A4 › Ajustar** (quem segue a padrão) → salvar → "Rota própria"; mudar a padrão depois **não**
      mexe nela. **Voltar à rota padrão** → confirmação → "volta a seguir a rota padrão".
- [ ] Entregador com rota própria + prédio novo → a "Sugestão nova" de sempre no A4 (Usar · Manter ·
      Ajustar).
- [ ] Mudar a **base** ou a **volta** na A5 e salvar → o km do card da rota padrão muda. Mexer sem
      salvar → aviso "Salve antes de mexer na rota padrão".

---

## 6. Se precisar voltar atrás

- **Schema:** só acréscimos — a versão anterior da API funciona com o banco novo. Não há o que
  desfazer no Atlas.
- **API/front:** na VPS, apontar o compose para a **tag anterior** da imagem (`backend-v…` /
  `frontend-v…`) e subir de novo, ou reverter o merge na `main` (gera release e deploy novos).
- Fotos já enviadas ficam em `deliveries/` e `reports/` e expiram sozinhas pela regra de 90 dias.
- Textos legais: voltar o `content/legal.ts` junto do front. O texto antigo não fala das fotos nem da
  localização, então só volte se o app também voltar.

---

## 7. Pendências conhecidas que afetam a operação

| # | O quê | Até quando |
|---|---|---|
| V-27 | ~~Foto só na memória (fechar o app perde a foto)~~ | ✅ Resolvida na Onda 4 (fila) |
| V-36 | Rota guardada: o que foi confirmado com sinal **depois** do último download aparece pendente até o sinal voltar (escanear de novo não faz mal) | Aceito |
| — | Entregas guardadas ficam só no aparelho: sair do app, desinstalar o PWA ou limpar os dados as perde | Aviso na tela + combinado com a equipe (2.6) |
| V-28 | S3 fora: aparelho mostra "sem foto", servidor mantém pendente | ✅ Aviso no A5 (Onda 5) |
| V-40 | Turno não iniciado: a 1ª confirmação inicia a rota e o cliente recebe "Saiu para entrega" nessa hora | Aceito (o certo é tocar em "Iniciar rota") |
| R-5 | OSRM público fora do ar: lista segue, mapa só com pontos, sugestão de rota espera | Aceito (D-8) |
| V-23 | iPhone que abre o app pela 1ª vez já sem sinal só tem "Digitar código" | Aceito |
| V-58 | Proposta usa consumo/preço atuais; o A9 usa o congelado no encerramento — diferença de centavos se o preço mudou na semana | Aceito |
| V-63 | Rota iniciada e não encerrada não entra no pagamento (aparece como aviso) | Aceito (combinado na 2.6) |
| V-74 | "Sugerir correção" do acesso precisa de sinal (não entra na fila offline) | Aceito (não é urgente) |
| V-72 | Gancho volta sozinho para a fila quando a parada termina "não entregue" | Aceito |
| V-54 | O crachá não aumenta o brilho sozinho (a web não deixa); só pede | Aceito |
| V-78 | Rota que ninguém encerra guarda a última posição até a meia-noite (a faxina apaga) | Aceito |
| — | Crachá v3: a validação pela portaria (ler o QR, estado "Validado") só vem com o perfil Portaria | Futuro (H-9) |
| V-98 | O segredo do QR fica no `localStorage` do aparelho (PWA não tem Keychain). Sem tela para trocar o segredo de um entregador | Aceito; trocar o segredo entra junto do perfil Portaria |
| V-97 | Sem sinal, o crachá mostra o status da última vez com sinal (um entregador desativado offline ainda vê "Ativo" até ter sinal) | Aceito (H-11); a validação futura confere no servidor |
| R-T1 | **Vínculo empregatício:** o termo não basta sozinho; seguem escala/folgas do admin, "semanal fixo", rota e foto impostas, cadastro sem MEI/recibo | Levar a §1 do `plano-termos-legais.md` ao advogado e reavaliar (decisão do usuário: fora desta rodada) |
| — | Termo do entregador **sem revisão jurídica** (D-T3); revisão vira versão nova com novo aceite | Pendências na §4 do plano de termos |
| — | **Próximos documentos** (Termos de Uso do cliente + aceite no cadastro, regulamento do Indique e Ganhe, Privacidade completa, confidencialidade da equipe, contratos fora do app) | Registrados para implementação futura (§3/§9 do `plano-termos-legais.md`) |
| — | Textos legais sem revisão jurídica (razão social, CNPJ, encarregado, prazo de exclusão) | Decisão de 30/09: publicar assim; revisar quando der (2.5c) |
| — | Regra de 90 dias e política do bucket são passos manuais | Antes do deploy (2.4) |
| — | UAT em aparelho real de tudo | Antes do deploy (2.2) |
| — | Rota padrão: a sugestão de entregador do gancho (passo 2) só enxerga **rota própria**; quem segue a padrão só é sugerido pela divisão aprovada | Aceito (§3.8 do `plano-rota-padrao.md`) |
| — | Rota padrão: o OSRM público calcula até **99 prédios** por vez; acima disso a sugestão diz "mapa fora do ar" | Aceito por agora (R-1 do `plano-rota-padrao.md`) |
