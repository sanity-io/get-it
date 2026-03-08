import {configDefaults, defineConfig} from 'vitest/config'

import {sharedConfig} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: [...configDefaults.exclude, 'test/*.node.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['./test/helpers/suppress-noise.ts'],
  },
})
