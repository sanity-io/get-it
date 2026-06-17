import {defineConfig} from 'vitest/config'

import {builtPackageAlias, smokeConfig} from './vitest.config'

// Built-asset smoke test on the Vercel Edge runtime, pinned to the fetch entry that the
// edge-light condition set resolves to (see test/exports.test.ts). Verifies the built fetch
// entry loads and runs under edge-runtime.
export default defineConfig({
  test: {
    ...smokeConfig,
    environment: 'edge-runtime',
    alias: builtPackageAlias('./dist/index.js'),
  },
})
