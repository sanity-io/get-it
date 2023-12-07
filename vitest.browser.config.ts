// Simulates a browser environment until `@vitest/browser` is ready for production and
// we can run the tests in a real browser

import {defineConfig} from 'vitest/config'

import pkg from './package.json'
import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    alias: {
      'get-it/middleware': new URL(pkg.exports['./middleware'].browser.source, import.meta.url)
        .pathname,
      'get-it': new URL(pkg.exports['.'].browser.source, import.meta.url).pathname,
    },
  },
  resolve: {
    conditions: ['browser', 'module', 'import'],
  },
})
