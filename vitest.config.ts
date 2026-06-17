import {configDefaults, defineConfig, type ViteUserConfig} from 'vitest/config'

// The built-asset smoke tests (test/smoke) resolve `get-it` through the real package.json
// `exports` map against `dist`, so they must NOT run under the source-alias suites below.
// They are run only by the dedicated `vitest.*.smoke.config.ts` configs.
export const baseExclude = [...configDefaults.exclude, 'test/smoke/**']

// Env suites that run against the source (browser/edge/worker/RSC) skip the Node-only tests.
export const nonNodeExclude = [...baseExclude, 'test/*.node.test.ts']

export const sharedConfig = {
  exclude: baseExclude,
  globalSetup: [
    './test/helpers/globalSetup.http.ts',
    './test/helpers/globalSetup.https.ts',
    './test/helpers/globalSetup.proxy.http.ts',
    './test/helpers/globalSetup.proxy.https.ts',
  ],
  reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
  alias: {
    'get-it/middleware': new URL('./src/_exports/middleware.ts', import.meta.url).pathname,
    'get-it/node': new URL('./src/_exports/node.ts', import.meta.url).pathname,
    'get-it/mock': new URL('./src/_exports/mock.ts', import.meta.url).pathname,
    'get-it/vitest': new URL('./src/_exports/vitest.ts', import.meta.url).pathname,
    'get-it': new URL('./src/_exports', import.meta.url).pathname,
  },
} satisfies ViteUserConfig['test']

// Base for built-asset smoke configs. No `globalSetup` (smoke tests inject their own fetch and
// never touch the test servers).
export const smokeConfig = {
  include: ['test/smoke/**/*.test.ts'],
  reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
} satisfies ViteUserConfig['test']

/**
 * Aliases the `get-it` specifiers to the built `dist` entry a given runtime resolves to.
 *
 * Vite's resolver runs in Node, which always injects the `node` export condition, so non-pool
 * smoke environments (edge-runtime, happy-dom, RSC, Bun) cannot resolve the runtime's real entry
 * by conditions alone. We pin the entry explicitly instead; `test/exports.test.ts` is the
 * faithful guard for *which* entry each runtime's condition set actually selects. The workerd
 * smoke config does not use this - the cloudflare pool excludes `node` and resolves faithfully.
 */
export function builtPackageAlias(main: './dist/index.js' | './dist/index.node.js') {
  return {
    'get-it/middleware': new URL('./dist/middleware.js', import.meta.url).pathname,
    'get-it': new URL(main, import.meta.url).pathname,
  }
}

export default defineConfig({
  test: sharedConfig,
})
