import {defineConfig} from 'vitest/config'

import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    environment: 'happy-dom',
    exclude: [...(sharedConfig.exclude ?? []), 'test/node-proxy.test.ts'],
  },
})
