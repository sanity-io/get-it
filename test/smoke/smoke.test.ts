import {createRequester, isHttpError, isTimeoutError} from 'get-it'
import {errorContext, retry} from 'get-it/middleware'
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

test('the built errorContext middleware adds a template and socket cause', async () => {
  const cause = new Error('other side closed')
  const error = new TypeError('fetch failed', {cause})
  const request = createRequester({
    timeout: false,
    fetch: async () => {
      throw error
    },
    middleware: [errorContext()],
  })
  await expect(
    request({
      url: 'https://example.com/projects/private?token=secret',
      urlTemplate: '/projects/{id}',
    }),
  ).rejects.toBe(error)
  expect(error.message).toBe('HTTP GET /projects/{id} failed: other side closed')
  expect(error.cause).toBe(cause)
})

test('the built error guards resolve', () => {
  expect(typeof isHttpError).toBe('function')
  expect(typeof isTimeoutError).toBe('function')
})
