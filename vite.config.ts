import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // React + react-dom rarely change between releases, so they get their own chunk,
        // cached independently of app code (task 28).
        manualChunks: (id: string) =>
          /node_modules\/(react|react-dom|react-router-dom|scheduler)\//.test(id)
            ? 'react'
            : undefined,
      },
    },
  },
  // Two projects: `src/` runs in node, `worker/` runs in workerd against a real local D1.
  test: {
    projects: ['./vitest.engine.config.ts', './vitest.worker.config.ts'],
    // Vitest 5 swallows logs from passing tests, and `silent` is only honoured here at the
    // root - setting it inside a project config does nothing. The engine's `analyze
    // performance` block prints its measured milliseconds on every run, and that number (not
    // the deliberately loose budget it is checked against) is the perf signal, so it has to
    // reach a plain `npm run check`. See the comment above `ANALYZE_BUDGET_MS` in
    // `src/engine/index.test.ts`.
    silent: false,
  },
})
