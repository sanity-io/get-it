import {defineConfig} from '@sanity/tsdown-config'
import {mergeConfig, type UserConfig} from 'tsdown'

const config = await defineConfig({
  tsconfig: './tsconfig.dist.json',
  // Every module in src/_exports is a public entry named after its file
  // (index.node.ts → dist/index.node.js), so adding an entry is adding a file.
  entry: ['./src/_exports/*.ts'],
  exports: {
    // One dist-pointing map for every consumer, no dev/publish split. Nothing
    // in this repo consumes source through the exports map (the vitest suites
    // alias source explicitly, the editor resolves through tsconfig `paths`),
    // while the built-asset smoke suites depend on the map resolving dist:
    // with `devExports: true` the Deno smoke fails on the extensionless TS
    // imports in source, and the workerd smoke silently tests source instead
    // of built output (it keeps passing with dist/ deleted). A named
    // condition fares no better: with `devExports: 'development'` the
    // cloudflare pool resolves source too, because Vite's dev-mode resolution
    // activates the `development` condition.
    devExports: false,
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
})

export default mergeConfig(config, {
  plugins: [
    {
      name: 'type-only-chunk-js-stubs',
      generateBundle: {
        // `post` so this runs after rolldown-plugin-dts has settled the
        // emitted `.d.ts` files in the bundle.
        order: 'post',
        handler(_options, bundle) {
          // rolldown-plugin-dts writes declaration imports with `.js`
          // specifiers (`./types-<hash>.js`), relying on TypeScript's
          // `.js` → `.d.ts` substitution. Chunks whose runtime code was
          // merged into other chunks are type-only: the `.d.ts` exists but
          // the `.js` does not, and Deno's type-checker (CI / Test Deno)
          // resolves declaration imports literally, failing with TS2307.
          // Emit an inert `.js` stub next to each type-only chunk so every
          // emitted specifier resolves to a real file. The `@ts-self-types`
          // directive points Deno at the declaration file; everything else
          // ignores the comment (TypeScript resolves `./x.js` to `./x.d.ts`
          // before ever consulting the stub), and nothing imports the stubs
          // at runtime. Alternatives that don't work: rewriting the
          // specifiers to `.d.ts` is a tsc error (TS2846) for consumers with
          // `skipLibCheck: false`, and explicit `types` export conditions
          // don't help either — they only govern how the entry declaration
          // file is discovered, while these relative imports resolve inside
          // the declaration files without ever consulting the exports map
          // (verified against Deno 2.9.4).
          for (const fileName of Object.keys(bundle)) {
            if (!fileName.endsWith('.d.ts')) continue
            const jsFileName = `${fileName.slice(0, -'.d.ts'.length)}.js`
            if (jsFileName in bundle) continue
            const dtsBasename = fileName.slice(fileName.lastIndexOf('/') + 1)
            this.emitFile({
              type: 'asset',
              fileName: jsFileName,
              source:
                `// @ts-self-types="./${dtsBasename}"\n` +
                '// Type-only chunk: this stub only exists so the `.js` specifiers written\n' +
                '// in the emitted declaration files resolve for runtimes without `.d.ts`\n' +
                '// substitution (Deno type-checking). Never imported at runtime.\nexport {};\n',
            })
          }
        },
      },
    },
  ],
}) satisfies UserConfig
