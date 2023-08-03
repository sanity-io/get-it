import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  bundles: [
    {
      source: './src/index.react-server.ts',
      import: './dist/index.react-server.js',
    },
  ],
})
