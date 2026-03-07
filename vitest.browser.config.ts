import {defineConfig} from 'vitest/config'

import {sharedConfig} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    environment: 'happy-dom',
  },
})
