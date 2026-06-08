import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  bundles: [
    {
      source: './src/_exports/vitest.ts',
      import: './dist/vitest.js',
    },
  ],
  externals: ['vitest'],
})
