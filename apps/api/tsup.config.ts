import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],          // combina com o código ESM atual + "type": "module"
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // INLINA o workspace `shared` no bundle (Node não executa o .ts dele).
  // Todo o resto (fastify, prisma, etc.) fica external e é resolvido
  // pelo node_modules em runtime — igual ao que já acontece hoje.
  noExternal: ['@cheirin-de-pao/shared'],
})
