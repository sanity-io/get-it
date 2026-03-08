import {createRequest, type RequestOptions} from 'get-it'
import {retry} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {defaultRetryDelay, defaultShouldRetry} from '../src/middleware/retry'

const baseUrl = 'http://localhost:9980/req-test'

/**
 * Tests that rely on `res.destroy()` producing application-visible network errors
 * only work outside browsers. Browsers transparently retry TCP resets per the
 * Fetch spec (the network stack retries before our code sees an error), making
 * retry-middleware behavior untestable for server-initiated connection closures.
 */
const canTestNetworkErrors = !('document' in globalThis)

describe('retry middleware', {timeout: 15000}, () => {
  it.runIf(canTestNetworkErrors)('retries on network error and succeeds', async () => {
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({retryDelay: () => 50})],
    })
    const res = await request(`/fail?uuid=${Math.random()}&n=2`)
    expect(res.status).toBe(200)
  })

  it.runIf(canTestNetworkErrors)('respects maxRetries', async () => {
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({maxRetries: 1, retryDelay: () => 10})],
    })
    await expect(request('/permafail')).rejects.toThrow()
  })

  it('does not retry HTTP errors by default', async () => {
    let attempts = 0
    const request = createRequest({
      base: baseUrl,
      middleware: [
        async (opts, next) => {
          attempts++
          return next(opts)
        },
        retry({retryDelay: () => 10}),
      ],
    })
    await expect(request('/status?code=500')).rejects.toThrow()
    expect(attempts).toBe(1)
  })

  it.runIf(canTestNetworkErrors)('custom shouldRetry', async () => {
    let attemptsSeen = 0
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [
        retry({
          retryDelay: () => 10,
          shouldRetry: (_error, attemptNumber) => {
            attemptsSeen = attemptNumber + 1
            return attemptNumber < 1
          },
        }),
      ],
    })
    await expect(request('/permafail')).rejects.toThrow()
    expect(attemptsSeen).toBe(2)
  })

  it.runIf(canTestNetworkErrors)('exponential backoff timing', async () => {
    const delays: number[] = []
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [
        retry({
          retryDelay: (attempt) => {
            const delay = 50 * (attempt + 1)
            delays.push(delay)
            return delay
          },
        }),
      ],
    })
    const start = Date.now()
    const res = await request(`/fail?uuid=${Math.random()}&n=4`)
    const elapsed = Date.now() - start
    expect(res.status).toBe(200)
    expect(delays).toHaveLength(3)
    // 50 + 100 + 150 = 300ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(250)
  })

  it.runIf(canTestNetworkErrors)('aborts during retry sleep when signal is aborted', async () => {
    const controller = new AbortController()
    let attempts = 0
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [
        async (opts, next) => {
          attempts++
          return next(opts)
        },
        retry({retryDelay: () => 5000}),
      ],
    })

    const promise = request({url: '/permafail', signal: controller.signal})
    // Wait long enough for first attempt to fail and retry sleep to start
    await new Promise((r) => setTimeout(r, 200))
    controller.abort()

    await expect(promise).rejects.toThrow()
    // Should have made only 1 attempt — abort during sleep prevents second attempt
    expect(attempts).toBe(1)
  })

  it('defaultRetryDelay returns exponential backoff with jitter', () => {
    const delay0 = defaultRetryDelay(0)
    expect(delay0).toBeGreaterThanOrEqual(100)
    expect(delay0).toBeLessThan(200)

    const delay2 = defaultRetryDelay(2)
    expect(delay2).toBeGreaterThanOrEqual(400)
    expect(delay2).toBeLessThan(500)
  })

  it.runIf(canTestNetworkErrors)('uses default retryDelay when none is provided', async () => {
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({maxRetries: 1})],
    })
    const res = await request(`/fail?uuid=${Math.random()}&n=1`)
    expect(res.status).toBe(200)
  })

  it.runIf(canTestNetworkErrors)('rejects immediately when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort('cancelled')
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({retryDelay: () => 5000})],
    })
    await expect(request({url: '/permafail', signal: controller.signal})).rejects.toThrow()
  })

  it.runIf(canTestNetworkErrors)('does not retry POST by default', async () => {
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({retryDelay: () => 10})],
    })
    await expect(
      request({url: `/fail?uuid=${Math.random()}&n=2`, method: 'POST', body: 'hello'}),
    ).rejects.toThrow()
  })

  it.runIf(canTestNetworkErrors)('retries HEAD requests on network error', async () => {
    let attempts = 0
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [
        retry({retryDelay: () => 50}),
        async (opts, next) => {
          attempts++
          return next(opts)
        },
      ],
    })
    const res = await request({url: `/fail?uuid=${Math.random()}&n=2`, method: 'HEAD'})
    expect(res.status).toBe(200)
    expect(attempts).toBeGreaterThan(1)
  })

  it.runIf(canTestNetworkErrors)('retries when method is lowercase "get"', async () => {
    let attempts = 0
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [
        retry({retryDelay: () => 50}),
        async (opts, next) => {
          attempts++
          return next(opts)
        },
      ],
    })
    const res = await request({url: `/fail?uuid=${Math.random()}&n=2`, method: 'get'})
    expect(res.status).toBe(200)
    expect(attempts).toBeGreaterThan(1)
  })

  it.runIf(canTestNetworkErrors)('does not retry lowercase "post"', async () => {
    let attempts = 0
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [
        retry({retryDelay: () => 10}),
        async (opts, next) => {
          attempts++
          return next(opts)
        },
      ],
    })
    await expect(
      request({url: `/fail?uuid=${Math.random()}&n=2`, method: 'post', body: 'x'}),
    ).rejects.toThrow()
    expect(attempts).toBe(1)
  })

  describe('defaultShouldRetry error filtering', () => {
    const getOpts = {url: 'http://example.com', method: 'GET'} satisfies RequestOptions

    it('retries transient network error codes', () => {
      for (const code of ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND']) {
        const err = Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('connect failed'), {code}),
        })
        expect(defaultShouldRetry(err, 0, getOpts)).toBe(true)
      }
    })

    it('does not retry non-transient error codes', () => {
      for (const code of ['EACCES', 'EPERM', 'ENOENT', 'ERR_TLS_CERT_ALTNAME_INVALID']) {
        const err = Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('connect failed'), {code}),
        })
        expect(defaultShouldRetry(err, 0, getOpts)).toBe(false)
      }
    })

    it('retries plain TypeError (browser network error)', () => {
      expect(defaultShouldRetry(new TypeError('Failed to fetch'), 0, getOpts)).toBe(true)
    })

    it('does not retry HttpError', () => {
      const err = new Error('HTTP 500')
      err.name = 'HttpError'
      expect(defaultShouldRetry(err, 0, getOpts)).toBe(false)
    })

    it('does not retry non-GET/HEAD methods', () => {
      const err = new TypeError('Failed to fetch')
      expect(defaultShouldRetry(err, 0, {url: 'http://example.com', method: 'POST'})).toBe(false)
      expect(defaultShouldRetry(err, 0, {url: 'http://example.com', method: 'PUT'})).toBe(false)
    })

    it('retries error with code directly on error object', () => {
      const err = Object.assign(new TypeError('fetch failed'), {code: 'ECONNRESET'})
      expect(defaultShouldRetry(err, 0, getOpts)).toBe(true)
    })
  })
})
