import {configDefaults, defineConfig, type UserConfig} from 'vitest/config'
import GithubActionsReporter from 'vitest-github-actions-reporter'

import pkg from './package.json'

export const sharedConfig = {
  // Ignore deno and esm tests
  exclude: [...configDefaults.exclude, 'test-deno/*', 'test-esm/*'],
  globalSetup: [
    './test/helpers/globalSetup.http.ts',
    './test/helpers/globalSetup.https.ts',
    './test/helpers/globalSetup.proxy.http.ts',
    './test/helpers/globalSetup.proxy.https.ts',
  ],
  reporters: process.env.GITHUB_ACTIONS ? ['default', new GithubActionsReporter()] : 'default',
  alias: {
    'get-it/middleware': pkg.exports['./middleware'].source,
    'get-it': pkg.exports['.'].source,
  },
} satisfies UserConfig['test']

export default defineConfig({
  test: sharedConfig,
})
