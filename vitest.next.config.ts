import {configDefaults, defineConfig} from 'vitest/config'
import GithubActionsReporter from 'vitest-github-actions-reporter'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // Ignore all tests but the nextjs ones
    exclude: [...configDefaults.exclude, 'test-deno/*', 'test-esm/*', 'test/*'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', new GithubActionsReporter()] : 'default',
  },
})
