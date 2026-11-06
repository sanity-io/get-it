import {strict as assert} from 'node:assert'

import {createRequester, HttpError, type WrappingMiddleware} from 'get-it'
import {errorContext, isRetryableRequest} from 'get-it/middleware'

Deno.test('real Deno network failures retain their platform detail and update only the stack header', async () => {
  const listener = Deno.listen({hostname: '127.0.0.1', port: 0})
  const port = listener.addr.port
  listener.close()
  // Exercise Deno's normalization of the host and path in its error message.
  const url = `http://LOCALHOST:${port}/folder/../x?token=example-secret`
  let original: unknown
  let originalMessage = ''
  let originalStack: string | undefined
  let originalCause: unknown
  let retryable = false
  const observe: WrappingMiddleware = async (options, next) => {
    try {
      return await next(options)
    } catch (error: unknown) {
      original = error
      if (error instanceof Error) {
        originalMessage = error.message
        originalStack = error.stack
        originalCause = error.cause
      }
      retryable = isRetryableRequest(error, 0, options)
      throw error
    }
  }
  const request = createRequester({timeout: 5000, middleware: [errorContext(), observe]})
  const error: unknown = await request({url, urlTemplate: '/x'}).catch((reason: unknown) => reason)

  assert(error instanceof TypeError, 'Expected a real fetch failure')
  assert.equal(error, original)
  assert.equal(error.cause, originalCause)
  assert.match(originalMessage, /error sending request for url/)
  assert(
    originalMessage.includes(new URL(url).href),
    'Deno includes the normalized URL in its detail',
  )
  assert.equal(error.message, `HTTP GET /x failed: ${originalMessage}`)
  // The target is safe, but the retained platform detail still contains query values.
  assert(error.message.includes('token=example-secret'))
  assert.equal(error.stack?.split('\n')[0], `TypeError: ${error.message}`)
  assert.deepEqual(error.stack?.split('\n').slice(1), originalStack?.split('\n').slice(1))
  assert.equal(isRetryableRequest(error, 0, {url}), retryable)
})

Deno.test('real Deno HTTP errors use a safer target with errorContext than with core alone', async () => {
  const server = Deno.serve(
    {hostname: '127.0.0.1', port: 0, onListen() {}},
    () => new Response('unavailable', {status: 503, headers: {connection: 'close'}}),
  )
  try {
    const url = `http://127.0.0.1:${server.addr.port}/x?token=example-secret`
    const plain = createRequester({timeout: 5000})
    const contextual = createRequester({timeout: 5000, middleware: [errorContext()]})
    const original: unknown = await plain(url).catch((reason: unknown) => reason)
    const error: unknown = await contextual(url).catch((reason: unknown) => reason)
    assert(original instanceof HttpError, 'Expected a core HTTP error')
    assert(error instanceof HttpError, 'Expected a contextual HTTP error')
    assert(original.message.includes(url))
    assert(error.message.includes(`127.0.0.1:${server.addr.port}/x?…`))
    assert(!error.message.includes('example-secret'))
    assert.equal(error.url, url)
    assert.equal(error.status, 503)
  } finally {
    await server.shutdown()
  }
})
