import {describe, expect, test} from 'vitest'

import pkg from '../package.json'

/**
 * Faithful packaging-resolution guard.
 *
 * The runtime test pools cannot catch entry-resolution bugs: `@cloudflare/vitest-pool-workers`
 * explicitly *excludes* the `node` condition, so a workerd runtime test always resolves the
 * fetch entry even though real wrangler with `nodejs_compat` enabled *includes* `node` and would
 * resolve the Node entry (pulling in undici).
 *
 * This test resolves the published `exports` map directly against the exact condition set each
 * target runtime uses - including the `node`-inclusive wrangler case - and asserts which entry
 * wins. It reads `package.json` only; it never imports built code, so it runs in the regular
 * suite without a build step.
 */

type ExportsNode = string | {[condition: string]: ExportsNode}

function isConditions(node: ExportsNode): node is {[condition: string]: ExportsNode} {
  return typeof node !== 'string'
}

/**
 * Resolve an `exports` subtree against an explicit, exclusive set of active conditions.
 * Conditions are matched in key order, first match wins - exactly how Node and bundlers
 * resolve conditional exports. Unlike Node's own resolver, this does NOT implicitly add the
 * `node` condition, so we can model non-Node runtimes faithfully.
 */
function resolveExports(node: ExportsNode, conditions: Set<string>): string | null {
  if (!isConditions(node)) return node
  for (const key of Object.keys(node)) {
    if (key === 'default' || conditions.has(key)) {
      const resolved = resolveExports(node[key], conditions)
      if (resolved !== null) return resolved
    }
  }
  return null
}

const exportsMap: ExportsNode = pkg.exports

function resolve(subpath: string, conditions: string[]): string | null {
  const entry = isConditions(exportsMap) ? exportsMap[subpath] : null
  if (entry === undefined || entry === null) return null
  // The `source` condition points at TypeScript and is only used by bundlers consuming
  // from source; published runtime resolution must never select it.
  return resolveExports(entry, new Set(conditions))
}

const FETCH_ENTRY = './dist/index.js'
const NODE_ENTRY = './dist/index.node.js'

describe('package exports resolution', () => {
  // The runtimes that must NOT pull in the undici-backed Node entry. Each array is the
  // exclusive set of conditions that runtime's resolver activates in production.
  const fetchRuntimes: Record<string, string[]> = {
    'wrangler + nodejs_compat': ['workerd', 'worker', 'browser', 'module', 'import', 'node'],
    'wrangler (no nodejs_compat)': ['workerd', 'worker', 'browser', 'module', 'import'],
    'vitest-pool-workers': ['workerd', 'worker', 'module', 'browser', 'import'],
    'vercel edge-light': ['edge-light', 'worker', 'browser', 'module', 'import'],
    'react-server (RSC)': ['react-server', 'browser', 'module', 'import'],
    'deno': ['deno', 'import'],
    'browser': ['browser', 'module', 'import'],
  }

  for (const [name, conditions] of Object.entries(fetchRuntimes)) {
    test(`"." resolves to the fetch entry on ${name}`, () => {
      expect(resolve('.', conditions)).toBe(FETCH_ENTRY)
    })
  }

  // The runtimes that intentionally use the undici-backed Node entry.
  const nodeRuntimes: Record<string, string[]> = {
    node: ['node', 'import'],
    bun: ['bun', 'import', 'node'],
  }

  for (const [name, conditions] of Object.entries(nodeRuntimes)) {
    test(`"." resolves to the Node entry on ${name}`, () => {
      expect(resolve('.', conditions)).toBe(NODE_ENTRY)
    })
  }

  test('the "node" condition is ordered before the fetch fallback', () => {
    // Regression guard for the original bug: a worker-like runtime that also activates the
    // `node` condition (wrangler + nodejs_compat) must still land on the fetch entry, which is
    // only true while a `workerd`/`worker` condition precedes `node` in the exports map.
    const dot = isConditions(exportsMap) ? exportsMap['.'] : null
    if (dot === null || !isConditions(dot)) throw new Error('exports["."] must be a conditions map')
    const keys = Object.keys(dot)
    const workerIndex = Math.min(
      keys.indexOf('workerd') === -1 ? Infinity : keys.indexOf('workerd'),
      keys.indexOf('worker') === -1 ? Infinity : keys.indexOf('worker'),
    )
    expect(workerIndex).toBeLessThan(keys.indexOf('node'))
  })
})
