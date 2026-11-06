import {createServer} from 'node:net'
import {inspect} from 'node:util'

import {createRequester, HttpError, type FetchFunction, type WrappingMiddleware} from 'get-it'
import {errorContext, isRetryableRequest} from 'get-it/middleware'
import {createNodeFetch} from 'get-it/node'
import {describe, expect, it} from 'vitest'

async function closedPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port')
  return address.port
}

const transports: {name: string; fetch: FetchFunction}[] = [
  {name: 'undici', fetch: createNodeFetch({proxy: false})},
  {name: 'native fetch', fetch: globalThis.fetch},
]

// Bun substitutes its own fetch and error shapes for undici.
describe.skipIf('Bun' in globalThis)('error context with real Node network failures', () => {
  it.each(transports)('keeps the connection-refused reason with $name', async ({fetch}) => {
    const port = await closedPort()
    // Use a single address so this does not depend on family-selection timing.
    const url = `http://127.0.0.1:${port}/missing?token=secret`
    let original: unknown
    let originalCause: unknown
    let retryable = false
    const observe: WrappingMiddleware = async (options, next) => {
      try {
        return await next(options)
      } catch (error: unknown) {
        original = error
        originalCause = error instanceof Error ? error.cause : undefined
        retryable = isRetryableRequest(error, 0, options)
        throw error
      }
    }
    const request = createRequester({fetch, timeout: 5000, middleware: [errorContext(), observe]})
    const error: unknown = await request(url).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(TypeError)
    if (!(error instanceof Error)) throw new Error('Expected the fetch failure', {cause: error})
    expect(error).toBe(original)
    expect(error.cause).toBe(originalCause)
    expect(error.message).toContain(`HTTP GET 127.0.0.1:${port}/missing?… failed: `)
    expect(error.message).toContain('ECONNREFUSED')
    expect(error.message).not.toContain('secret')
    expect(isRetryableRequest(error, 0, {url})).toBe(retryable)
  })

  it.each(transports)('updates the stack header while retaining $name frames', async ({fetch}) => {
    const port = await closedPort()
    let original: unknown
    let originalStack: string | undefined
    const observe: WrappingMiddleware = async (options, next) => {
      try {
        return await next(options)
      } catch (error: unknown) {
        original = error
        if (error instanceof Error) originalStack = error.stack
        throw error
      }
    }
    const request = createRequester({fetch, timeout: 5000, middleware: [errorContext(), observe]})
    const error: unknown = await request(`http://127.0.0.1:${port}/missing`).catch(
      (reason: unknown) => reason,
    )

    expect(error).toBeInstanceOf(TypeError)
    if (!(error instanceof Error)) throw new Error('Expected the fetch failure', {cause: error})
    expect(error).toBe(original)
    expect(originalStack).toMatch(/^TypeError: fetch failed(?:\n|$)/)
    expect(error.stack?.split('\n')[0]).toBe(`TypeError: ${error.message}`)
    expect(error.stack?.split('\n').slice(1)).toEqual(originalStack?.split('\n').slice(1))
    expect(inspect(error, {colors: false})).toContain(`TypeError: ${error.message}`)
  })

  it.each(transports)('redacts the target in real HTTP errors from $name', async ({fetch}) => {
    const url = 'http://localhost:9980/req-test/status?code=503&token=example-secret'
    const plain = createRequester({fetch, timeout: 5000})
    const contextual = createRequester({fetch, timeout: 5000, middleware: [errorContext()]})
    const original: unknown = await plain(url).catch((reason: unknown) => reason)
    const error: unknown = await contextual(url).catch((reason: unknown) => reason)

    expect(original).toBeInstanceOf(HttpError)
    expect(error).toBeInstanceOf(HttpError)
    if (!(original instanceof HttpError) || !(error instanceof HttpError)) {
      throw new Error('Expected HTTP response errors', {cause: {original, error}})
    }
    expect(original.message).toContain(url)
    expect(error.message).toContain('localhost:9980/req-test/status?…')
    expect(error.message).not.toContain('example-secret')
    expect(error.url).toBe(url)
    expect(error.status).toBe(503)
  })
})
