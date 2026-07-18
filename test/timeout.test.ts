import {createRequester, TimeoutError} from 'get-it'
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
    expect(resolveTimeout(5000)).toEqual({totalMs: 5000, headersMs: undefined})
  })

  it('false and 0 disable total', () => {
    expect(resolveTimeout(false)).toEqual({totalMs: undefined, headersMs: undefined})
    expect(resolveTimeout(0)).toEqual({totalMs: undefined, headersMs: undefined})
  })

  it('defaults total to 120s when unset', () => {
    expect(resolveTimeout(undefined)).toEqual({totalMs: 120_000, headersMs: undefined})
    expect(resolveTimeout({headers: 15_000})).toEqual({totalMs: 120_000, headersMs: 15_000})
  })

  it('object form: explicit fields win, falsy disables per field', () => {
    expect(resolveTimeout({total: 30_000, headers: 5000})).toEqual({
      totalMs: 30_000,
      headersMs: 5000,
    })
    expect(resolveTimeout({total: false, headers: 5000})).toEqual({
      totalMs: undefined,
      headersMs: 5000,
    })
    expect(resolveTimeout({total: 0})).toEqual({totalMs: undefined, headersMs: undefined})
    expect(resolveTimeout({total: 30_000, headers: 0})).toEqual({
      totalMs: 30_000,
      headersMs: undefined,
    })
  })

  it('negative values disable a phase', () => {
    expect(resolveTimeout(-1)).toEqual({totalMs: undefined, headersMs: undefined})
    expect(resolveTimeout({total: -1, headers: -1})).toEqual({
      totalMs: undefined,
      headersMs: undefined,
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
    const request = createRequester({base: baseUrl, timeout: {headers: 250, total: false}})
    const res = await request('/slow-body?delay=1000')
    expect(res.text()).toBe('partial…done')
  })

  it.skipIf('happyDOM' in globalThis)('total covers slow bodies in buffered mode', async () => {
    const request = createRequester({base: baseUrl, timeout: {total: 250}})
    await expect(request('/slow-body?delay=5000')).rejects.toThrow()
  })

  it('{headers, total: false} lets a slow stream complete', async () => {
    const request = createRequester({base: baseUrl, timeout: {headers: 250, total: false}})
    const res = await request({url: '/slow-body?delay=1000', as: 'stream'})
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
