import {configDefaults, defineConfig, type UserConfig} from 'vitest/config'
import GithubActionsReporter from 'vitest-github-actions-reporter'

import pkg from './package.json'

export const sharedConfig = {
  // Ignore deno, esm and next tests
  exclude: [...configDefaults.exclude, 'test-deno/*', 'test-esm/*', 'test-next/*'],
  globalSetup: [
    './test/helpers/globalSetup.http.ts',
    './test/helpers/globalSetup.https.ts',
    './test/helpers/globalSetup.proxy.http.ts',
    './test/helpers/globalSetup.proxy.https.ts',
  ],
  reporters: process.env.GITHUB_ACTIONS ? ['default', new GithubActionsReporter()] : 'default',
  alias: {
    'get-it/middleware': new URL(pkg.exports['./middleware'].source, import.meta.url).pathname,
    'get-it': new URL(pkg.exports['.'].source, import.meta.url).pathname,
  },
} satisfies UserConfig['test']

export default defineConfig({
  test: sharedConfig,
})
