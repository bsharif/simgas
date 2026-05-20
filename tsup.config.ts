import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['server/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist/server',
  clean: false,
  sourcemap: true,
  splitting: false,
  dts: false,
})
