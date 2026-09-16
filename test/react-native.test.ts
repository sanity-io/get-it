import {describe, expect, it} from 'vitest'

import {createRequester} from '../src/_exports/index.react-native'
import {createRequester as createCoreRequester} from '../src/createRequester'
import {TimeoutError} from '../src/errors'
import {retry} from '../src/middleware/retry'
import {wrapReactNativeFetch} from '../src/reactNativeFetch'
import type {FetchFunction} from '../src/types'

class FetchError extends Error {}

const url = 'https://example.com/test'
const retries = () => retry({maxRetries: 2, retryDelay: () => 0})

// Expo's fetch loses the signal's reason when native cancellation rejects.
const opaqueAbortFetch: FetchFunction = (_input, init) =>
  new Promise((_resolve, reject) => {
    const abort = () => reject(new FetchError('fetch failed: canceled'))
    if (init?.signal?.aborted) abort()
    else init?.signal?.addEventListener('abort', abort, {once: true})
  })

describe('React Native fetch compatibility', () => {
  it('uses the global fetch when no override is supplied', async () => {
    const request = createRequester({base: 'http://localhost:9980/req-test'})
    expect((await request('/plain-text')).status).toBe(200)
  })

  it.each([Error, FetchError])(
    'retries %s fetch failures and keeps the original cause',
    async (ErrorClass) => {
      let attempts = 0
      const original = new ErrorClass('fetch failed: connection lost')
      const request = createRequester({
        fetch: async () => {
          attempts++
          throw original
        },
        middleware: [retries()],
      })
      await expect(request(url)).rejects.toMatchObject({name: 'TypeError', cause: original})
      expect(attempts).toBe(3)
    },
  )

  it('recovers on a later attempt', async () => {
    let attempts = 0
    const request = createRequester({
      fetch: async () => {
        if (++attempts === 1) throw new FetchError('offline')
        return new Response('recovered')
      },
      middleware: [retries()],
    })
    expect((await request(url)).text()).toBe('recovered')
    expect(attempts).toBe(2)
  })

  it('normalizes per-request fetch overrides', async () => {
    let instanceCalls = 0
    let attempts = 0
    const request = createRequester({
      fetch: async () => {
        instanceCalls++
        return new Response('instance')
      },
      middleware: [retries()],
    })
    await expect(
      request({
        url,
        fetch: async () => {
          attempts++
          throw new FetchError('request override')
        },
      }),
    ).rejects.toBeInstanceOf(TypeError)
    expect(attempts).toBe(3)
    expect(instanceCalls).toBe(0)
  })

  it('normalizes fetch supplied by wrapping middleware', async () => {
    let attempts = 0
    const request = createRequester({
      middleware: [
        retries(),
        (opts, next) =>
          next({
            ...opts,
            fetch: async () => {
              attempts++
              throw new FetchError('middleware fetch')
            },
          }),
      ],
    })
    await expect(request(url)).rejects.toBeInstanceOf(TypeError)
    expect(attempts).toBe(3)
  })

  it('does not normalize middleware errors', async () => {
    let attempts = 0
    const original = new Error('middleware failed')
    const request = createRequester({
      middleware: [
        retries(),
        async () => {
          attempts++
          throw original
        },
      ],
    })
    await expect(request(url)).rejects.toBe(original)
    expect(attempts).toBe(1)
  })

  it('does not normalize response body failures', async () => {
    let attempts = 0
    const original = new Error('body failed')
    const request = createRequester({
      fetch: async () => {
        attempts++
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.error(original)
            },
          }),
        )
      },
      middleware: [retries()],
    })
    await expect(request(url)).rejects.toBe(original)
    expect(attempts).toBe(1)
  })

  it('does not retry HTTP errors', async () => {
    let attempts = 0
    const request = createRequester({
      fetch: async () => {
        attempts++
        return new Response('unavailable', {status: 503})
      },
      middleware: [retries()],
    })
    await expect(request(url)).rejects.toMatchObject({name: 'HttpError', status: 503})
    expect(attempts).toBe(1)
  })

  it('does not change the default entry behavior', async () => {
    let attempts = 0
    const original = new FetchError('fetch failed')
    const request = createCoreRequester({
      fetch: async () => {
        attempts++
        throw original
      },
      middleware: [retries()],
    })
    await expect(request(url)).rejects.toBe(original)
    expect(attempts).toBe(1)
  })

  it.each([
    {error: new TypeError('Network request failed'), attempts: 3},
    {error: Object.assign(new Error('reset'), {code: 'ECONNRESET'}), attempts: 3},
    {
      error: Object.assign(new Error('TLS failure'), {code: 'ERR_TLS_CERT_ALTNAME_INVALID'}),
      attempts: 1,
    },
    {
      error: new Error('TLS failure', {
        cause: Object.assign(new Error('certificate'), {code: 'ERR_TLS_CERT_ALTNAME_INVALID'}),
      }),
      attempts: 1,
    },
    {error: Object.assign(new Error('transient'), {retryable: true}), attempts: 3},
    {error: Object.assign(new Error('permanent'), {retryable: false}), attempts: 1},
    {error: new DOMException('aborted', 'AbortError'), attempts: 1},
    {error: new DOMException('deadline', 'TimeoutError'), attempts: 1},
    {error: Object.assign(new Error('HTTP failure'), {name: 'HttpError'}), attempts: 1},
    {error: 'non-error rejection', attempts: 1},
  ])('preserves classified rejection $error', async ({error, attempts: expected}) => {
    let attempts = 0
    const request = createRequester({
      fetch: async () => {
        attempts++
        throw error
      },
      middleware: [retries()],
    })
    await expect(request(url)).rejects.toBe(error)
    expect(attempts).toBe(expected)
  })

  it('does not retry POST requests', async () => {
    let attempts = 0
    const request = createRequester({
      fetch: async () => {
        attempts++
        throw new FetchError('offline')
      },
      middleware: [retries()],
    })
    await expect(request({url, method: 'POST'})).rejects.toBeInstanceOf(TypeError)
    expect(attempts).toBe(1)
  })

  it('preserves a pre-aborted signal reason', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled by caller')
    controller.abort(reason)
    const request = createRequester({fetch: opaqueAbortFetch, middleware: [retries()]})
    await expect(request({url, signal: controller.signal})).rejects.toBe(reason)
  })

  it('restores a mid-flight abort reason without retrying', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled by caller')
    let attempts = 0
    const request = createRequester({
      fetch: (input, init) => {
        attempts++
        const response = opaqueAbortFetch(input, init)
        controller.abort(reason)
        return response
      },
      middleware: [retries()],
    })
    await expect(request({url, signal: controller.signal})).rejects.toBe(reason)
    expect(attempts).toBe(1)
  })

  it.each([null, 'cancelled', new TypeError('cancelled')])(
    'preserves arbitrary abort reason %s',
    async (reason) => {
      const controller = new AbortController()
      controller.abort(reason)
      const request = createRequester({fetch: opaqueAbortFetch, middleware: [retries()]})
      await expect(request({url, signal: controller.signal})).rejects.toBe(reason)
    },
  )

  it('supplies AbortError for older signals without a reason', async () => {
    const controller = new AbortController()
    controller.abort()
    // Model the older RN AbortSignal shape using a real, aborted signal.
    Object.defineProperty(controller.signal, 'reason', {value: undefined})
    const fetch = wrapReactNativeFetch(opaqueAbortFetch)
    await expect(fetch(url, {signal: controller.signal})).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('does not retry an internal total timeout disguised as a fetch error', async () => {
    let attempts = 0
    const request = createRequester({
      fetch: (input, init) => {
        attempts++
        return opaqueAbortFetch(input, init)
      },
      timeout: {total: 10},
      middleware: [retries()],
    })
    await expect(request(url)).rejects.toMatchObject({name: 'TimeoutError'})
    expect(attempts).toBe(1)
  })

  it('still retries headers timeouts', async () => {
    let attempts = 0
    const request = createRequester({
      fetch: (input, init) => {
        attempts++
        return opaqueAbortFetch(input, init)
      },
      timeout: {headers: 10, total: false},
      middleware: [retries()],
    })
    await expect(request(url)).rejects.toBeInstanceOf(TimeoutError)
    expect(attempts).toBe(3)
  })

  it('normalizes fetch failures in stream mode', async () => {
    let attempts = 0
    const request = createRequester({
      as: 'stream',
      fetch: async () => {
        if (++attempts === 1) throw new FetchError('offline')
        return new Response('streamed')
      },
      middleware: [retries()],
    })
    const response = await request(url)
    expect(await new Response(response.body).text()).toBe('streamed')
    expect(attempts).toBe(2)
  })
})
