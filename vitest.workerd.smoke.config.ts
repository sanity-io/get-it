import {cloudflareTest} from '@cloudflare/vitest-pool-workers'
import {defineConfig} from 'vitest/config'

import {smokeConfig} from './vitest.config'

// Built-asset smoke test on workerd. The cloudflare pool resolves `get-it` through the real
// `exports` map (no source alias) and, like real wrangler, excludes the `node` condition - so
// this exercises the fetch entry on bare workerd. `compatibilityDate` is required (workerd will
// not start without one); `nodejs_compat` is intentionally omitted.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2026-06-01',
        compatibilityFlags: [],
      },
    }),
  ],
  test: smokeConfig,
})
