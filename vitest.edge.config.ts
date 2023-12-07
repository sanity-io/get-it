import {defineConfig} from 'vitest/config'

import pkg from './package.json'
import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    environment: 'edge-runtime',
    alias: {
      'get-it/middleware': new URL(pkg.exports['./middleware'].browser.source, import.meta.url)
        .pathname,
      'get-it': new URL(pkg.exports['.'].browser.source, import.meta.url).pathname,
    },
  },
  resolve: {
    // https://github.com/vercel/next.js/blob/95322649ffb2ad0d6423481faed188dd7b1f7ff2/packages/next/src/build/webpack-config.ts#L1079-L1084
    conditions: ['edge-light', 'worker', 'browser', 'module', 'import', 'node'],
  },
})
