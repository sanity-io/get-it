import {cloudflareTest} from '@cloudflare/vitest-pool-workers'
import {configDefaults, defineConfig} from 'vitest/config'

import {sharedConfig} from './vitest.config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2026-06-01',
        compatibilityFlags: ['nodejs_compat'],
      },
    }),
  ],
  test: {
    ...sharedConfig,
    exclude: [...configDefaults.exclude, 'test/*.node.test.ts'],
  },
})
