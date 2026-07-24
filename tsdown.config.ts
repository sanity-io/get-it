import {defineConfig} from '@sanity/tsdown-config'
import type {UserConfig} from 'tsdown'

// Explicit `UserConfig` annotation keeps the default export's type portable
// (via the direct `tsdown` dependency); without it declaration emit can fail
// with TS2883 because `@sanity/tsdown-config` returns `tsdown`'s `UserConfig`.
const config: UserConfig = {
  ...(await defineConfig({
    tsconfig: './tsconfig.dist.json',
    entry: {
      'index': './src/_exports/index.ts',
      'index.node': './src/_exports/index.node.ts',
      'middleware': './src/_exports/middleware.ts',
      'node': './src/_exports/node.ts',
      'mock': './src/_exports/mock.ts',
      'vitest': './src/_exports/vitest.ts',
    },
    // Preserve the hand-written multi-condition exports map (node vs browser
    // dual entry under ".", plus react-server/deno/workerd/worker/bun).
    exports: false,
    // Optional peer — keep it external so the vitest entry doesn't bundle it.
    deps: {neverBundle: ['vitest']},
  })),
}

export default config
