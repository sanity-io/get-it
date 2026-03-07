import {defineConfig} from 'vitest/config'

import {sharedConfig} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    environment: 'edge-runtime',
    exclude: [...(sharedConfig.exclude ?? []), 'test/node-proxy.test.ts'],
  },
})
