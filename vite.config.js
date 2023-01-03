import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // Due to the testing server setup concurrency isn't supported
    threads: false,
    deps: {
      interopDefault: true,
    },
  },
})
