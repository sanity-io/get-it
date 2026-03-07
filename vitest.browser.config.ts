import {defineConfig} from 'vitest/config'

import {sharedConfig} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    environment: 'happy-dom',
    exclude: [...(sharedConfig.exclude ?? []), 'test/node-proxy.test.ts'],
  },
})
