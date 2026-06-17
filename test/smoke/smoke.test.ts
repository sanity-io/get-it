import {createRequester} from 'get-it'
import {retry} from 'get-it/middleware'
import {expect, test} from 'vitest'

/**
 * Built-asset smoke test, run against the published `dist` (no source alias) in
 * each target runtime. Its job is to prove that the entry the runtime's resolver
 * actually selects from the package.json `exports` map loads, initializes, and
 * runs a request through the middleware pipeline.
 *
 * A `fetch` is injected so the test is deterministic and free of network or
 * `data:`-URL support differences across runtimes - the resolution and module
 * initialization is what we are exercising here, not the runtime's own fetch.
 */
test('the built get-it package resolves and runs a request', async () => {
  const request = createRequester({
    timeout: false,
    fetch: () => Promise.resolve(new Response('hello from the built package', {status: 200})),
  })

  const response = await request({url: 'https://example.com/', as: 'text'})

  expect(response.body).toBe('hello from the built package')
})

test('the built get-it/middleware subpath resolves', () => {
  expect(typeof retry).toBe('function')
})
