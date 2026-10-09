import type { D1Migration } from '@cloudflare/vitest-plugin'
import type { Env as WorkerEnv } from '../index'

declare global {
  namespace Cloudflare {
    /**
     * What `env` from `cloudflare:test` holds: the Worker's own bindings plus the migrations
     * handed in by `vitest.worker.config.ts`.
     */
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}
