import {defineConfig} from 'vitest/config'

import {builtPackageAlias, smokeConfig} from './vitest.config'

// Built-asset smoke test under the Bun runtime (run via `bun run vitest`), pinned to the
// undici-backed Node entry that the `bun` condition resolves to (see test/exports.test.ts) -
// the entry Bun consumers actually load. Verifies it loads and runs on Bun.
export default defineConfig({
  test: {
    ...smokeConfig,
    alias: builtPackageAlias('./dist/index.node.js'),
  },
})
