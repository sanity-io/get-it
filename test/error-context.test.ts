import {createRequester, TimeoutError, type RequesterOptions, type RequestOptions} from 'get-it'
import {errorContext, isRetryableRequest, retry} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

const url = 'https://example.com/test'
const target = 'example.com/test'

function createContextRequester(options: RequesterOptions) {
  return createRequester({...options, middleware: [...(options.middleware ?? []), errorContext()]})
}

describe('error context middleware', () => {
  it('leaves fetch failures unchanged unless error context is enabled', async () => {
    const error = new TypeError('fetch failed', {cause: new Error('read ECONNRESET')})
    const request = createRequester({
      fetch: async () => {
        throw error
      },
    })
    await expect(request({url, urlTemplate: '/test'})).rejects.toBe(error)
    expect(error.message).toBe('fetch failed')
  })

  it.each([
    {message: 'read ECONNRESET', code: 'ECONNRESET'},
    {message: 'other side closed', code: 'UND_ERR_SOCKET'},
  ])('includes the socket cause: $message', async ({message, code}) => {
    const cause = Object.assign(new Error(message), {code})
    const error = new TypeError('fetch failed', {cause})
    const stack = error.stack
    const request = createContextRequester({
      fetch: async () => {
        throw error
      },
    })

    await expect(request(url)).rejects.toBe(error)
    expect(error.message).toBe(`HTTP GET ${target} failed: ${message}`)
    expect(error.cause).toBe(cause)
    expect(cause.message).toBe(message)
    expect(error.stack).toBe(stack)
  })

  it.each<RequestOptions>([
    {url},
    {url, as: 'json'},
    {url, as: 'text'},
    {url, as: 'stream'},
    {url, timeout: {headers: 1000}},
    {url, timeout: {total: 1000, signal: false}},
  ])('includes context for request options %j', async (options) => {
    const request = createContextRequester({
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })

    await expect(request(options)).rejects.toThrow(`HTTP GET ${target} failed: Failed to fetch`)
  })

  it('uses the method and URL sent to fetch after middleware and query parameters', async () => {
    const request = createContextRequester({
      base: 'https://example.com',
      middleware: [{beforeRequest: (options) => ({...options, method: 'post'})}],
      fetch: () => {
        throw new Error('connection lost')
      },
    })

    await expect(request({url: '/test', query: {page: 2}})).rejects.toThrow(
      'HTTP POST example.com/test?… failed: connection lost',
    )
  })

  it('does not accumulate context when fetch reuses an error across requests', async () => {
    const error = new TypeError('Failed to fetch')
    const request = createContextRequester({
      fetch: async () => {
        throw error
      },
      middleware: [retry({maxRetries: 1, retryDelay: () => 0})],
    })

    await expect(request(url)).rejects.toThrow(`HTTP GET ${target} failed: Failed to fetch`)
    await expect(request({url: `${url}/other`, method: 'HEAD'})).rejects.toThrow(
      `HTTP HEAD ${target}/other failed: Failed to fetch`,
    )
  })

  it('reports the implicit POST method for a request body', async () => {
    const request = createContextRequester({
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })

    await expect(request({url, body: 'payload'})).rejects.toThrow(
      `HTTP POST ${target} failed: Failed to fetch`,
    )
  })

  it('falls back to the fetch message when the cause has no message', async () => {
    const request = createContextRequester({
      fetch: async () => {
        throw new TypeError('fetch failed', {cause: new Error()})
      },
    })

    await expect(request(url)).rejects.toThrow(`HTTP GET ${target} failed: fetch failed`)
  })

  it('redacts query values in the message without changing the fetch URL', async () => {
    const longUrl = `${url}?query=${'x'.repeat(500)}`
    let requestedUrl: string | undefined
    const request = createContextRequester({
      fetch: async (input) => {
        requestedUrl = input
        throw new TypeError('Failed to fetch')
      },
    })

    await expect(request(longUrl)).rejects.toThrow(
      'HTTP GET example.com/test?… failed: Failed to fetch',
    )
    expect(requestedUrl).toBe(longUrl)
  })

  it.each([
    new TypeError('Failed to fetch'),
    Object.assign(new Error('reset'), {code: 'ECONNRESET'}),
    new TypeError('fetch failed', {
      cause: Object.assign(new Error('reset'), {code: 'ECONNRESET'}),
    }),
    new TypeError('fetch failed', {
      cause: Object.assign(new Error('certificate'), {code: 'ERR_TLS_CERT_ALTNAME_INVALID'}),
    }),
    Object.assign(new Error('transient'), {retryable: true}),
    Object.assign(new TypeError('permanent'), {retryable: false}),
    new Error('unclassified'),
  ])('preserves retry classification for %s', async (error) => {
    const retryable = isRetryableRequest(error, 0, {url})
    let attempts = 0
    const request = createContextRequester({
      fetch: async () => {
        attempts++
        throw error
      },
      middleware: [
        retry({
          maxRetries: 1,
          retryDelay: () => 0,
          shouldRetry: (received, attempt, options) => {
            expect(received).toBe(error)
            return isRetryableRequest(received, attempt, options)
          },
        }),
      ],
    })

    await expect(request(url)).rejects.toBe(error)
    expect(attempts).toBe(retryable ? 2 : 1)
    expect(isRetryableRequest(error, 0, {url})).toBe(retryable)
    expect(isRetryableRequest(error, 0, {url, method: 'POST'})).toBe(false)
    expect(error.message).toContain(`HTTP GET ${target} failed: `)
  })

  it.each([new TypeError('cancelled'), new Error('cancelled'), 'cancelled', null])(
    'preserves the caller abort reason %s',
    async (reason) => {
      const controller = new AbortController()
      const message = reason instanceof Error ? reason.message : undefined
      const request = createContextRequester({
        fetch: async () => {
          controller.abort(reason)
          throw reason
        },
      })

      await expect(request({url, signal: controller.signal})).rejects.toBe(reason)
      if (reason instanceof Error) expect(reason.message).toBe(message)
    },
  )

  it.each([
    new DOMException('aborted', 'AbortError'),
    new DOMException('deadline', 'TimeoutError'),
    new TimeoutError({url, method: 'GET', timeoutMs: 10, phase: 'headers'}),
    Object.assign(new Error('HTTP failure'), {name: 'HttpError'}),
    Object.freeze(new TypeError('read-only message')),
    'non-error rejection',
  ])('preserves special or immutable rejection %s', async (reason) => {
    const message = reason instanceof Error ? reason.message : undefined
    const request = createContextRequester({
      fetch: async () => {
        throw reason
      },
    })

    await expect(request(url)).rejects.toBe(reason)
    if (reason instanceof Error) expect(reason.message).toBe(message)
  })

  it('adds context to response body failures while preserving their identity', async () => {
    const error = new TypeError('body read failed')
    const readBody = async () => {
      throw error
    }
    const request = createContextRequester({
      fetch: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        url,
        redirected: false,
        body: null,
        text: readBody,
        arrayBuffer: readBody,
      }),
    })

    await expect(request(url)).rejects.toBe(error)
    expect(error.message).toBe('HTTP GET example.com/test failed: body read failed')
  })

  it.each(['inside', 'outside'])(
    'preserves retries with context %s retry middleware',
    async (order) => {
      const context = errorContext()
      const retries = retry({maxRetries: 1, retryDelay: () => 0})
      const error = new TypeError('fetch failed', {
        cause: Object.assign(new Error('read ECONNRESET'), {code: 'ECONNRESET'}),
      })
      let attempts = 0
      const request = createRequester({
        fetch: async () => {
          if (++attempts === 1) throw error
          return new Response('recovered')
        },
        middleware: order === 'inside' ? [retries, context] : [context, retries],
      })
      expect((await request(url)).text()).toBe('recovered')
      expect(attempts).toBe(2)
    },
  )
})
