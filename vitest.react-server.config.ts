import {defineConfig} from 'vitest/config'

import pkg from './package.json'
import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    alias: {
      'get-it/middleware': pkg.exports['./middleware']['react-server'],
      'get-it': './src/index.react-server.ts',
    },
  },
  resolve: {
    conditions: ['react-server', 'node'],
  },
})
