import {defineConfig} from 'vitest/config'

import {builtPackageAlias, smokeConfig} from './vitest.config'

// Built-asset smoke test in a browser-like (jsdom) environment, pinned to the fetch entry
// browsers resolve to (see test/exports.test.ts).
export default defineConfig({
  test: {
    ...smokeConfig,
    environment: 'jsdom',
    alias: builtPackageAlias('./dist/index.js'),
  },
})
