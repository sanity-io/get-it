import {defineConfig} from 'vitest/config'

import {nonNodeExclude, sharedConfig} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: nonNodeExclude,
    environment: 'happy-dom',
    setupFiles: ['./test/helpers/suppress-noise.ts'],
  },
})
