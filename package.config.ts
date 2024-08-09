import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  bundles: [
    {
      source: './src/index.react-server.ts',
      import: './dist/index.react-server.js',
    },
  ],
  // Setting up Terser here to workaround a issue where Next.js fails to import from a ESM file that has a reference to `module.exports` somewhere in the file:
  // https://github.com/vercel/next.js/issues/57962
  // By enabling minification the problematic reference is changed so the issue is avoided.
  // The reason this happens is because we're inlining the `debug` module, which is CJS only. We can't stop inlining this module as it breaks Hydrogen compatibility.
  minify: true,
})
