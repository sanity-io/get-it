import {configDefaults, defineConfig, type UserConfig} from 'vitest/config'

export const sharedConfig = {
  // Ignore deno, esm, and archived v1 tests
  exclude: [...configDefaults.exclude, 'test-deno/*', 'test-esm/*', '_v1/**', '.claude/**'],
  globalSetup: [
    './test/helpers/globalSetup.http.ts',
    './test/helpers/globalSetup.https.ts',
    './test/helpers/globalSetup.proxy.http.ts',
    './test/helpers/globalSetup.proxy.https.ts',
  ],
  reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
  alias: {
    'get-it/middleware': new URL('./src/middleware', import.meta.url).pathname,
    'get-it/node': new URL('./src/node', import.meta.url).pathname,
    'get-it': new URL('./src', import.meta.url).pathname,
  },
} satisfies UserConfig['test']

export default defineConfig({
  test: sharedConfig,
})
