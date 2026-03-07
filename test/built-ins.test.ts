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

    it('joins base with deeper path segments and relative url', async () => {
      let calledUrl: string | undefined
      const fakeFetch = async (input: string) => {
        calledUrl = input
        return new Response('ok')
      }
      const request = createRequest({base: 'https://api.com/v1', fetch: fakeFetch})
      await request('users')
      expect(calledUrl).toBe('https://api.com/v1/users')
    })

    it('joins base with deeper path segments and leading-slash url', async () => {
      let calledUrl: string | undefined
      const fakeFetch = async (input: string) => {
        calledUrl = input
        return new Response('ok')
      }
      const request = createRequest({base: 'https://api.com/v1/', fetch: fakeFetch})
      await request('/users')
      expect(calledUrl).toBe('https://api.com/v1/users')
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

    it('passes Headers instance through without modification', async () => {
      const request = createRequest({base: baseUrl, headers: new Headers({'X-Via': 'headers'})})
      const res = await request('/debug')
      const sent = getRecord(res.json(), 'headers')
      expect(sent['x-via']).toBe('headers')
    })

    it('strips undefined header values from instance headers', async () => {
      const headers = {'X-Present': 'yes', 'X-Missing': undefined} as Record<string, string>
      const request = createRequest({base: baseUrl, headers})
      const res = await request('/debug')
      const sent = getRecord(res.json(), 'headers')
      expect(sent['x-present']).toBe('yes')
      expect(sent).not.toHaveProperty('x-missing')
    })

    it('strips undefined header values from per-request headers', async () => {
      const request = createRequest({base: baseUrl})
      const headers = {'X-Present': 'yes', 'X-Missing': undefined} as Record<string, string>
      const res = await request({url: '/debug', headers})
      const sent = getRecord(res.json(), 'headers')
      expect(sent['x-present']).toBe('yes')
      expect(sent).not.toHaveProperty('x-missing')
    })

    it('accepts [string, string][] tuple format for instance headers', async () => {
      const request = createRequest({
        base: baseUrl,
        headers: [['X-Tuple', 'works']],
      })
      const res = await request('/debug')
      const headers = getRecord(res.json(), 'headers')
      expect(headers['x-tuple']).toBe('works')
    })

    it('accepts [string, string][] tuple format for per-request headers', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({
        url: '/debug',
        headers: [['X-Request-Tuple', 'yes']],
      })
      const headers = getRecord(res.json(), 'headers')
      expect(headers['x-request-tuple']).toBe('yes')
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

    it('does not set method to POST when body is null', async () => {
      let calledInit: RequestInit | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        calledInit = init
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch})
      await request({url: 'https://example.com/api', body: null})
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

    it('preserves explicit content-type when body is a plain object', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({
        url: '/debug',
        method: 'POST',
        body: {test: true},
        headers: {'content-type': 'application/json; charset=utf-8'},
      })
      const headers = getRecord(res.json(), 'headers')
      expect(headers['content-type']).toBe('application/json; charset=utf-8')
    })

    it('sends Blob body without JSON serialization', async () => {
      let sentBody: BodyInit | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        sentBody = init?.body ?? undefined
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch})
      const blob = new Blob(['binary data'], {type: 'application/octet-stream'})
      await request({url: 'https://example.com/upload', method: 'POST', body: blob})
      expect(sentBody).toBeInstanceOf(Blob)
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

    it('throws TypeError for non-serializable body types', async () => {
      const fakeFetch = async () => new Response('ok')
      const request = createRequest({fetch: fakeFetch})
      await expect(
        request({url: 'https://example.com/api', method: 'POST', body: 42}),
      ).rejects.toThrow(TypeError)
    })

    it('throws TypeError with descriptive message for unrecognized body', async () => {
      const fakeFetch = async () => new Response('ok')
      const request = createRequest({fetch: fakeFetch})
      await expect(
        request({url: 'https://example.com/api', method: 'POST', body: new Date()}),
      ).rejects.toThrow(/unsupported body type/i)
    })

    it('JSON-serializes Object.create(null) bodies', async () => {
      const request = createRequest({base: baseUrl})
      const body = Object.create(null) as Record<string, string>
      body.key = 'value'
      const res = await request({url: '/json-echo', method: 'POST', body})
      expect(res.json()).toEqual({key: 'value'})
    })
  })

  // 4d: URLSearchParams request body
  describe('URLSearchParams request body', () => {
    it('sends URLSearchParams body as form-urlencoded', async () => {
      const request = createRequest({base: baseUrl})
      const params = new URLSearchParams()
      params.set('foo', 'bar')
      params.set('baz', 'qux')
      const res = await request({url: '/urlencoded', method: 'POST', body: params})
      expect(res.json()).toEqual({foo: 'bar', baz: 'qux'})
    })

    it('sets content-type to application/x-www-form-urlencoded automatically', async () => {
      const request = createRequest({base: baseUrl})
      const params = new URLSearchParams({foo: 'bar'})
      const res = await request({url: '/debug', method: 'POST', body: params})
      const headers = getRecord(res.json(), 'headers')
      expect(headers['content-type']).toBe('application/x-www-form-urlencoded;charset=UTF-8')
    })

    it('does not JSON-serialize URLSearchParams body', async () => {
      const request = createRequest({base: baseUrl})
      const params = new URLSearchParams({foo: 'bar'})
      const res = await request({url: '/echo', method: 'POST', body: params})
      expect(res.text()).toBe('foo=bar')
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

    it('accepts URLSearchParams as query', async () => {
      const params = new URLSearchParams()
      params.append('tags', 'a')
      params.append('tags', 'b')
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/query-string', query: params})
      expect(getString(res.json(), 'tags')).toEqual(['a', 'b'])
    })

    it('handles empty query object', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/plain-text', query: {}})
      expect(res.status).toBe(200)
    })

    it('stringifies number 0 as query value', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/query-string', query: {count: 0}})
      expect(getString(res.json(), 'count')).toBe('0')
    })

    it('stringifies false as query value', async () => {
      const request = createRequest({base: baseUrl})
      const res = await request({url: '/query-string', query: {enabled: false}})
      expect(getString(res.json(), 'enabled')).toBe('false')
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

    it('HttpError message includes method and URL', async () => {
      const request = createRequest({base: baseUrl})
      try {
        await request({url: '/status?code=404', method: 'GET'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpError)
        if (err instanceof HttpError) {
          expect(err.message).toContain('GET')
          expect(err.message).toContain('/status?code=404')
        }
      }
    })

    it('HttpError message includes URL and method for implicit POST', async () => {
      const request = createRequest({base: baseUrl})
      try {
        await request({url: '/status?code=500', body: {test: true}})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpError)
        if (err instanceof HttpError) {
          expect(err.message).toContain('POST')
          expect(err.message).toContain('/status?code=500')
        }
      }
    })

    it('HttpError exposes url and method properties', async () => {
      const request = createRequest({base: baseUrl})
      try {
        await request({url: '/status?code=404', method: 'DELETE'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpError)
        if (err instanceof HttpError) {
          expect(err.url).toContain('/status?code=404')
          expect(err.method).toBe('DELETE')
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

    it('HttpError has name set to "HttpError"', async () => {
      const request = createRequest({base: baseUrl})
      try {
        await request('/status?code=500')
        expect.fail('should have thrown')
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpError)
        if (err instanceof HttpError) {
          expect(err.name).toBe('HttpError')
        }
      }
    })

    it('HttpError exposes body text and headers', async () => {
      const request = createRequest({base: baseUrl})
      try {
        await request('/status?code=404')
        expect.fail('should have thrown')
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpError)
        if (err instanceof HttpError) {
          expect(typeof err.body).toBe('string')
          expect(err.headers).toBeInstanceOf(Headers)
          expect(typeof err.statusText).toBe('string')
        }
      }
    })

    it('instance httpErrors=true can be disabled per-request', async () => {
      const request = createRequest({base: baseUrl, httpErrors: true})
      const res = await request({url: '/status?code=500', httpErrors: false})
      expect(res.status).toBe(500)
    })
  })

  // 4f: Timeout
  describe('timeout', () => {
    it('applies a default timeout when none is configured', async () => {
      let receivedSignal: AbortSignal | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        receivedSignal = init?.signal ?? undefined
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch})
      await request('https://example.com/test')
      expect(receivedSignal).toBeDefined()
    })

    it('aborts request after timeout', async () => {
      const request = createRequest({base: baseUrl, timeout: 200})
      await expect(request('/delay?delay=2000')).rejects.toThrow()
    })

    it('per-request timeout overrides instance timeout', async () => {
      const request = createRequest({base: baseUrl, timeout: 5000})
      await expect(request({url: '/delay?delay=2000', timeout: 200})).rejects.toThrow()
    })

    it('timeout: 0 disables timeout (same as false)', async () => {
      const request = createRequest({base: baseUrl, timeout: 0})
      const res = await request('/delay?delay=200')
      expect(res.status).toBe(200)
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

    it('user signal passes through directly when timeout is false', async () => {
      const controller = new AbortController()
      let receivedSignal: AbortSignal | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        receivedSignal = init?.signal ?? undefined
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch, timeout: false})
      await request({url: 'https://example.com/test', signal: controller.signal})
      expect(receivedSignal).toBe(controller.signal)
    })

    it('no signal when timeout is false and no user signal', async () => {
      let receivedSignal: AbortSignal | null | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        receivedSignal = init?.signal
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch, timeout: false})
      await request('https://example.com/test')
      expect(receivedSignal).toBeUndefined()
    })
  })

  // 4h: Credentials
  describe('credentials', () => {
    // Credentials are only set in browser-like environments (where `window` exists)
    // to avoid crashes in runtimes like Cloudflare Workers.
    const hasWindow = 'window' in globalThis

    it('passes instance-level credentials to fetch in browser env', async () => {
      if (!hasWindow) (globalThis as Record<string, unknown>).window = globalThis
      try {
        let calledInit: RequestInit | undefined
        const fakeFetch = async (_input: string, init?: RequestInit) => {
          calledInit = init
          return new Response('ok')
        }
        const request = createRequest({fetch: fakeFetch, credentials: 'include'})
        await request('https://example.com/api')
        expect(calledInit?.credentials).toBe('include')
      } finally {
        if (!hasWindow) delete (globalThis as Record<string, unknown>).window
      }
    })

    it('passes per-request credentials to fetch in browser env', async () => {
      if (!hasWindow) (globalThis as Record<string, unknown>).window = globalThis
      try {
        let calledInit: RequestInit | undefined
        const fakeFetch = async (_input: string, init?: RequestInit) => {
          calledInit = init
          return new Response('ok')
        }
        const request = createRequest({fetch: fakeFetch})
        await request({url: 'https://example.com/api', credentials: 'include'})
        expect(calledInit?.credentials).toBe('include')
      } finally {
        if (!hasWindow) delete (globalThis as Record<string, unknown>).window
      }
    })

    it('per-request credentials override instance credentials', async () => {
      if (!hasWindow) (globalThis as Record<string, unknown>).window = globalThis
      try {
        let calledInit: RequestInit | undefined
        const fakeFetch = async (_input: string, init?: RequestInit) => {
          calledInit = init
          return new Response('ok')
        }
        const request = createRequest({fetch: fakeFetch, credentials: 'include'})
        await request({url: 'https://example.com/api', credentials: 'omit'})
        expect(calledInit?.credentials).toBe('omit')
      } finally {
        if (!hasWindow) delete (globalThis as Record<string, unknown>).window
      }
    })

    it('does not set credentials when not configured', async () => {
      let calledInit: RequestInit | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        calledInit = init
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch})
      await request('https://example.com/api')
      expect(calledInit?.credentials).toBeUndefined()
    })

    it('does not set credentials in non-browser environments', async () => {
      if (hasWindow) return // skip in browser test runners
      let calledInit: RequestInit | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        calledInit = init
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch, credentials: 'include'})
      await request('https://example.com/api')
      expect(calledInit?.credentials).toBeUndefined()
    })
  })

  // 4i: Redirect
  describe('redirect', () => {
    it('passes per-request redirect option to fetch', async () => {
      let calledInit: RequestInit | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        calledInit = init
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch})
      await request({url: 'https://example.com/api', redirect: 'manual'})
      expect(calledInit?.redirect).toBe('manual')
    })

    it('does not set redirect when not configured', async () => {
      let calledInit: RequestInit | undefined
      const fakeFetch = async (_input: string, init?: RequestInit) => {
        calledInit = init
        return new Response('ok')
      }
      const request = createRequest({fetch: fakeFetch})
      await request('https://example.com/api')
      expect(calledInit?.redirect).toBeUndefined()
    })
  })
})
