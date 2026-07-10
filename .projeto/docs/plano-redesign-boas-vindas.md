# Plano — Redesign tela de Boas-vindas (Splash / Instalar PWA) → 1:1 com o protótipo

**Objetivo:** Deixar a tela de boas-vindas ([SplashScreen.tsx](../../apps/web/src/pages/splash/SplashScreen.tsx)) visualmente idêntica ao print do protótipo, preservando a funcionalidade real de instalação do PWA (Android `beforeinstallprompt` + bottom sheet iOS).

**Fonte da verdade:** `InstallScreen` em [.projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx](../design_handoff_cheirin_pao/app/screens-onboarding.jsx) (linhas 6–37) + primitivas em [brand.jsx](../design_handoff_cheirin_pao/app/brand.jsx).

---

## Diagnóstico — por que hoje NÃO bate com o print

A implementação atual divergiu do protótipo em estrutura, não só em detalhes:

| # | Elemento | Atual (código) | Protótipo (print) |
|---|----------|----------------|-------------------|
| 1 | **Layout vertical** | Logo fixado no topo (`marginTop: 64`) + `flex-1` empurra o card pra baixo | Logo **centralizado verticalmente** (`flex:1` + `justifyContent:center`); rodapé é bloco separado |
| 2 | **Glow radial** | Faixa de 256px no topo, `ellipse at 50% 0%`, alpha 0.15 | Tela inteira (`inset:0`), `120% 80% at 50% -10%`, alpha 0.18, `transparent 60%` |
| 3 | **Sombra do ícone** | `var(--shadow-strong)` (sombra de tema claro, quase invisível no escuro) | `0 30px 60px -20px rgba(0,0,0,0.6)` (halo escuro profundo) |
| 4 | **Card "Instalar"** | **Branco** (`#FFFFFF`), contém só título + os 2 botões | **Translúcido** `rgba(250,245,236,0.06)` + borda `rgba(250,245,236,0.12)`; contém **ícone-mini + título + descrição**, SEM botões |
| 5 | **Ícone-mini no card** | ❌ não existe | Quadrado 46×46, raio 13, fundo `#160C04`, `BreadMark size=30` dourado |
| 6 | **Descrição no card** | ❌ não existe | "Adicione à tela inicial — abre rápido, funciona offline." (`12.5px`, cor `#C7B595`) |
| 7 | **Posição dos botões** | Dentro do card branco | **Fora/abaixo** do card |
| 8 | **Botão CTA dourado** | `size md` (pad `13px 18px`, fonte 15) | `size lg` (pad `16px 22px`, fonte 16) |
| 9 | **Link "Já tenho conta"** | Cor `#B0702A`, fonte 15, peso 700, `marginTop:4` | Cor `#C7B595`, fonte 13.5, peso 600, `marginTop:12` |
| 10 | **Título** | `letterSpacing:-0.02em`, cor `#FBF3E4` | `letterSpacing:-0.03em`, cor `#FAF5EC`, `whiteSpace:nowrap` |
| 11 | **Tagline** | peso 700 | peso 600 |
| 12 | **Padding lateral** | `px-5` (20px) na tela toda | Centro `padding:32`; rodapé `padding:0 24px 16px` |
| 13 | **Navegação** | Link "entrar" é stub vazio (`/* Phase 2 */`) | `go('login')` / `go('onboarding')` — rotas `/login` e `/register` **já existem** |

> Resumo: o card deixa de ser branco-com-botões e vira um **cartão informativo translúcido**; os botões descem pra fora dele; o logo passa a ser **centralizado**; e fundo/sombra/tipografia recebem ajustes finos.

---

## Mudanças (arquivo único: `SplashScreen.tsx`)

Reescrita do JSX para espelhar o protótipo. Valores-alvo exatos:

### Container raiz
```
minHeight: 100dvh; display:flex; flexDirection:column;
background:#1E1207; color:#FAF5EC; position:relative; overflow:hidden
```

### Glow radial (substitui a vinheta atual)
```
position:absolute; inset:0; pointerEvents:none;
background: radial-gradient(120% 80% at 50% -10%, rgba(227,172,63,0.18), transparent 60%)
```

### Bloco central (logo + título) — centralizado
```
flex:1; display:flex; flexDirection:column; alignItems:center;
justifyContent:center; gap:22; position:relative; padding:32
```
- **Ícone**: `132×132`, `borderRadius:30%`, `background:#160C04`, `display:grid; placeItems:center`, `boxShadow:0 30px 60px -20px rgba(0,0,0,0.6)` → `<BreadMark size={86} color="#E3AC3F" />`
- **Título** (`text-align:center`): `var(--font-display)`, peso 700, `fontSize:32`, `letterSpacing:-0.03em`, `whiteSpace:nowrap`, "Cheirin de Pão"
- **Tagline**: `var(--font-body)`, `fontSize:12`, `letterSpacing:0.26em`, cor `#E3AC3F`, `marginTop:8`, peso 600, "PÃO FRESCO NA PORTA"

### Bloco rodapé
```
position:relative; padding:0 24px 16px
```
- **Card informativo**: `background:rgba(250,245,236,0.06)`, `border:1px solid rgba(250,245,236,0.12)`, `borderRadius:22`, `padding:18`, `marginBottom:16`
  - Linha flex `alignItems:center; gap:13`:
    - Ícone-mini: `46×46`, `borderRadius:13`, `background:#160C04`, `display:grid; placeItems:center`, `flexShrink:0` → `<BreadMark size={30} color="#E3AC3F" />`
    - Texto (`flex:1`): título "Instalar o Cheirin" (peso 700, `fontSize:15`) + descrição "Adicione à tela inicial — abre rápido, funciona offline." (`fontSize:12.5`, cor `#C7B595`, `marginTop:2`)
- **Botão CTA** (`PrimaryButton`, agora `size lg`): dourado `#E3AC3F`, texto `#1E1207`, `padding:16px 22px`, `fontSize:16`, peso 700, `borderRadius:16`, full width → "Instalar e criar conta"
- **Link secundário**: `width:100%`, `marginTop:12`, `background:none`, `border:none`, cor `#C7B595`, `fontSize:13.5`, peso 600, `var(--font-body)` → "Já tenho conta — entrar"

### Ajuste no `PrimaryButton`
Trocar os valores `md` por `lg`: `padding:'16px 22px'`, `fontSize:16` (mantém hover/transform).

### Navegação (rotas já existem no router) — ✅ DECIDIDO: ligar
- Adicionar `useNavigate` de `react-router`.
- Link secundário → `navigate('/login')` (substitui o stub vazio).
- `handleCTA`: manter `triggerInstall()` (Android) e sheet iOS; adicionar fallback `else navigate('/register')` para quando não há prompt nativo (desktop/já instalável-não).

---

## Fora de escopo (decisões conscientes)

- **Bottom sheet iOS** (`IOSInstallSheet`): ✅ DECIDIDO: mantido como está (claro/funcional). Não aparece no print. Reestilizar pra escuro fica como melhoria futura, fora deste escopo.
- **Tap target do link**: o protótipo não define `min-height:44` no link "entrar". Para ser 1:1 não forçamos altura; aceita-se a área de toque um pouco menor (nota de a11y).
- Não usar tokens do tema claro nesta tela — ela é sempre escura; manter os valores hex/rgba inline iguais ao protótipo (mesma abordagem do código atual).

---

## Validação

1. `npm --workspace apps/web run typecheck` — sem erros de tipo.
2. Rodar o web (`npm run dev`) e comparar lado a lado com o print:
   - Logo centralizado verticalmente, glow quente no topo, halo escuro sob o ícone.
   - Card translúcido com ícone-mini + título + descrição (sem botões dentro).
   - Botão dourado lg + link tan abaixo do card.
3. Sanidade funcional: CTA dispara install no Android; link "entrar" navega para `/login`.
4. (Opcional) Atualizar `SplashScreen.test.tsx` — hoje são só `it.todo`; trocar por asserts de que renderiza o CTA "Instalar e criar conta" e o link "Já tenho conta — entrar".
