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
            // Stand-ins for the three deployed secrets. The team domain is never contacted:
            // `access.test.ts` verifies against a locally generated key set, and the route
            // tests run with the dev bypass on, the same way `wrangler dev` does.
            ACCESS_TEAM_DOMAIN: 'https://alpha-ledger-test.cloudflareaccess.com',
            ACCESS_AUD: '0000000000000000000000000000000000000000000000000000000000000000',
            OWNER_EMAIL: 'owner@example.test',
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
