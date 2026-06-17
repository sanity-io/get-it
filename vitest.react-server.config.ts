import {defineConfig} from 'vitest/config'

import {nonNodeExclude, sharedConfig} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: nonNodeExclude,
  },
  resolve: {
    conditions: ['react-server', 'node'],
  },
})
