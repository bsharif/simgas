import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:4174',
        ws: true,
      },
    },
  },
  test: {
    environment: 'node',
    // engine/ holds the simulation logic; ui/ tests must be node-environment
    // pure functions (no DOM). Components are smoke-tested manually for now.
    include: ['engine/**/*.test.ts', 'ui/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
