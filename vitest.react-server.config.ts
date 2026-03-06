import {defineConfig} from 'vitest/config'

import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: [...(sharedConfig.exclude ?? []), 'test/node-proxy.test.ts'],
  },
  resolve: {
    conditions: ['react-server', 'node'],
  },
})
