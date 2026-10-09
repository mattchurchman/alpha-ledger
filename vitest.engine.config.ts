import react from '@vitejs/plugin-react'
import { defineProject } from 'vitest/config'

/**
 * The pure-TypeScript half of the suite: everything under `src/`. Runs in node, because the
 * engine has no I/O and no UI imports (CLAUDE.md). The React plugin is here so component
 * tests added by a later task work without touching this file again.
 */
export default defineProject({
  plugins: [react()],
  test: {
    name: 'engine',
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
