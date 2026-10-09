import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineProject } from 'vitest/config'

/**
 * The Worker half of the suite. These tests run inside workerd against a real (local) D1,
 * not a stub, so the SQL, the CHECK constraints and the UNIQUE dedupe are all exercised for
 * real - which is the whole point, since those constraints are what protect the ledger.
 */
export default defineProject(async () => {
  // Read at config time and handed in as a binding; the setup file replays them per test file.
  const migrations = await readD1Migrations('./migrations')

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // A stand-in for the deployed `AUTH_TOKEN`. The route tests run with the dev
            // bypass on (the same way `wrangler dev` does) and the gate tests switch it off
            // per request, so both paths are exercised against this token.
            AUTH_TOKEN: 'test-token-not-a-real-secret-0123456789abcdef',
            DEV_AUTH_BYPASS: 'true',
          },
        },
      }),
    ],
    test: {
      name: 'worker',
      include: ['worker/**/*.test.ts'],
      setupFiles: ['./worker/test/applyMigrations.ts'],
    },
  }
})
