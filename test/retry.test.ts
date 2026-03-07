import {createRequest} from 'get-it'
import {retry} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {defaultRetryDelay} from '../src/middleware/retry'

const baseUrl = 'http://localhost:9980/req-test'

describe('retry middleware', {timeout: 15000}, () => {
  it('retries on network error and succeeds', async () => {
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({retryDelay: () => 50})],
    })
    const res = await request(`/fail?uuid=${Math.random()}&n=2`)
    expect(res.status).toBe(200)
  })

  it('respects maxRetries', async () => {
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

  it('custom shouldRetry', async () => {
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

  it('exponential backoff timing', async () => {
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

  it('aborts during retry sleep when signal is aborted', async () => {
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

  it('uses default retryDelay when none is provided', async () => {
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({maxRetries: 1})],
    })
    const res = await request(`/fail?uuid=${Math.random()}&n=1`)
    expect(res.status).toBe(200)
  })

  it('rejects immediately when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort('cancelled')
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({retryDelay: () => 5000})],
    })
    await expect(request({url: '/permafail', signal: controller.signal})).rejects.toThrow()
  })

  it('does not retry POST by default', async () => {
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({retryDelay: () => 10})],
    })
    await expect(
      request({url: `/fail?uuid=${Math.random()}&n=2`, method: 'POST', body: 'hello'}),
    ).rejects.toThrow()
  })

  it('retries HEAD requests on network error', async () => {
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

  it('retries when method is lowercase "get"', async () => {
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

  it('does not retry lowercase "post"', async () => {
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
})
