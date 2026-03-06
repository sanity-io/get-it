import type {WrappingMiddleware} from 'get-it'
import {createRequest} from 'get-it'
import {describe, expect, it} from 'vitest'

const baseUrl = 'http://localhost:9980/req-test'

describe('middleware system', () => {
  it('runs beforeRequest transforms in order', async () => {
    const order: string[] = []
    const request = createRequest({
      base: baseUrl,
      middleware: [
        {
          beforeRequest: (opts) => {
            order.push('a')
            return opts
          },
        },
        {
          beforeRequest: (opts) => {
            order.push('b')
            return opts
          },
        },
      ],
    })
    await request('/plain-text')
    expect(order).toEqual(['a', 'b'])
  })

  it('beforeRequest can modify options', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [
        {
          beforeRequest: (opts) => ({
            ...opts,
            headers: {...opts.headers, 'X-Added': '1'},
          }),
        },
      ],
    })
    const res = await request({url: '/debug'})
    const debug = res.json() as Record<string, unknown>
    const headers = debug['headers'] as Record<string, string>
    expect(headers['x-added']).toBe('1')
  })

  it('runs afterResponse transforms in order', async () => {
    const order: string[] = []
    const request = createRequest({
      base: baseUrl,
      middleware: [
        {
          afterResponse: (res) => {
            order.push('a')
            return res
          },
        },
        {
          afterResponse: (res) => {
            order.push('b')
            return res
          },
        },
      ],
    })
    await request('/plain-text')
    expect(order).toEqual(['a', 'b'])
  })

  it('wrapping middleware wraps the fetch call', async () => {
    let wrappedCalled = false
    const wrapping: WrappingMiddleware = async (opts, next) => {
      wrappedCalled = true
      return next(opts)
    }
    const request = createRequest({base: baseUrl, middleware: [wrapping]})
    await request('/plain-text')
    expect(wrappedCalled).toBe(true)
  })

  it('wrapping middleware can retry on failure', async () => {
    let attempts = 0
    const retryOnce: WrappingMiddleware = async (opts, next) => {
      attempts++
      const res = await next(opts)
      if (res.status >= 500) {
        attempts++
        return next(opts)
      }
      return res
    }
    // Use a counter wrapper so the first call returns 500, retry gets 200
    let callCount = 0
    const fakeFirstFailure: WrappingMiddleware = async (opts, next) => {
      callCount++
      if (callCount === 1) {
        return next({...opts, url: opts.url.replace('/plain-text', '/status?code=500')})
      }
      return next(opts)
    }
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retryOnce, fakeFirstFailure],
    })
    const res = await request('/plain-text')
    expect(res.status).toBe(200)
    expect(attempts).toBe(2)
  })

  it('transform and wrapping middleware compose correctly', async () => {
    const order: string[] = []
    const request = createRequest({
      base: baseUrl,
      middleware: [
        {
          beforeRequest: (opts) => {
            order.push('before')
            return opts
          },
        },
        async (opts, next) => {
          order.push('wrap-pre')
          const r = await next(opts)
          order.push('wrap-post')
          return r
        },
        {
          afterResponse: (res) => {
            order.push('after')
            return res
          },
        },
      ],
    })
    await request('/plain-text')
    expect(order).toEqual(['before', 'wrap-pre', 'wrap-post', 'after'])
  })

  it('multiple wrapping middlewares nest correctly', async () => {
    const order: string[] = []
    const outer: WrappingMiddleware = async (opts, next) => {
      order.push('outer-pre')
      const r = await next(opts)
      order.push('outer-post')
      return r
    }
    const inner: WrappingMiddleware = async (opts, next) => {
      order.push('inner-pre')
      const r = await next(opts)
      order.push('inner-post')
      return r
    }
    const request = createRequest({base: baseUrl, middleware: [outer, inner]})
    await request('/plain-text')
    expect(order).toEqual(['outer-pre', 'inner-pre', 'inner-post', 'outer-post'])
  })

  it('works with as: "json" option', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [
        {
          beforeRequest: (opts) => ({
            ...opts,
            headers: {...opts.headers, 'X-Test': '1'},
          }),
        },
      ],
    })
    const res = await request({url: '/json', as: 'json'})
    expect(res.body).toEqual({foo: 'bar'})
  })

  it('works with as: "text" option', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [
        {
          beforeRequest: (opts) => ({
            ...opts,
            headers: {...opts.headers, 'X-Test': '1'},
          }),
        },
      ],
    })
    const res = await request({url: '/plain-text', as: 'text'})
    expect(res.body).toBe('Just some plain text for you to consume')
  })

  it('wrapping middleware runs for stream requests', async () => {
    let wrappedCalled = false
    const wrapping: WrappingMiddleware = async (opts, next) => {
      wrappedCalled = true
      return next(opts)
    }
    const request = createRequest({base: baseUrl, middleware: [wrapping]})
    const res = await request({url: '/plain-text', as: 'stream'})
    await res.body.cancel()
    expect(wrappedCalled).toBe(true)
  })

  it('wrapping middleware can modify options for stream requests', async () => {
    const addHeader: WrappingMiddleware = async (opts, next) => {
      return next({...opts, headers: {...opts.headers, 'X-Stream-MW': 'yes'}})
    }
    const request = createRequest({base: baseUrl, middleware: [addHeader]})
    const res = await request({url: '/debug', as: 'stream'})
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let done = false
    while (!done) {
      const result = await reader.read()
      if (result.value) chunks.push(result.value)
      done = result.done
    }
    const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    const debug = JSON.parse(new TextDecoder().decode(combined)) as Record<string, unknown>
    const headers = debug['headers'] as Record<string, string>
    expect(headers['x-stream-mw']).toBe('yes')
  })

  it('stream mode gets beforeRequest but not afterResponse', async () => {
    let beforeCalled = false
    let afterCalled = false
    const request = createRequest({
      base: baseUrl,
      middleware: [
        {
          beforeRequest: (opts) => {
            beforeCalled = true
            return opts
          },
          afterResponse: (res) => {
            afterCalled = true
            return res
          },
        },
      ],
    })
    const res = await request({url: '/plain-text', as: 'stream'})
    await res.body.cancel()
    expect(beforeCalled).toBe(true)
    expect(afterCalled).toBe(false)
  })

  it('afterResponse can modify the response', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [
        {
          afterResponse: (res) => {
            // Return a new BufferedResponse with modified status
            return {...res, status: 999}
          },
        },
      ],
    })
    const res = await request('/plain-text')
    expect(res.status).toBe(999)
  })

  it('passes meta through to middleware', async () => {
    let receivedMeta: Record<string, unknown> | undefined
    const request = createRequest({
      base: baseUrl,
      middleware: [
        {
          beforeRequest: (opts) => {
            receivedMeta = opts.meta
            return opts
          },
        },
      ],
    })
    await request({url: '/plain-text', meta: {lineage: 'abc', traceId: 123}})
    expect(receivedMeta).toEqual({lineage: 'abc', traceId: 123})
  })

  it('meta is available in wrapping middleware', async () => {
    let receivedMeta: Record<string, unknown> | undefined
    const request = createRequest({
      base: baseUrl,
      middleware: [
        async (opts, next) => {
          receivedMeta = opts.meta
          return next(opts)
        },
      ],
    })
    await request({url: '/plain-text', meta: {lineage: 'xyz'}})
    expect(receivedMeta).toEqual({lineage: 'xyz'})
  })

  it('works with no middleware', async () => {
    const request = createRequest({base: baseUrl, middleware: []})
    const res = await request('/plain-text')
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to consume')
  })
})
