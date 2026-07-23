import {createRequester, type FetchInit, TimeoutError} from 'get-it'
import {describe, expect, it} from 'vitest'
import {resolveTimeout} from '../src/createRequester'

describe('TimeoutError', () => {
  it('carries url, method, timeoutMs, phase, and a retryable string code', () => {
    const err = new TimeoutError({
      url: 'http://localhost:9980/req-test/delay',
      method: 'GET',
      timeoutMs: 15000,
      phase: 'headers',
    })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(TimeoutError)
    expect(err.name).toBe('TimeoutError')
    expect(err.code).toBe('ETIMEDOUT')
    expect(err.phase).toBe('headers')
    expect(err.url).toBe('http://localhost:9980/req-test/delay')
    expect(err.method).toBe('GET')
    expect(err.timeoutMs).toBe(15000)
    expect(err.message).toBe(
      'Request timed out after 15000ms waiting for response headers: GET http://localhost:9980/req-test/delay',
    )
  })

  it('truncates very long URLs in the message but keeps the full url property', () => {
    const longUrl = `http://localhost/?q=${'x'.repeat(500)}`
    const err = new TimeoutError({url: longUrl, method: 'GET', timeoutMs: 100, phase: 'headers'})
    expect(err.url).toBe(longUrl)
    expect(err.message.length).toBeLessThan(500)
    expect(err.message).toContain('…')
  })
})

describe('resolveTimeout', () => {
  it('treats a plain number as total', () => {
    expect(resolveTimeout(5000)).toEqual({totalMs: 5000, headersMs: undefined, attachSignal: true})
  })

  it('false and 0 disable total', () => {
    expect(resolveTimeout(false)).toEqual({
      totalMs: undefined,
      headersMs: undefined,
      attachSignal: true,
    })
    expect(resolveTimeout(0)).toEqual({
      totalMs: undefined,
      headersMs: undefined,
      attachSignal: true,
    })
  })

  it('defaults total to 120s when unset', () => {
    expect(resolveTimeout(undefined)).toEqual({
      totalMs: 120_000,
      headersMs: undefined,
      attachSignal: true,
    })
    expect(resolveTimeout({headers: 15_000})).toEqual({
      totalMs: 120_000,
      headersMs: 15_000,
      attachSignal: true,
    })
  })

  it('object form: explicit fields win, falsy disables per field', () => {
    expect(resolveTimeout({total: 30_000, headers: 5000})).toEqual({
      totalMs: 30_000,
      headersMs: 5000,
      attachSignal: true,
    })
    expect(resolveTimeout({total: false, headers: 5000})).toEqual({
      totalMs: undefined,
      headersMs: 5000,
      attachSignal: true,
    })
    expect(resolveTimeout({total: 0})).toEqual({
      totalMs: undefined,
      headersMs: undefined,
      attachSignal: true,
    })
    expect(resolveTimeout({total: 30_000, headers: 0})).toEqual({
      totalMs: 30_000,
      headersMs: undefined,
      attachSignal: true,
    })
  })

  it('negative values disable a phase', () => {
    expect(resolveTimeout(-1)).toEqual({
      totalMs: undefined,
      headersMs: undefined,
      attachSignal: true,
    })
    expect(resolveTimeout({total: -1, headers: -1})).toEqual({
      totalMs: undefined,
      headersMs: undefined,
      attachSignal: true,
    })
  })

  it('signal: false switches to rejection-only mode', () => {
    expect(resolveTimeout({total: 30_000, signal: false})).toEqual({
      totalMs: 30_000,
      headersMs: undefined,
      attachSignal: false,
    })
    expect(resolveTimeout({headers: 5000, signal: false})).toEqual({
      totalMs: 120_000,
      headersMs: 5000,
      attachSignal: false,
    })
    expect(resolveTimeout({total: 30_000, signal: true})).toEqual({
      totalMs: 30_000,
      headersMs: undefined,
      attachSignal: true,
    })
  })
})

const baseUrl = 'http://localhost:9980/req-test'

describe('structured timeout behavior', () => {
  // happy-dom's fetch does not properly support AbortController on network requests
  it.skipIf('happyDOM' in globalThis)(
    'headers timeout fires with a TimeoutError when headers are delayed',
    async () => {
      const request = createRequester({base: baseUrl, timeout: {headers: 250}})
      const err = await request('/delay?delay=5000').then(
        () => null,
        (reason: unknown) => reason,
      )
      expect(err).toBeInstanceOf(TimeoutError)
      if (!(err instanceof TimeoutError)) throw new Error('expected TimeoutError')
      expect(err.phase).toBe('headers')
      expect(err.code).toBe('ETIMEDOUT')
      expect(err.timeoutMs).toBe(250)
      expect(err.method).toBe('GET')
      expect(err.url).toContain('/delay')
    },
  )

  it.skipIf('happyDOM' in globalThis)(
    'object form {total: n} behaves like plain number',
    async () => {
      const request = createRequester({base: baseUrl, timeout: {total: 200}})
      await expect(request('/delay?delay=2000')).rejects.toThrow()
    },
  )

  it('object form {total: false} disables the total deadline', async () => {
    const request = createRequester({base: baseUrl, timeout: {total: false}})
    const res = await request('/delay?delay=200')
    expect(res.status).toBe(200)
  })

  it.skipIf('happyDOM' in globalThis)(
    'per-request object timeout replaces instance value wholesale',
    async () => {
      const request = createRequester({base: baseUrl, timeout: {total: false}})
      await expect(request({url: '/delay?delay=2000', timeout: {total: 200}})).rejects.toThrow()
    },
  )

  it('headers timeout does not fire when the response is fast', async () => {
    const request = createRequester({base: baseUrl, timeout: {headers: 5000}})
    const res = await request('/plain-text')
    expect(res.text()).toBe('Just some plain text for you to consume')
  })

  it('headers timeout does not fire once headers have arrived, even with a slow body', async () => {
    // Body delay must exceed the headers timeout so an uncleared timer would
    // still fire; the timeout is generous so headers reliably arrive within
    // it even on a loaded CI machine.
    const request = createRequester({base: baseUrl, timeout: {headers: 1000, total: false}})
    const res = await request('/slow-body?delay=2000')
    expect(res.text()).toBe('partial…done')
  })

  it.skipIf('happyDOM' in globalThis)('total covers slow bodies in buffered mode', async () => {
    const request = createRequester({base: baseUrl, timeout: {total: 250}})
    await expect(request('/slow-body?delay=5000')).rejects.toThrow()
  })

  it('rejection-only mode: total deadline rejects without aborting the fetch', async () => {
    const request = createRequester({base: baseUrl, timeout: {total: 250, signal: false}})
    const err = await request('/delay?delay=750').then(
      () => null,
      (reason: unknown) => reason,
    )
    expect(err).toBeInstanceOf(Error)
    if (!(err instanceof Error)) throw new Error('expected Error')
    expect(err.name).toBe('TimeoutError')
    expect(err.message).toBe('The operation was aborted due to timeout')
    // The losing fetch keeps running to completion in the background; let it
    // settle to prove the late response is swallowed (vitest fails the test
    // on unhandled rejections).
    await new Promise((resolve) => setTimeout(resolve, 1000))
  })

  it('rejection-only mode: headers deadline rejects with a headers-phase TimeoutError', async () => {
    const request = createRequester({
      base: baseUrl,
      timeout: {headers: 250, total: false, signal: false},
    })
    const err = await request('/delay?delay=750').then(
      () => null,
      (reason: unknown) => reason,
    )
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(TimeoutError)
    if (!(err instanceof TimeoutError)) throw new Error('expected TimeoutError')
    expect(err.phase).toBe('headers')
    expect(err.code).toBe('ETIMEDOUT')
    expect(err.timeoutMs).toBe(250)
    expect(err.method).toBe('GET')
    // The losing fetch was not aborted; let its late response (and dangling
    // body) arrive to prove it is swallowed, not an unhandled rejection.
    await new Promise((resolve) => setTimeout(resolve, 1000))
  })

  it('rejection-only mode: total covers slow bodies in buffered mode', async () => {
    const request = createRequester({base: baseUrl, timeout: {total: 250, signal: false}})
    const err = await request('/slow-body?delay=1000').then(
      () => null,
      (reason: unknown) => reason,
    )
    expect(err).toBeInstanceOf(Error)
    if (!(err instanceof Error)) throw new Error('expected Error')
    expect(err.name).toBe('TimeoutError')
    // Buffering continues in the background after the race is lost; let the
    // body finish to prove its settlement is swallowed.
    await new Promise((resolve) => setTimeout(resolve, 1250))
  })

  it('rejection-only mode: attaches no timeout-derived signal to the fetch init', async () => {
    let capturedInit: FetchInit | undefined
    const request = createRequester({
      base: baseUrl,
      timeout: {total: 30_000, headers: 15_000, signal: false},
      fetch: (_url, init) => {
        capturedInit = init
        return Promise.resolve(new Response('spied'))
      },
    })
    const res = await request('/plain-text')
    expect(res.text()).toBe('spied')
    expect(capturedInit?.signal).toBeUndefined()
  })

  it('rejection-only mode: a caller-provided signal passes through untouched and still aborts', async () => {
    let capturedInit: FetchInit | undefined
    const request = createRequester({
      base: baseUrl,
      timeout: {total: 30_000, signal: false},
      fetch: (_url, init) => {
        capturedInit = init
        const signal = init?.signal
        // Signal-honoring stand-in for fetch — the real environments differ
        // in abort support (happy-dom lacks it), and this test is about what
        // get-it hands to fetch, not the fetch implementation itself.
        return new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(new Response('too late')), 5000)
          signal?.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'))
          })
        })
      },
    })
    const controller = new AbortController()
    const rejection = request({url: '/delay?delay=5000', signal: controller.signal}).then(
      () => null,
      (reason: unknown) => reason,
    )
    controller.abort(new Error('caller aborted'))
    const err = await rejection
    expect(capturedInit?.signal).toBe(controller.signal)
    expect(err).toBeInstanceOf(Error)
    if (!(err instanceof Error)) throw new Error('expected Error')
    expect(err.message).toBe('caller aborted')
  })

  it('rejection-only mode: a response that beats the deadline resolves normally', async () => {
    const request = createRequester({base: baseUrl, timeout: {total: 250, signal: false}})
    let error: unknown
    const res = await request('/plain-text').catch((reason: unknown) => {
      error = reason
      return undefined
    })
    if (error) throw error
    if (!res) throw new Error('expected a response')
    expect(res.text()).toBe('Just some plain text for you to consume')
    // Let the already-won deadline timer fire; its rejection must stay
    // swallowed (vitest fails the test on unhandled rejections).
    await new Promise((resolve) => setTimeout(resolve, 400))
  })

  it('a synchronously-throwing fetch still clears the headers deadline', async () => {
    const request = createRequester({
      base: baseUrl,
      timeout: {headers: 250},
      fetch: () => {
        throw new Error('sync throw from custom fetch')
      },
    })
    const err = await request('/plain-text').then(
      () => null,
      (reason: unknown) => reason,
    )
    expect(err).toBeInstanceOf(Error)
    if (!(err instanceof Error)) throw new Error('expected Error')
    expect(err.message).toBe('sync throw from custom fetch')
    // Wait past the headers deadline: a leaked timer would fire and reject a
    // promise nothing subscribes to (vitest fails the test on unhandled
    // rejections).
    await new Promise((resolve) => setTimeout(resolve, 400))
  })

  it('{headers, total: false} lets a slow stream complete', async () => {
    const request = createRequester({base: baseUrl, timeout: {headers: 1000, total: false}})
    const res = await request({url: '/slow-body?delay=2000', as: 'stream'})
    expect(res.status).toBe(200)
    const chunks: Uint8Array[] = []
    const reader = res.body.getReader()
    for (;;) {
      const {done, value} = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const text = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.length + chunk.length)
        merged.set(acc)
        merged.set(chunk, acc.length)
        return merged
      }, new Uint8Array(0)),
    )
    expect(text).toBe('partial…done')
  })
})
