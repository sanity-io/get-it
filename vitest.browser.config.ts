import {playwright} from '@vitest/browser-playwright'
import {configDefaults, defineConfig} from 'vitest/config'

import {sharedConfig} from './vitest.config'

const {globalSetup, ...browserSharedConfig} = sharedConfig

export default defineConfig({
  test: {
    ...browserSharedConfig,
    exclude: [...configDefaults.exclude, 'test/*.node.test.ts'],
    globalSetup,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {browser: 'chromium', headless: true},
        {browser: 'firefox', headless: true},
        {browser: 'webkit', headless: true},
      ],
    },
  },
})
