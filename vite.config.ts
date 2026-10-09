import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Two projects: `src/` runs in node, `worker/` runs in workerd against a real local D1.
  test: {
    projects: ['./vitest.engine.config.ts', './vitest.worker.config.ts'],
  },
})
