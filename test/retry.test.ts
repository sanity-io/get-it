import {describe, expect, it} from 'vitest'

import {createRequest} from '../src/index'
import {retry} from '../src/middleware/retry'

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
})
