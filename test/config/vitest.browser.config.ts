import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

import {nonNodeExclude, sharedConfig} from '../../vitest.config'

const {globalSetup, ...browserSharedConfig} = sharedConfig

export default defineConfig({
  test: {
    ...browserSharedConfig,
    exclude: nonNodeExclude,
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
