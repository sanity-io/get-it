import {createRequester, type FetchInit, type RequestOptions} from 'get-it'
import {retry} from 'get-it/middleware'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const url = 'https://example.com/stalled'

// Models transports whose buffered body reader does not react to aborts.
class PendingBodyResponse extends Response {
  override arrayBuffer = (): Promise<ArrayBuffer> => new Promise(() => {})
}

function observe(promise: Promise<unknown>) {
  const outcome: {settled: boolean; error?: unknown} = {settled: false}
  void promise.then(
    () => {
      outcome.settled = true
    },
    (error: unknown) => {
      outcome.settled = true
      outcome.error = error
    },
  )
  return outcome
}

describe('deadlines with an uncooperative transport', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each([false, true])('bounds a stalled body with caller signal: %s', async (withSignal) => {
    let init: FetchInit | undefined
    const request = createRequester({
      timeout: 50,
      fetch: async (_url, options) => {
        init = options
        return new PendingBodyResponse()
      },
    })
    const outcome = observe(
      request({
        url,
        signal: withSignal ? new AbortController().signal : undefined,
      }),
    )
    await vi.advanceTimersByTimeAsync(49)
    expect(outcome.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(outcome.error).toBeInstanceOf(DOMException)
    expect(outcome.error).toMatchObject({name: 'TimeoutError'})
    expect(init?.signal?.aborted).toBe(true)
    expect(outcome.error).toBe(init?.signal?.reason)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each<{as: RequestOptions['as']; status: number}>([
    {as: 'json', status: 200},
    {as: 'text', status: 200},
    {as: 'stream', status: 503},
  ])('bounds body buffering for $as with status $status', async ({as, status}) => {
    const request = createRequester({
      timeout: {headers: 20, total: 50},
      fetch: async () => new PendingBodyResponse(null, {status}),
    })
    const outcome = observe(request({url, as, signal: new AbortController().signal}))
    await vi.advanceTimersByTimeAsync(50)
    expect(outcome.error).toBeInstanceOf(DOMException)
    expect(outcome.error).toMatchObject({name: 'TimeoutError'})
  })

  it('bounds a fetch that ignores the total timeout before headers', async () => {
    const request = createRequester({timeout: 50, fetch: () => new Promise(() => {})})
    const outcome = observe(request(url))
    await vi.advanceTimersByTimeAsync(50)
    expect(outcome.error).toBeInstanceOf(DOMException)
    expect(outcome.error).toMatchObject({name: 'TimeoutError'})
  })

  it('does not restart the total deadline when headers arrive', async () => {
    const request = createRequester({
      timeout: 50,
      fetch: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(new PendingBodyResponse()), 40)
        }),
    })
    const outcome = observe(request(url))
    await vi.advanceTimersByTimeAsync(49)
    expect(outcome.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(outcome.error).toBeInstanceOf(DOMException)
    expect(outcome.error).toMatchObject({name: 'TimeoutError'})
  })

  it.each([false, true])(
    'handles late body settlement after timeout, rejecting: %s',
    async (rejectLate) => {
      class LateBodyResponse extends Response {
        override arrayBuffer = (): Promise<ArrayBuffer> =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              if (rejectLate) reject(new Error('late body failure'))
              else resolve(new ArrayBuffer(0))
            }, 100)
          })
      }
      const request = createRequester({timeout: 50, fetch: async () => new LateBodyResponse()})
      const outcome = observe(request(url))
      await vi.advanceTimersByTimeAsync(50)
      expect(outcome.error).toBeInstanceOf(DOMException)
      expect(outcome.error).toMatchObject({name: 'TimeoutError'})
      const error = outcome.error
      // A late body rejection must remain handled after the request rejects.
      await vi.advanceTimersByTimeAsync(50)
      expect(outcome.error).toBe(error)
    },
  )

  it('cancels a response that arrives after the total timeout', async () => {
    let cancelled = false
    const request = createRequester({
      timeout: 50,
      fetch: () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(
                  new ReadableStream({
                    cancel() {
                      cancelled = true
                    },
                  }),
                ),
              ),
            100,
          )
        }),
    })
    const outcome = observe(request(url))
    await vi.advanceTimersByTimeAsync(50)
    expect(outcome.error).toBeInstanceOf(DOMException)
    expect(outcome.error).toMatchObject({name: 'TimeoutError'})
    await vi.advanceTimersByTimeAsync(50)
    expect(cancelled).toBe(true)
  })

  it.each([false, true])(
    'honors caller cancellation with rejection-only timeout: %s',
    async (rejectionOnly) => {
      const controller = new AbortController()
      const reason = new Error('cancelled by caller')
      const added = vi.spyOn(controller.signal, 'addEventListener')
      const removed = vi.spyOn(controller.signal, 'removeEventListener')
      const request = createRequester({
        timeout: rejectionOnly ? {total: 1000, signal: false} : false,
        fetch: async () => new PendingBodyResponse(),
      })
      const outcome = observe(request({url, signal: controller.signal}))
      await vi.advanceTimersByTimeAsync(0)
      controller.abort(reason)
      await vi.advanceTimersByTimeAsync(0)
      expect(outcome.error).toBe(reason)
      expect(vi.getTimerCount()).toBe(0)
      expect(added.mock.calls.length).toBeGreaterThan(0)
      for (const [event, listener] of added.mock.calls) {
        expect(removed.mock.calls).toContainEqual([event, listener])
      }
    },
  )

  it.each<RequestOptions['as']>([undefined, 'stream'])(
    'removes abort listeners after a successful %s request',
    async (as) => {
      const controller = new AbortController()
      const added = vi.spyOn(controller.signal, 'addEventListener')
      const removed = vi.spyOn(controller.signal, 'removeEventListener')
      const request = createRequester({timeout: false, fetch: async () => new Response('ok')})
      const response = await request({url, as, signal: controller.signal})
      expect(response.status).toBe(200)
      expect(added.mock.calls.length).toBeGreaterThan(0)
      for (const [event, listener] of added.mock.calls) {
        expect(removed.mock.calls).toContainEqual([event, listener])
      }
      if (response.body instanceof ReadableStream) await response.body.cancel()
    },
  )

  it('supplies AbortError for an older signal without a reason', async () => {
    const controller = new AbortController()
    const request = createRequester({timeout: false, fetch: async () => new PendingBodyResponse()})
    const outcome = observe(request({url, signal: controller.signal}))
    await vi.advanceTimersByTimeAsync(0)
    Object.defineProperty(controller.signal, 'reason', {value: undefined})
    controller.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(outcome.error).toBeInstanceOf(DOMException)
    expect(outcome.error).toMatchObject({name: 'AbortError'})
  })

  it.each([null, 'cancelled', new Error('cancelled')])(
    'preserves a pre-aborted reason: %s',
    async (reason) => {
      const controller = new AbortController()
      controller.abort(reason)
      const request = createRequester({
        timeout: false,
        fetch: async () => new Response('ignored abort'),
      })
      await expect(request({url, signal: controller.signal})).rejects.toBe(reason)
    },
  )

  it('does not retry a total timeout while buffering', async () => {
    let attempts = 0
    const request = createRequester({
      timeout: 50,
      fetch: async () => {
        attempts++
        return new PendingBodyResponse()
      },
      middleware: [retry({maxRetries: 2, retryDelay: () => 0})],
    })
    const outcome = observe(request(url))
    await vi.advanceTimersByTimeAsync(150)
    expect(outcome.error).toBeInstanceOf(DOMException)
    expect(outcome.error).toMatchObject({name: 'TimeoutError'})
    expect(attempts).toBe(1)
  })
})
