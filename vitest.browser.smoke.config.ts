import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

import {builtPackageAlias, smokeConfig} from './vitest.config'

// Built-asset smoke test in real browsers, pinned to the fetch entry browsers resolve to (see
// test/exports.test.ts). Verifies the built fetch entry loads and runs in Chromium/Firefox/WebKit.
export default defineConfig({
  test: {
    ...smokeConfig,
    alias: builtPackageAlias('./dist/index.js'),
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
