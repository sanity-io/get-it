import {configDefaults, defineConfig, type ViteUserConfig} from 'vitest/config'

export const sharedConfig = {
  exclude: configDefaults.exclude,
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
    'get-it': new URL('./src/_exports', import.meta.url).pathname,
  },
} satisfies ViteUserConfig['test']

export default defineConfig({
  test: sharedConfig,
})
