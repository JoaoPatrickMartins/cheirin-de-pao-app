/**
 * Guarda de tokens de design.
 *
 * Existe por causa de um bug real: `QuickExpense` usava `var(--color-bg)`, que **não existe** no
 * `globals.css`. Token inexistente SEM fallback não dá erro em lugar nenhum — o CSS simplesmente
 * não aplica a propriedade. No caso, o fundo do modal de tela cheia virou transparente e a tela de
 * baixo apareceu através dele: o formulário inteiro pareceu quebrado, sem um único erro de
 * console, de build ou de tipo.
 *
 * O projeto tem "alta fidelidade de design" como constraint e todo estilo é inline (não há classe
 * de Tailwind para o linter conferir), então nada mais no pipeline pega isto. Este teste pega.
 *
 * A leitura dos arquivos usa `import.meta.glob` do Vite (`?raw`, `eager`), e não `node:fs`: o
 * tsconfig do web declara só `vite/client` e `vitest/globals` em `types`, sem os tipos de Node.
 */
import { describe, it, expect } from 'vitest'

/** Conteúdo cru de todo fonte do app, resolvido em tempo de build pelo Vite. */
const SOURCES = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

// Curinga de propósito: `import.meta.glob` com caminho literal (sem `*`) devolve mapa VAZIO, e o
// teste passaria a não proteger nada em silêncio — o mesmo tipo de falha muda que ele existe para
// pegar. Por isso a asserção de sanidade abaixo confere que a paleta foi lida.
const STYLESHEETS = import.meta.glob('../*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * Ocorrências que JÁ existiam quando esta guarda foi escrita.
 *
 * Todas são o mesmo defeito do `--color-bg`: token inexistente, sem fallback, estilo não aplicado
 * — sem erro nenhum, só a cor errada na tela.
 *
 *   `--color-destructive` → a paleta chama isso de `--color-warn`
 *   `--gold` / `--accent` / `--text-sec` → falta o prefixo (`--color-gold`, `--color-accent`,
 *       `--color-text-sec`). São erros de digitação, e hoje esses três não pintam nada.
 *
 * Estão listados, e não corrigidos, porque mexer neles muda pixel em telas fora do escopo da
 * correção que originou este teste. A lista é para ENCOLHER: ocorrência nova falha o teste, e cada
 * item resolvido tem de sair daqui.
 */
const KNOWN_BROKEN = [
  'components/client/GanchoConsentModal.tsx → --color-destructive',
  'components/courier/ConfirmDeliveryDialog.tsx → --color-destructive',
  'pages/admin/tabs/AdminPedido.tsx → --accent',
  'pages/admin/tabs/AdminPedido.tsx → --gold',
  'pages/admin/tabs/AdminPedido.tsx → --text-sec',
  'pages/client/HookScreen.tsx → --color-destructive',
].sort()

interface Usage {
  file: string
  token: string
  hasFallback: boolean
}

function definedTokens(): Set<string> {
  const out = new Set<string>()
  for (const css of Object.values(STYLESHEETS)) {
    for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) out.add(m[1])
  }
  return out
}

function collectUsages(): Usage[] {
  const out: Usage[] = []
  for (const [path, content] of Object.entries(SOURCES)) {
    if (path.includes('__tests__')) continue
    // "../../pages/admin/..." → "pages/admin/..."
    const file = path.replace(/^(\.\.\/)+/, '')
    for (const m of content.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,[^)]*)?\)/gi)) {
      out.push({ file, token: m[1], hasFallback: m[2] != null })
    }
  }
  return out
}

describe('tokens de design', () => {
  const defined = definedTokens()
  const usages = collectUsages()

  const broken = [
    ...new Set(
      usages
        .filter((u) => !u.hasFallback && !defined.has(u.token))
        .map((u) => `${u.file} → ${u.token}`),
    ),
  ].sort()

  it('globals.css declara a paleta', () => {
    // Sanidade: se a extração falhar, os testes seguintes passariam vazios e não protegeriam nada.
    expect(defined.size).toBeGreaterThan(20)
    expect(defined.has('--color-app-bg')).toBe(true)
    expect(defined.has('--color-surface')).toBe(true)
  })

  it('encontra usos de var() no código', () => {
    expect(usages.length).toBeGreaterThan(100)
  })

  it('nenhum token inexistente NOVO é usado sem fallback', () => {
    // É esta a asserção que teria pegado o `--color-bg` do QuickExpense antes da tela ir para o
    // celular do usuário.
    const novos = broken.filter((b) => !KNOWN_BROKEN.includes(b))
    expect(
      novos,
      `Token inexistente sem fallback — o estilo não será aplicado:\n${novos.join('\n')}`,
    ).toEqual([])
  })

  it('a lista de pendências conhecidas não cresce e não fica obsoleta', () => {
    // Corrigiu um item? O teste falha aqui pedindo para removê-lo de KNOWN_BROKEN — é o que
    // impede a lista de virar depósito permanente.
    expect(broken).toEqual(KNOWN_BROKEN)
  })

  it('tokens usados só com fallback ficam registrados (divergência de paleta)', () => {
    const withFallback = [
      ...new Set(usages.filter((u) => u.hasFallback && !defined.has(u.token)).map((u) => u.token)),
    ].sort()

    // `--color-bad` é convenção histórica do app (15+ arquivos, sempre com `#C2410C`) e RENDERIZA
    // pelo fallback — então não é bug, é divergência de paleta: a cor de erro declarada é
    // `--color-warn`. `--color-success` tem a mesma história (a paleta declara `--color-good`).
    // Ficam listados de propósito: no dia em que alguém alinhar os dois, este é o inventário.
    expect(withFallback).toEqual(['--color-bad', '--color-success'])
  })
})
