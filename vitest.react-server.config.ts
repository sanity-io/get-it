import {defineConfig} from 'vitest/config'

import pkg from './package.json'
import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    alias: {
      'get-it/middleware': new URL(pkg.exports['./middleware']['react-server'], import.meta.url)
        .pathname,
      'get-it': new URL('./src/index.react-server.ts', import.meta.url).pathname,
    },
  },
  resolve: {
    conditions: ['react-server', 'node'],
  },
})
