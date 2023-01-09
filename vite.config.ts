import {defineConfig} from 'vitest/config'
import GithubActionsReporter from 'vitest-github-actions-reporter'

export default defineConfig({
  test: {
    deps: {interopDefault: true},
    reporters: process.env.GITHUB_ACTIONS ? ['default', new GithubActionsReporter()] : 'default',
    // Due to the testing server setup concurrency isn't supported
    threads: false,
  },
})
