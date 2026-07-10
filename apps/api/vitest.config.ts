import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Ignora a saída compilada — evita rodar duplicado os .test.js de dist/ (shadowing)
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
