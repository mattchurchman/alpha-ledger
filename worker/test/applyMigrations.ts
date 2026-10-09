import { applyD1Migrations, env } from 'cloudflare:test'

// Each test file gets its own isolated D1, so the schema has to be created in each one.
// The migrations come in as a binding from vitest.worker.config.ts.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
