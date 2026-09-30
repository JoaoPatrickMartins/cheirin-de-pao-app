import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // `css: false` (o padrão) faz a vitest servir todo CSS como string VAZIA. Com isso, a guarda
    // de tokens de design (`src/styles/__tests__/design-tokens.test.ts`) lia zero token do
    // `globals.css` e passava sem proteger nada — falhando em silêncio, que é exatamente o tipo de
    // defeito que ela existe para pegar (ver o bug do `--color-bg` documentado lá).
    css: true,
  },
})
