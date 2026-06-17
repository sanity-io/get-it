import {defineConfig} from 'vitest/config'

import {builtPackageAlias, smokeConfig} from './vitest.config'

// Built-asset smoke test in a browser-like (happy-dom) environment, pinned to the fetch entry
// browsers resolve to (see test/exports.test.ts).
export default defineConfig({
  test: {
    ...smokeConfig,
    environment: 'happy-dom',
    setupFiles: ['./test/helpers/suppress-noise.ts'],
    alias: builtPackageAlias('./dist/index.js'),
  },
})
