import {cloudflareTest} from '@cloudflare/vitest-pool-workers'
import {defineConfig} from 'vitest/config'

import {nonNodeExclude, sharedConfig} from './vitest.config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2026-06-01',
        // No `nodejs_compat`: get-it must work on bare workerd. Enabling it would
        // let the resolver match the `node` export condition and pull in undici.
        compatibilityFlags: [],
      },
    }),
  ],
  test: {
    ...sharedConfig,
    exclude: nonNodeExclude,
  },
})
