// Simulates a browser environment until `@vitest/browser` is ready for production and
// we can run the tests in a real browser

import {defineConfig} from 'vitest/config'

import pkg from './package.json'
import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    alias: {
      'get-it/middleware': pkg.exports['./middleware'].browser.source,
      'get-it': pkg.exports['.'].browser.source,
    },
  },
  resolve: {
    conditions: ['browser', 'module', 'import'],
  },
})
