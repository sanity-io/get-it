import {readFileSync} from 'node:fs'

import {defineConfig} from 'tsdown'

const pkg: unknown = JSON.parse(readFileSync('package.json', 'utf8'))
const exportsField = isRecord(pkg) ? pkg.exports : undefined

export default defineConfig({
  entry: entriesFromExports(exportsField),
  outDir: './dist',
  format: ['esm'],
  // Output .d.ts declaration files alongside the .js files
  dts: true,
  // Emit .js.map source maps; src is published so they resolve for consumers
  sourcemap: true,
  // Clean directories before build
  clean: true,
  // Mirror the source module structure in the output instead of extracting
  // hashed shared chunks, so each entry reads like the original source.
  unbundle: true,
  // Pure-ESM package (`"type": "module"`), so emit plain `.js`/`.d.ts`
  // extensions to match the paths declared in package.json `exports`.
  outExtensions: () => ({js: '.js', dts: '.d.ts'}),
  // ES2022 is the highest syntax level the source relies on (the binding
  // feature is `new Error(msg, {cause})`; `??=`, optional chaining and nullish
  // coalescing are older). At this target oxc emits the source as-authored with
  // no downleveling. Roughly: Node 18+, Chrome 94+, Firefox 93+, Safari 15.4+.
  target: 'es2022',
  // The library is isomorphic and its only platform-specific dependency
  // (undici, used by the node entry) is external, so no entry assumes a
  // runtime. The node entry could warrant `platform: 'node'`, but that is
  // per-build in tsdown and would only matter once it imports `node:` builtins.
  platform: 'neutral',
  // Type-checking is handled separately by the `typecheck` script, and the
  // declaration build mirrors that by using the dedicated dist tsconfig.
  tsconfig: './tsconfig.dist.json',
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Derives the tsdown entry map from the `source` conditions in package.json
 * `exports`, so the build always tracks the published entry points without a
 * second list to keep in sync.
 *
 * Each `source` is paired with its sibling `import`/`default` output path, and
 * the entry name is taken from that output's filename:
 * `./dist/index.node.js` → `index.node`.
 */
function entriesFromExports(exportsField: unknown): Record<string, string> {
  const entries: Record<string, string> = {}

  function walk(node: unknown): void {
    if (!isRecord(node)) return

    const source = node.source
    if (typeof source === 'string') {
      const output = typeof node.import === 'string' ? node.import : node.default
      if (typeof output === 'string') {
        const name = output.replace(/^\.\/dist\//, '').replace(/\.js$/, '')
        entries[name] = source
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'source' || key === 'import' || key === 'default') continue
      walk(value)
    }
  }

  walk(exportsField)
  return entries
}
