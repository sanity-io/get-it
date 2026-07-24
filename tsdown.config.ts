import {defineConfig} from '@sanity/tsdown-config'
import type {UserConfig} from 'tsdown'

export default defineConfig({
  tsconfig: './tsconfig.dist.json',
  // Every module in src/_exports is a public entry named after its file
  // (index.node.ts → dist/index.node.js), so adding an entry is adding a file.
  entry: ['./src/_exports/*.ts'],
  exports: {
    // Layer a `source` condition over dist-pointing dev exports (the layout
    // pkg-utils generated). Dev exports must keep resolving to dist: the
    // workerd smoke suite resolves the real exports map against built assets.
    devExports: 'source',
    customExports(exports) {
      // `index.node` is not a public subpath: it's the undici-backed variant
      // of `.` for runtimes with node built-ins, so fold it into the root
      // export as the `node`/`bun` conditions. Condition order is load-bearing
      // (resolvers pick the first active condition): the fetch-first runtimes
      // go before `node` because Node-flavored resolvers activate `node` too
      // (RSC on Node, Deno npm compat, wrangler with nodejs_compat), and
      // `node` goes before `default` so Node never falls through to the fetch
      // entry. Guarded by test/exports.test.ts.
      const fetchEntry = exports['.']
      const nodeEntry = exports['./index.node']
      delete exports['./index.node']
      exports['.'] = {
        'react-server': fetchEntry,
        'deno': fetchEntry,
        'workerd': fetchEntry,
        'worker': fetchEntry,
        'node': nodeEntry,
        'bun': nodeEntry,
        'default': fetchEntry,
      }
      return exports
    },
  },
  // Optional peer — keep it external so the vitest entry doesn't bundle it.
  deps: {neverBundle: ['vitest']},
}) satisfies Promise<UserConfig>
