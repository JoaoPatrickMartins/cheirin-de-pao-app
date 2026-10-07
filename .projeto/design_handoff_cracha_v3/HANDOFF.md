# Handoff: Crachá digital v3 (Cordão) · App do Entregador · E15

Cheirin de Pão · tema claro · pt-BR · tela mobile de 390 px · 05/10/2026

## Prints (`prints/`)

| Arquivo | O que mostra |
|---|---|
| `00-visao-geral.png` | Os 5 estados lado a lado |
| `01-ativo-frente.png` | Estado padrão: frente do crachá |
| `02-qr-ampliado-verso.png` | Verso do crachá (QR grande), aberto ao tocar no QR |
| `03-validado-portaria.png` | Entrada liberada pela portaria (perfil Portaria, que ainda vai existir) |
| `04-sem-foto.png` | Entregador sem foto cadastrada |
| `05-desativado.png` | Cadastro desativado pelo admin |

Nos prints, a área cinza com "Foto do entregador" é só o espaço da foto. No app, aparece a foto que o admin cadastrou.

Referência navegável: `referencia/Crachá Digital v3.html`. Abra no navegador para ver as animações, a virada do crachá e a contagem do QR funcionando.

---

## 1. Conceito

É um crachá físico de cordão, só que na tela do celular. O entregador vira o telefone para o porteiro, e a **foto grande** aparece primeiro, porque é o que o porteiro confere. O **QR de validação** fica no rodapé e muda a cada 30 s, o que impede usar print de tela. Com ele, o futuro **perfil Portaria** dos condomínios vai poder validar a entrada.

Regras:
- A foto, o nome, o CPF e o veículo vêm do **cadastro feito pelo admin**. O entregador só visualiza.
- O CPF aparece **sempre mascarado**.
- O QR e o código curto só existem com o cadastro **ativo**.
- Sem sinal, o crachá continua funcionando, porque o QR é gerado no aparelho (ver §5).

## 2. Acesso

- Botão **"Crachá"** no cabeçalho da tela principal (E1).
- **Perfil › Meu trabalho › Crachá digital**.
- O crachá abre em tela cheia (modal). O **X** fecha.
- Ao abrir: deixar o **brilho no máximo** e a **tela sempre ligada**. Ao fechar, voltar ao brilho de antes (API nativa ou Wake Lock).

## 3. Layout (390 × 844, valores em px)

### Tela
- Fundo: `radial-gradient(110% 55% at 50% 30%, surface #FFFFFF 0%, appBg #FAF5EC 70%)`. Margens de 0 16 16.
- **Cordão:** faixa vertical centralizada, com 24 de largura e 112 de altura a partir do topo da área de conteúdo. Cor gold soft `#F3DDA6`, com bordas laterais de 1px `rgba(176,112,42,.22)`. Passa por trás do cabeçalho.
- **Cabeçalho** (56 de altura):
  - **À esquerda**, o botão fechar: 44×44, raio 14, fundo surface, borda 1,5 `#EADFCB` (border), ícone `x` 20.
  - **À direita**, a pílula do relógio: 36 de altura, raio 999, fundo surface, borda 1,5. Tem o ícone `clock` 15 em accent `#B0702A` e `HH:MM:SS` em 13,5/800 com números tabulares; **os segundos ficam em accent**.

### Presilha e cartão
- **Presilha:** 44×24, raio 9, espresso `#1E1207`, com um rasgo interno de 20×5 (raio 3) em gold `#E3AC3F`. Fica 16 acima do topo do cartão, centralizada.
- **Cartão:**
  - 326 de largura, margem superior de 14, raio 28, fundo `#FFFDF9`.
  - Borda de 1px `rgba(43,26,12,.07)`.
  - Sombra: `0 1px 2px rgba(43,26,12,.05), 0 24px 48px -22px rgba(43,26,12,.34)`.
- **Furo do cartão:** área de 32 de altura com uma pílula centralizada de 46×9, fundo appBg e sombra interna `inset 0 1px 2px rgba(43,26,12,.2)`.

### Frente
1. **Foto:**
   - 272 de altura, margem lateral de 12, raio 20, `object-fit: cover`.
   - No canto superior direito, a marca: quadrado espresso de 34 (raio 11) com o `BreadMark` gold de 19.
   - No canto inferior esquerdo, o **selo de status** em vidro: fundo `rgba(255,253,249,.94)`, `backdrop-filter: blur(8px)`, sombra `0 2px 8px -2px rgba(43,26,12,.25)`, 32 de altura, raio 999, texto 13/800.
     - **Ativo:** ponto de 8 px verde `#3E7C53` que "respira" + texto "Ativo" verde.
2. **Nome:**
   - Margens de 16 20 0.
   - Nome em Bricolage Grotesque 28/800, tracking −0,035em, altura de linha 1,05.
   - Abaixo, "Entregador parceiro · desde mar/2026" em Hanken Grotesk 13,5/600, cor text sec `#7C6A50`.
3. **Dados:**
   - Linha com espaço de 22 entre os itens e margens de 14 20 18.
   - Rótulo em 10/800, tracking 0,14em, cor text ter `#A89A82`, caixa-alta: CPF, VEÍCULO.
   - Valor em 13,5/700, números tabulares.
4. **Rodapé de validação:**
   - Borda superior de 1px `#F1E8D8` (border2), fundo surface alt `#FBF6EC`.
   - Raio de 0 0 28 28, margens de 14 16 16, altura mínima de 128.
   - **QR (botão):** 98×98, raio 18, fundo branco, borda 1px border2, com o QR de 82 dentro. Tocar **vira o crachá**.
   - À direita:
     - "Validação da portaria" em 13,5/800.
     - Código em fonte mono 17/700, tracking 0,1em: `0427 · K3WD` (o ponto separador em gold).
     - Contagem regressiva: um mostrador circular de 18 + "novo código em 13 s" em 12,5/700 text sec.
5. **Dica abaixo do cartão** (rente ao fundo da tela): ícone `repeat` 15 em accent + "Toque no QR para virar o crachá", em 12,5/600 text sec.

### Verso (QR ampliado)
É o mesmo cartão, girado 180°.
1. Furo do cartão.
2. **Linha de identificação:**
   - Iniciais em quadrado espresso de 40, raio 13, gold, Bricolage 16.
   - Nome em Bricolage 17/800.
   - "Entregador · Cheirin de Pão" em 12,5 text sec.
3. **QR grande:**
   - Anel de contagem de 248×248: retângulo arredondado com raio 30 e traço de 3. Trilho em surface 2 `#F4EBDA`; o progresso em gold **começa no centro do topo** e se esvazia em 30 s.
   - Dentro, quadro branco de 234 (raio 24, borda border2) com o QR de 202.
   - Tocar volta para a frente.
4. "ou digite o código" em 13/600 text sec.
5. **Pílula do código:**
   - Fonte mono 21/700, tracking 0,14em, margens de 9 18, raio 12.
   - Fundo surface alt, borda border2.
6. "Novo código em 19 s" em 12,5/700 text ter.
7. Dica abaixo do cartão: "Toque no QR para voltar à frente".

## 4. Estados

| Estado | O que muda |
|---|---|
| **Ativo** | Padrão (print 01) |
| **QR ampliado** | Verso (print 02) |
| **Validado pela portaria** | Selo da foto vira ✓ "Validado". O rodapé fica com fundo good soft `#DCEBDF`: check de 60 animado + "Entrada liberada" (Bricolage 20, verde) + "Portaria · Residencial Jardins / às 05:41". A dica vira o ícone `shield` + "Validado pela portaria do condomínio". Não vira. |
| **Sem foto** | A área da foto fica em gold soft `#F3DDA6` com as iniciais "AR" em Bricolage 112/800, espresso. No canto superior esquerdo, o selo de vidro com `camera` + "Peça sua foto à operação". |
| **Desativado** | A foto fica em cinza (`grayscale(1)` e opacidade 0,55). Selo com `ban` + "Inativo" em vermelho `#B23A2E`. O nome fica em text sec. O cordão fica em surface 2 e a presilha em text ter. No lugar do QR, um quadro tracejado de 96 com `lock` + "QR indisponível / Seu cadastro está desativado". O relógio mostra "Sem validade". Embaixo: "O crachá volta quando a operação reativar seu cadastro." + botão principal **"Falar com a operação"** (56 de altura, espresso, ícone `chat` gold). Não vira. |

## 5. QR de validação (especificação técnica)

- **Janela:** `w = floor(unixTime / 30)`. O QR e o código mudam juntos a cada janela.
- **Gerado no aparelho, sem precisar de rede:** no login, o servidor entrega um `badgeSecret` próprio do entregador, guardado com segurança no aparelho (Keychain/Keystore).
- **Conteúdo do QR:** `cdp:b1:{courierId}:{w}:{tag}`, onde `tag = base32(HMAC-SHA256(badgeSecret, courierId + ":" + w))[0..10]`.
- **Código curto:** `{matrícula 4 dígitos} · {4 caracteres}`. Os 4 caracteres são derivados do mesmo HMAC, num alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L).
- **Validação (perfil Portaria, futuro):** o servidor aceita a janela atual e a anterior (±30 s), confere se o entregador está `ativo` e registra a entrada. Depois, manda um push para o app do entregador, que mostra o estado **Validado**.
- **Desativado:** o servidor recusa sempre. O app não gera QR.
- O QR é **de alto contraste** (espresso sobre branco), com correção de erro **H**, porque o centro leva a marca em ~20% da área.
- O desenho dos módulos (cantos arredondados) é estético. Use uma biblioteca de QR que permita estilizar os módulos mantendo a leitura (ex.: qr-code-styling).

## 6. Animações

Todas devem ser desligadas com `prefers-reduced-motion: reduce`.

| Elemento | Animação |
|---|---|
| Abertura do crachá | Balanço único, 1,1 s, `cubic-bezier(.3,.7,.3,1)`, `transform-origin: 50% -70px`. Vai de opacidade 0, translateY(−10) e rotate(−3,5°), passa por 35%: rotate(1,6°), 65%: rotate(−0,6°) e 85%: rotate(0,2°), e termina em repouso. A presilha balança junto; o cordão fica parado. |
| Virar (frente ↔ verso) | `rotateY(180deg)`, 0,6 s, `cubic-bezier(.2,.7,.2,1)`, perspective 1400, `transform-style: preserve-3d`, `backface-visibility: hidden` nas duas faces. |
| Ponto "Ativo" | Pulsa em loop: 2,8 s ease-in-out, opacidade de 1 a 0,35 e escala de 1 a 0,8. |
| Troca do QR (a cada 30 s) | Fade + escala de 0,975 a 1, 0,32 s. |
| Troca do código | Entra de baixo para cima (translateY 4 → 0) com fade, 0,25 s. |
| Segundos do relógio | O mesmo efeito, 0,22 s a cada segundo. |
| Contagem (mostrador e anel) | Linear, 1 s por segundo. Volta ao início **sem transição**. |
| Validado | O check aparece com um pequeno salto (escala 0,6 → 1,04 → 1, 0,45 s). O traço do check se desenha em 0,45 s, começando 0,2 s depois. |

## 7. Dados

```ts
type CourierBadge = {
  courierId: string; matricula: string;          // "0427"
  nome: string; fotoUrl: string | null;           // definidos pelo admin
  cpfMascarado: string;                           // "***.456.789-**"
  desde: string;                                  // "mar/2026"
  veiculo: { tipo: 'moto'|'carro'|'bicicleta'|'a_pe'; placa?: string } | null;
  ativo: boolean;
};
type BadgeValidation = {                          // futuro perfil Portaria
  id: string; courierId: string; condominioId: string;
  portariaUserId: string; at: string; metodo: 'qr' | 'codigo';
};
```
- Sem veículo cadastrado: esconda a coluna VEÍCULO. Para bicicleta ou a pé, mostre só o tipo, sem placa.
- O nome deve caber numa linha a 28 px. Se for longo, reduza até 24 e depois quebre em 2 linhas.

## 8. Tokens

- **Cores:**
  - Fundo do app `#FAF5EC` · surface `#FFFFFF` · cartão `#FFFDF9`
  - Surface alt `#FBF6EC` · surface 2 `#F4EBDA`
  - Texto `#241608` · secundário `#7C6A50` · terciário `#A89A82`
  - Espresso `#1E1207` · gold `#E3AC3F` · gold soft `#F3DDA6` · accent `#B0702A`
  - Sucesso `#3E7C53` (soft `#DCEBDF`) · alerta `#B23A2E`
- **Tipografia:** Bricolage Grotesque (nome, títulos), Hanken Grotesk (interface), monoespaçada do sistema (código).
- **Ícones** (traço 24, `currentColor`, mesmo set do app): x, clock, check, ban, lock, camera, chat, repeat, shield.

## 9. Acessibilidade

- Alvos de toque: fechar 44, QR 98 na frente e 248 no verso, botão "Falar com a operação" 56.
- O status nunca depende só da cor: tem sempre ícone ou ponto + texto (Ativo, Validado, Inativo).
- Contraste AA em todos os textos sobre o cartão e sobre o selo de vidro.
- Leitor de tela:
  - QR na frente: "Virar o crachá e ampliar o QR".
  - QR no verso: "Voltar para a frente do crachá".
  - Imagem do QR: "QR de validação do crachá".
- Respeitar a preferência de reduzir movimento (§6).

## 10. Arquivos de referência (`referencia/`)

- `Crachá Digital v3.html`: protótipo com os 5 estados.
- `cracha-kit.jsx`: relógio, gerador visual do QR, anel e mostrador de contagem, check animado e moldura do celular.
- `app/brand.jsx`: tokens, `BreadMark`, `Icon` e `StatusBar`.
- `image-slot.js`: só o espaço da foto do protótipo. No app, use `<img>` com a foto cadastrada.
