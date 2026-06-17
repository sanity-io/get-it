import {defineConfig} from 'vitest/config'

import {builtPackageAlias, smokeConfig} from './vitest.config'

// Built-asset smoke test for React Server Components, pinned to the fetch entry that the
// `react-server` condition resolves to (see test/exports.test.ts).
export default defineConfig({
  test: {
    ...smokeConfig,
    alias: builtPackageAlias('./dist/index.js'),
  },
  resolve: {
    conditions: ['react-server', 'browser', 'module', 'import'],
  },
})
