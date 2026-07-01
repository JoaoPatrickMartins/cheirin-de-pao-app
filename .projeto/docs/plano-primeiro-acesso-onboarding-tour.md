# Onboarding de primeiro acesso do cliente — Telas explicativas + Tour do App

## Contexto

Hoje o cliente faz login/cadastro e cai direto na `HomeScreen`, sem explicação de **como o Cheirin de Pão funciona** nem de **como usar o app**. O core value ("configura uma vez e o pão chega todo dia") não é óbvio para quem nunca usou, e a UI da Home (saldo em pães, comprar, agenda, acompanhar entrega) não é apresentada. Não existe mecanismo de primeiro acesso (a `OnboardingScreen` atual é o fluxo de **cadastro** — não será reutilizada).

Este plano implementa o fluxo especificado no **handoff de design** (`HANDOFF-primeiro-acesso.md`, mockup `Cheirin de Pão - Primeiro Acesso.html` + `app/onboarding-flow.jsx`), exibido **uma única vez** por conta, em duas fases sequenciais:

**Fase A — Telas explicativas (conceito do produto):** carrossel de 3 slides (overlay full-screen sobre a Home).
1. **Compra** (`kind: compra`) — pedido único ou agenda semanal
2. **Gancho** (`kind: gancho`) — gancho de acrílico transparente na porta, onde o entregador pendura a sacola toda manhã
3. **Pão fresquinho** (`kind: pao`) — abrir a porta de manhã e pegar o pão quentinho

**Fase B — Tour do App (como usar a tela):** coach-marks com spotlight sobre a Home real, **6 paradas**: Saldo → Comprar pães → Entrega de hoje → Avulso/Agenda → aba Agenda → aba Perfil (recarga automática). Ao fim, badge de boas-vindas e marca `onboardingDone`.

**Resultado esperado:** o cliente novo entende o ciclo (comprar → agendar → receber no gancho) e sai sabendo onde tocar para comprar, agendar e ativar a recarga automática — aumentando a ativação.

### Decisões (confirmadas)
- **Fonte de verdade visual:** o handoff. Usar os **tokens do app** (`globals.css` ⇄ `brand.jsx`) — não hard-codar hex fora dos visuais ilustrativos.
- **Visuais dos slides:** `StepVisual` como **slot** (CSS + `Icon` + `BreadMark` agora; trocável por ilustração/Lottie/`<img>` depois sem mudar o layout externo).
- **Mostrar uma vez:** por **conta de cliente** (chaves `localStorage` sufixadas com `<userId>`).
- **Encadeamento ("Tour sempre"):** "Começar" ou "Pular" nas telas → Home + tour inicia sozinho. `onboardingDone` só grava ao **concluir/pular o tour**.
- **Tour: 6 paradas** (handoff) — expande a definição anterior de 4. Implementado com **driver.js** (lib leve de coach-marks, escolhida).
- **Re-disparo manual:** Perfil → Ajuda → "Rever tutorial".

> Convenção do projeto: o CLAUDE.md exige iniciar via GSD, mas o GSD não está instalado. Na execução, salvar cópia deste plano em `.projeto/docs/` e seguir.

---

## Visão geral do fluxo

```
Login/Cadastro (cliente novo, onboardingDone != true) → navigate('/client')
        │
        ▼
[ Fase A: 3 slides ]   (overlay full-screen sobre a Home, em ClientLayout)
   ├─ "Começar" (slide 3) ─┐
   └─ "Pular" (topo) ──────┤→ marca cdp_slides_done_<userId> + navigate('/client/home')
        │
        ▼
[ Fase B: Tour, 6 paradas ]   (coach-marks/spotlight sobre a Home real)
   saldo → comprar-paes → entrega-hoje → pedido-avulso → tab-agenda → tab-perfil
   ├─ "Concluir" / "Pular" / Esc / clique no backdrop
        │
        ▼
[ Badge de conclusão ]  "Tudo pronto! Bem-Vindo ao Cheirin de Pão!" (check dourado, ~1.8s)
        │
        ▼  marca cdp_onboarding_seen_<userId>  → Home normal

Re-disparo: Perfil → Ajuda → "Rever tutorial"  → reset flags → volta para Fase A
```

Robustez a reload: `cdp_slides_done_<userId>` faz um reload no meio retomar **no tour**. Opcional `cdp_tour_step_<userId>` para retomar na parada exata (handoff sugere persistir `onboardingPhase`/`tourStep`).

---

## Detecção e flags — `apps/web/src/lib/onboarding.ts` (novo)

Chaves por conta. Regra crítica: se `localStorage` lançar (Safari modo privado), os getters retornam **`true`** (já visto) — nunca bloquear, nunca entrar em loop. Mesmo padrão try/catch de `AuthContext.tsx`.

```ts
const SEEN   = (u: string) => `cdp_onboarding_seen_${u}`  // == onboardingDone (handoff)
const SLIDES = (u: string) => `cdp_slides_done_${u}`      // retomar no tour após reload
const STEP   = (u: string) => `cdp_tour_step_${u}`        // (opcional) retomar parada exata

export function hasSeenOnboarding(userId: string): boolean {
  try { return localStorage.getItem(SEEN(userId)) === '1' } catch { return true }
}
export function slidesDone(userId: string): boolean {
  try { return localStorage.getItem(SLIDES(userId)) === '1' } catch { return true }
}
export function markSlidesDone(userId: string): void {
  try { localStorage.setItem(SLIDES(userId), '1') } catch {}
}
export function getTourStep(userId: string): number {
  try { return Number(localStorage.getItem(STEP(userId))) || 0 } catch { return 0 }
}
export function setTourStep(userId: string, i: number): void {
  try { localStorage.setItem(STEP(userId), String(i)) } catch {}
}
export function markOnboardingSeen(userId: string): void {
  try { localStorage.setItem(SEEN(userId), '1'); localStorage.removeItem(SLIDES(userId)); localStorage.removeItem(STEP(userId)) } catch {}
}
export function resetOnboarding(userId: string): void {  // re-disparo manual (Perfil → Rever tutorial)
  try { localStorage.removeItem(SEEN(userId)); localStorage.removeItem(SLIDES(userId)); localStorage.removeItem(STEP(userId)) } catch {}
}
```

---

## Orquestração — `apps/web/src/pages/client/ClientLayout.tsx` (modificar)

Hooks rodam antes dos early returns existentes (`isLoading`→`LoadingScreen`; sem user/role→`Navigate`). Conteúdo de primeiro acesso só renderiza no ramo autenticado (logo `user` existe). Máquina de fases em memória + listener de re-disparo:

```tsx
type Phase = 'slides' | 'tour' | 'done'
const { user, isLoading } = useAuth()
const [phase, setPhase] = useState<Phase>('done')

useEffect(() => {
  if (user?.role !== 'CLIENT') return
  if (hasSeenOnboarding(user.id)) { setPhase('done'); return }
  setPhase(slidesDone(user.id) ? 'tour' : 'slides')
}, [user])

// re-disparo manual (disparado por SettingsScreen após resetOnboarding)
useEffect(() => {
  const replay = () => setPhase('slides')
  window.addEventListener('cdp:replay-onboarding', replay)
  return () => window.removeEventListener('cdp:replay-onboarding', replay)
}, [])

function finishSlides() { if (user) markSlidesDone(user.id); setPhase('tour'); navigate('/client/home') }
function finishTour()   { if (user) markOnboardingSeen(user.id); setPhase('done') }

// dentro do NotifProvider, irmãos do <Outlet/>:
{phase === 'slides' && <OnboardingOverlay onFinish={finishSlides} />}
{phase === 'tour'   && <AppTour onFinish={finishTour} />}
```

---

## Fase A — Telas explicativas: `apps/web/src/components/client/OnboardingOverlay.tsx` (novo)

Carrossel horizontal, swipe (touch + mouse drag, **threshold 45px**), `StepDots` no rodapé, **Voltar/Próximo**, "Começar" no último, "Pular" no topo. `<MotionConfig reducedMotion="user">`; track `motion.div` anima `x: \`-${step*100}%\`` (porcentagem, test-safe); ease `[0.22,1,0.36,1]`; `drag="x"` + `onDragEnd` com limiar de 45px/velocity. Overlay cobre a tela (`background: var(--color-app-bg)`, zIndex acima da tab bar). Botões padrão espresso/gold com `whileHover={{y:-1}} whileTap={{scale:0.97}}`, alvos ≥ 44px, títulos `--font-display`, corpo `--font-body`.

**Conteúdo (copy do handoff, inline PT, "pães"):**
```ts
const SLIDES = [
  { kind: 'compra', title: 'Peça do seu jeito',
    body: 'Compre seus pães e escolha: um pedido único ou uma agenda semanal que se repete sozinha.' },
  { kind: 'gancho', title: 'Seu gancho do Cheirin',
    body: 'Você recebe um gancho para a porta (de acrílico transparente, super discreto). Toda manhã o entregador pendura a sacola de pães fresquinhos nele.' },
  { kind: 'pao', title: 'Pão fresquinho na porta',
    body: 'É só abrir a porta de manhã e pegar seu pão fresquinho. Todo dia, sem precisar fazer nada.' },
]
```

**`StepVisual` (slot)** — `borderRadius: 28`, altura `clamp(150px, 30vh, 248px)`, fundo tintado (tokens creme/gold-soft). Trocável por ilustração/Lottie/`<img>` finais sem mudar o layout externo. Composições (mockup):
- `compra`: **dois cards lado a lado** — "Avulso / Pedido único" (`Icon` `bag`) e "Agenda / Semanal" (`Icon` `calendar`), separados por um **"+"**.
- `gancho`: **porta + gancho em "J"** (sem sacola).
- `pao`: **mesma cena do gancho + sacola pendurada no gancho (com alça)** — `BreadMark` como sacola.

---

## Fase B — Tour do App: `apps/web/src/components/client/AppTour.tsx` (novo)

Coach-marks com spotlight sobre a Home **real**.

> **Implementação: driver.js** (~5KB, vanilla, zero-dep, MIT, compatível com React 19). A lib cuida de posicionamento, `scrollIntoView`, resize, reflow, foco e teclado — eliminando o **bug do mockup** (o spotlight "voltava" ao card de saldo nas paradas finais, por limitação da medição manual). Estilizamos o popover/recorte com nossos tokens via `popoverClass`/CSS do driver.js. Encapsular numa única instância criada no `AppTour` (montar `steps` a partir de `TOUR_STOPS`, `driverObj.drive()` ao montar; `onDestroyed`/última etapa → badge → `onFinish`).

### Paradas (6) — config (do handoff)
```ts
const TOUR_STOPS = [
  { sel: 'saldo',         title: 'Seu saldo, em pães',  body: 'Pães disponíveis na sua conta para agendar entregas.' },
  { sel: 'comprar-paes',  title: 'Comprar pães',        body: 'Sem pães? Compre aqui em segundos, por Pix ou cartão.' },
  { sel: 'entrega-hoje',  title: 'Sua entrega do dia',  body: 'Acompanhe por aqui quando o pão está a caminho e quando chega.' },
  { sel: 'pedido-avulso', title: 'Avulso ou agenda',    body: 'Precisa de pão só num dia? Faça um pedido avulso, único, sem compromisso.' },
  { sel: 'tab-agenda',    title: 'Monte sua agenda',    body: 'Escolha os dias da semana e pronto — o pão chega sozinho.' },
  { sel: 'tab-perfil',    title: 'Recarga automática',  body: 'No Perfil (ou na aba Pães) você ativa a recarga automática — seu saldo renova sozinho e você nunca fica sem.' },
]
```
Cada parada ancora em `[data-tour="<sel>"]` → vira um step do driver.js (`element: '[data-tour="saldo"]'`, `popover: { title, description }`). Recarga automática é ativável na aba **Pães** e em **Perfil → Compra automática** (`/client/creditos/recorrente`, já existente); o tour aponta para Perfil mas o texto cita os dois caminhos.

### Especificação visual (handoff) — aplicada sobre o driver.js
- Overlay escuro `rgba(20,12,4,0.62)` (`overlayColor` da lib) com **recorte** no alvo + **outline dourado** (CSS no `.driver-active-element`/popover); balão (popover) **acima/abaixo** conforme o alvo, com **seta** — o driver.js já posiciona e desenha a seta.
- Popover: contador **"x de 6"** (`showProgress` com `progressText`), **Anterior / Próximo / Concluir** (`prevBtnText`/`nextBtnText`/`doneBtnText`), **"Pular"** (botão custom), **Esc** sai (`allowClose`), **clique no backdrop avança** (`overlayClickBehavior: 'nextStep'`).
- Camadas: o driver.js injeta overlay/popover no `document.body` com z-index alto; garantir CSS que mantenha acima da tab bar (z-index 50) — sobrescrever para `>= 10000` se necessário.
- driver.js faz `scrollIntoView` + recálculo de posição a cada passo (corrige o bug do mockup). Honrar `prefers-reduced-motion`: desligar `animate`/`smoothScroll` quando ativo.
- Acessibilidade: o driver.js já entrega `role`/`aria` no popover, foco no popover a cada passo e gestão de teclado; o spotlight é decorativo. Validar o retorno de foco ao conteúdo no fim.

### Estado "concluído"
Ao concluir/pular a última parada: exibir badge central **"Tudo pronto! Bem-Vindo ao Cheirin de Pão!"** com **check dourado** (~1.8s) e então `onFinish()` (marca `onboardingDone`). Reaproveitar o estilo do `Toast`/`useToast` (`apps/web/src/components/admin/Toast.tsx`), acrescentando o ícone `check` dourado, ou um pequeno `WelcomeBadge` com os mesmos tokens.

### Âncoras `data-tour` a adicionar
| Parada | Arquivo | Onde |
|---|---|---|
| `saldo` | `components/client/CreditBalanceCard.tsx` | container do card (mantém `data-testid="credit-balance"`) |
| `comprar-paes` | `components/client/CreditBalanceCard.tsx` | `motion.button` "Comprar pães" (~L193) |
| `entrega-hoje` | `pages/client/HomeScreen.tsx` | `motion.div` do card de entrega (~L258) |
| `pedido-avulso` | `pages/client/HomeScreen.tsx` | quick action **Avulso** (~L389) |
| `tab-agenda` | `components/client/ClientTabBar.tsx` | `<button>` da aba Agenda |
| `tab-perfil` | `components/client/ClientTabBar.tsx` | `<button>` da aba Perfil |

Na tab bar, adicionar `data-tour={\`tab-${tab.path.split('/').pop()}\`}` em cada `<button>` (gera `tab-agenda`, `tab-perfil`, …). Todas as 6 âncoras existem para **cliente novo** (saldo "0 pães", botão Comprar pães, card "Nenhuma entrega agendada", quick action Avulso, abas fixas). Banner de corte e risk banner NÃO aparecem para conta nova — por isso não são paradas.

> Obs.: o handoff lista ícones da nav bar como `home/calendar/bag/clock/user`, mas o app real usa `home/calendar/BreadMark(Pães)/bag(Pedidos)/user`. As paradas do tour (Agenda, Perfil) batem com o app — **não alterar os ícones da tab bar**.

---

## Arquivos

**Novos**
- `apps/web/src/lib/onboarding.ts` — flags/detecção/reset.
- `apps/web/src/components/client/OnboardingOverlay.tsx` — Fase A (3 slides).
- `apps/web/src/components/client/AppTour.tsx` — Fase B (driver.js + badge de conclusão). Config das paradas inline ou em `appTourSteps.ts`.
- `apps/web/src/components/client/appTour.css` (ou bloco em `globals.css`) — estilo do popover/recorte do driver.js com os tokens da marca.
- Testes: `lib/__tests__/onboarding.test.ts`, `components/client/__tests__/OnboardingOverlay.test.tsx`, `components/client/__tests__/AppTour.test.tsx`.

**Modificados**
- `apps/web/src/pages/client/ClientLayout.tsx` — orquestração de fases + listener de re-disparo.
- `apps/web/src/components/client/CreditBalanceCard.tsx` — `data-tour="saldo"`, `data-tour="comprar-paes"`.
- `apps/web/src/pages/client/HomeScreen.tsx` — `data-tour="entrega-hoje"`, `data-tour="pedido-avulso"`.
- `apps/web/src/components/client/ClientTabBar.tsx` — `data-tour` por aba.
- `apps/web/src/pages/client/SettingsScreen.tsx` — nova seção **Ajuda** com `ProfileMenuRow icon="refresh" label="Rever tutorial"` → `resetOnboarding(user.id)` + `navigate('/client/home')` + `window.dispatchEvent(new Event('cdp:replay-onboarding'))`.
- `apps/web/package.json` — adicionar dependência `driver.js`.

**Sem mudanças** no `router.tsx`, `AuthContext.tsx` nem no backend.

## Reuso (não recriar)
- `StepDots` — `components/auth/StepDots.tsx`; `Icon`/`Ic` — `components/brand/Icon.tsx`; `BreadMark` — `components/brand/BreadMark.tsx`.
- `Toast`/`useToast` — `components/admin/Toast.tsx` (base do badge de conclusão).
- `createPortal` — padrão em `components/admin/SeparationCoupon.tsx`; overlay/backdrop — `OrderDetailSheet.tsx`, `ConfirmDeliveryDialog.tsx`, `IOSInstallSheet` em `SplashScreen.tsx`.
- Tokens/animação — `styles/globals.css`; `MotionConfig`/Variants de `HomeScreen.tsx`. Try/catch de storage — `contexts/AuthContext.tsx`.
- `ProfileMenuRow` — já definido em `SettingsScreen.tsx` (reusar para "Rever tutorial").

## Testes (Vitest + jsdom + MemoryRouter, mock `useAuth`)
- **`onboarding.test.ts`:** getters `false`/`true` por presença da chave; `markSlidesDone`/`markOnboardingSeen`/`resetOnboarding` mexem nas chaves certas (e `markOnboardingSeen` limpa `SLIDES`/`STEP`); `getItem` lançando → getters retornam `true`; chaves por user independentes.
- **`OnboardingOverlay.test.tsx`:** renderiza slide 1 + `StepDots`; "Próximo"/"Voltar" navegam; "Começar" e "Pular" chamam `onFinish`; reduced-motion test-safe.
- **`AppTour.test.tsx`:** `vi.mock('driver.js')` (jsdom não faz layout) e verificar que o `AppTour` monta os **6 steps na ordem** a partir de `TOUR_STOPS` e chama `drive()`; que o callback de conclusão/`onDestroyed` exibe o **badge de boas-vindas** e então chama `onFinish`; que "Pular"/Esc levam a `onFinish`.
- **Gating (ClientLayout):** `seen` ausente + `slides_done` ausente → `slides`; `slides_done` presente → `tour`; `seen` presente → `done`; concluir slides → `markSlidesDone` + `tour`; concluir tour → `markOnboardingSeen`; evento `cdp:replay-onboarding` → volta para `slides`.

## Verificação (manual / E2E)
1. `cd apps/web && npm test` — suites novas verdes + `ClientLayout`/`HomeScreen`/`CreditBalanceCard`/`ClientTabBar`/`SettingsScreen` sem regressão.
2. `npm run dev`, logar como cliente novo (ou limpar `cdp_onboarding_seen_<userId>`/`cdp_slides_done_<userId>`/`cdp_tour_step_<userId>` no DevTools).
3. Ver os 3 slides (botões + swipe 45px) → "Começar" → Home + tour inicia; percorrer as **6 paradas** (contador "x de 6"), Anterior/Próximo, clique no backdrop avança, Esc sai; "Concluir" → **badge de boas-vindas** → Home.
4. Limpar flags e clicar "Pular" nos slides → confirmar que o **tour ainda aparece**.
5. Recarregar durante o tour → retoma no tour (não repete slides).
6. Concluir/pular o tour, recarregar → nada reaparece.
7. **Perfil → Ajuda → "Rever tutorial"** → fluxo recomeça nos slides.
8. `prefers-reduced-motion: reduce` → transições/scroll instantâneos; navegação funciona.
9. Bloquear localStorage (modo privado) → app não trava nem entra em loop.
10. Spotlight alinhado a cada alvo, **inclusive nas paradas finais** (sem o bug do mockup); recalcula ao rolar/redimensionar; balão visível; z-index acima da tab bar; alvos ≥ 44px.

## Riscos / pontos de atenção
- **Bug de medição do mockup** (spotlight "volta" ao saldo nas paradas finais): resolvido pelo driver.js (scroll + recálculo de posição a cada passo). Não recriar a medição manual.
- **Compat React 19:** escolhido `driver.js` por ser vanilla/zero-dep e agnóstico, evitando o atrito histórico de `react-joyride` com React 19/StrictMode.
- **Alvo ainda não montado** ao iniciar o tour (Home lazy + animações de entrada): aguardar o anchor `[data-tour="saldo"]` existir antes de `driverObj.drive()`.
- **Mudança de rota durante o tour** (toque numa aba): manter o tour ativo só na Home; se sair, `driverObj.destroy()` para não apontar pro vazio.
- **Testes:** `vi.mock('driver.js')` (jsdom não faz layout) — testar a orquestração (steps/ordem/callbacks), não o posicionamento.
- **Nova dependência:** `driver.js` entra no `package.json` — leve e MIT, mas é um item a aprovar no review.
- **Tokens:** usar `var(--color-*)`; não hard-codar os hex do handoff fora dos visuais ilustrativos.
