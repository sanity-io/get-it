import {createRequest, HttpError} from 'get-it'
import {describe, expect, it} from 'vitest'

const baseUrl = 'http://localhost:9980/req-test'

/** Type guard for objects returned from .json() */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Extract a nested record from a parsed JSON object */
function getRecord(obj: unknown, key: string): Record<string, unknown> {
  if (!isRecord(obj)) throw new Error(`Expected object, got ${typeof obj}`)
  const val = obj[key]
  if (!isRecord(val)) throw new Error(`Expected object at key "${key}", got ${typeof val}`)
  return val
}

function getString(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) throw new Error(`Expected object, got ${typeof obj}`)
  return obj[key]
}

describe('built-in behaviors', () => {
  // 4a: Base URL
  describe('base URL', () => {
    it('prepends base URL to relative paths', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request('/plain-text')
      expect(res.text()).toBe('Just some plain text for you to consume')
    })

    it('does not prepend base URL to absolute URLs', async () => {
      const request = createRequest({base: 'http://localhost:9999'})
      const res = await request(`${baseUrl}/plain-text`)
      expect(res.text()).toBe('Just some plain text for you to consume')
    })

    it('joins base without trailing slash and path without leading slash', async () => {
      let calledUrl: string | undefined
      const fakeFetch = async (input: string) => {
        calledUrl = input
        return new Response('ok')
      }
      const request = createRequest({base: 'https://api.com', fetch: fakeFetch})
      await request('users')
      expect(calledUrl).toBe('https://api.com/users')
    })

    it('joins base with trailing slash and path with leading slash', async () => {
      let calledUrl: string | undefined
      const fakeFetch = async (input: string) => {
        calledUrl = input
        return new Response('ok')
      }
      const request = createRequest({base: 'https://api.com/', fetch: fakeFetch})
      await request('/users')
      expect(calledUrl).toBe('https://api.com/users')
    })

    it('joins base with trailing slash and path without leading slash', async () => {
      let calledUrl: string | undefined
      const fakeFetch = async (input: string) => {
        calledUrl = input
        return new Response('ok')
      }
      const request = createRequest({base: 'https://api.com/', fetch: fakeFetch})
      await request('users')
      expect(calledUrl).toBe('https://api.com/users')
    })

    it('joins base without trailing slash and path with leading slash', async () => {
      let calledUrl: string | undefined
      const fakeFetch = async (input: string) => {
        calledUrl = input
        return new Response('ok')
      }
      const request = createRequest({base: 'https://api.com', fetch: fakeFetch})
      await request('/users')
      expect(calledUrl).toBe('https://api.com/users')
    })
  })

  // 4b: Default Headers
  describe('default headers', () => {
    it('sends default headers on every request', async () => {
      const request = createRequest({base: baseUrl, headers: {'X-Custom': 'hello'}})
      const res = await request('/debug')
      const headers = getRecord(res.json(), 'headers')
      expect(headers['x-custom']).toBe('hello')
    })

    it('per-request headers merge with defaults', async () => {
      const request = createRequest({base: baseUrl, headers: {'X-A': '1'}})
      const res = await request({url: '/debug', headers: {'X-B': '2'}})
      const headers = getRecord(res.json(), 'headers')
      expect(headers['x-a']).toBe('1')
      expect(headers['x-b']).toBe('2')
    })

    it('per-request headers override defaults', async () => {
      const request = createRequest({base: baseUrl, headers: {'X-A': '1'}})
      const res = await request({url: '/debug', headers: {'X-A': '2'}})
      const headers = getRecord(res.json(), 'headers')
      expect(headers['x-a']).toBe('2')
    })
  })

  // 4c: Implicit POST
  describe('implicit POST when body is present', () => {
    it('defaults to POST when body is provided and no method is set', async () => {
      let calledInit: RequestInit | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        calledInit = init
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch})
      await request({url: 'https://example.com/api', body: {name: 'test'}})
      expect(calledInit?.method).toBe('POST')
    })

    it('does not override an explicit method when body is present', async () => {
      let calledInit: RequestInit | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        calledInit = init
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch})
      await request({url: 'https://example.com/api', method: 'PUT', body: {name: 'test'}})
      expect(calledInit?.method).toBe('PUT')
    })

    it('does not set method when no body is provided', async () => {
      let calledInit: RequestInit | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        calledInit = init
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch})
      await request({url: 'https://example.com/api'})
      expect(calledInit?.method).toBeUndefined()
    })

    it('sends body as POST to real server when method is omitted', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/json-echo', body: {foo: 'bar'}})
      expect(res.json()).toEqual({foo: 'bar'})
    })
  })

  // 4d: JSON Request Body
  describe('JSON request body', () => {
    it('auto-serializes plain object body as JSON', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/json-echo', method: 'POST', body: {foo: 'bar'}})
      expect(res.json()).toEqual({foo: 'bar'})
    })

    it('auto-serializes array body as JSON', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/json-echo', method: 'POST', body: [1, 2, 3]})
      expect(res.json()).toEqual([1, 2, 3])
    })

    it('sets content-type to application/json for object bodies', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/debug', method: 'POST', body: {test: true}})
      const headers = getRecord(res.json(), 'headers')
      expect(headers['content-type']).toBe('application/json')
    })

    it('does not serialize string bodies as JSON', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/echo', method: 'POST', body: 'raw string'})
      expect(res.text()).toBe('raw string')
    })

    it('does not serialize null body', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/debug', method: 'POST', body: null})
      expect(getString(res.json(), 'body')).toBe('')
    })
  })

  // 4d: Query String
  describe('query string', () => {
    it('appends query parameters to URL', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/query-string', query: {foo: 'bar', num: 42}})
      expect(res.json()).toEqual({foo: 'bar', num: '42'})
    })

    it('merges with existing query parameters', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/query-string?existing=1', query: {added: '2'}})
      const body = res.json()
      expect(getString(body, 'existing')).toBe('1')
      expect(getString(body, 'added')).toBe('2')
    })

    it('skips undefined query values', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/query-string', query: {a: '1', b: undefined}})
      const body = res.json()
      expect(getString(body, 'a')).toBe('1')
      expect(body).not.toHaveProperty('b')
    })

    it('handles boolean query values', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/query-string', query: {flag: true}})
      expect(getString(res.json(), 'flag')).toBe('true')
    })
  })

  // 4e: HTTP Errors
  describe('HTTP errors', () => {
    it('throws HttpError on 4xx status by default', async () => {
      const request = createRequest({base: baseUrl})
      await expect(request('/status?code=404')).rejects.toThrow(HttpError)
    })

    it('throws HttpError on 5xx status by default', async () => {
      const request = createRequest({base: baseUrl})
      await expect(request('/status?code=500')).rejects.toThrow(HttpError)
    })

    it('HttpError contains response details', async () => {
      const request = createRequest({base: baseUrl})
      try {
        await request('/status?code=404')
        expect.fail('should have thrown')
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpError)
        if (err instanceof HttpError) {
          expect(err.status).toBe(404)
          expect(err.response).toBeDefined()
          expect(err.response.status).toBe(404)
        }
      }
    })

    it('does not throw when httpErrors is false (instance)', async () => {
      const request = createRequest({base: baseUrl, httpErrors: false})
      const res = await request('/status?code=404')
      expect(res.status).toBe(404)
    })

    it('does not throw when httpErrors is false (per-request)', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/status?code=404', httpErrors: false})
      expect(res.status).toBe(404)
    })

    it('does not throw for successful responses', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request('/plain-text')
      expect(res.status).toBe(200)
    })
  })

  // 4f: Timeout
  describe('timeout', () => {
    it('aborts request after timeout', async () => {
      const request = createRequest({base: baseUrl, timeout: 200})
      await expect(request('/delay?delay=2000')).rejects.toThrow()
    })

    it('per-request timeout overrides instance timeout', async () => {
      const request = createRequest({base: baseUrl, timeout: 5000})
      await expect(request({url: '/delay?delay=2000', timeout: 200})).rejects.toThrow()
    })

    it('timeout: false disables timeout', async () => {
      const request = createRequest({base: baseUrl, timeout: false})
      const res = await request('/delay?delay=200')
      expect(res.status).toBe(200)
    })

    it('timeout: false per-request overrides instance timeout', async () => {
      const request = createRequest({base: baseUrl, timeout: 100})
      const res = await request({url: '/delay?delay=200', timeout: false})
      expect(res.status).toBe(200)
    })
  })

  // 4g: Signal passthrough
  describe('signal passthrough', () => {
    // happy-dom's fetch does not properly support AbortController on network requests
    it.skipIf('happyDOM' in globalThis)('aborts request when signal is aborted', async () => {
      const controller = new AbortController()
      const request = createRequest({base: baseUrl})
      const promise = request({url: '/delay?delay=5000', signal: controller.signal})
      controller.abort()
      await expect(promise).rejects.toThrow()
    })

    it('combines user signal with timeout signal', async () => {
      const controller = new AbortController()
      const request = createRequest({base: baseUrl, timeout: 200})
      const promise = request({url: '/delay?delay=5000', signal: controller.signal})
      // Timeout should fire first at 200ms
      await expect(promise).rejects.toThrow()
    })
  })
})
