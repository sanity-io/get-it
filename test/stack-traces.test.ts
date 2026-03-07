import {createRequest, HttpError} from 'get-it'
import {retry} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

/**
 * Extract function names from an Error stack trace.
 */
function stackNames(error: Error): string[] {
  if (!error.stack) return []
  return error.stack
    .split('\n')
    .map((line) => {
      const match = line.match(/at (?:Object\.)?(\S+)\s*\(/)
      return match ? match[1] : null
    })
    .filter((name): name is string => name !== null)
}

// Fake fetch returning an error status — simulates a browser/edge environment
const fetch404 = async () => new Response('Not Found', {status: 404, statusText: 'Not Found'})
const fetch500 = async () =>
  new Response('Internal Server Error', {status: 500, statusText: 'Internal Server Error'})

describe('stack traces', () => {
  describe('public API boundary', () => {
    it('HttpError includes request (the public entry point)', async () => {
      const request = createRequest({fetch: fetch404})
      try {
        await request({url: 'http://example.com/test'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof HttpError)) throw err
        expect(stackNames(err)).toContain('request')
      }
    })

    it('as: "json" includes request and requestJson', async () => {
      const request = createRequest({fetch: fetch404})
      try {
        await request({url: 'http://example.com/test', as: 'json'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof HttpError)) throw err
        const names = stackNames(err)
        expect(names).toContain('request')
        expect(names).toContain('requestJson')
      }
    })

    it('as: "text" includes request and requestText', async () => {
      const request = createRequest({fetch: fetch404})
      try {
        await request({url: 'http://example.com/test', as: 'text'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof HttpError)) throw err
        const names = stackNames(err)
        expect(names).toContain('request')
        expect(names).toContain('requestText')
      }
    })

    it('as: "stream" includes request and requestStream', async () => {
      const request = createRequest({fetch: fetch500})
      try {
        await request({url: 'http://example.com/test', as: 'stream'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof HttpError)) throw err
        const names = stackNames(err)
        expect(names).toContain('request')
        expect(names).toContain('requestStream')
      }
    })
  })

  describe('middleware visibility', () => {
    it('retry middleware appears in stack', async () => {
      const request = createRequest({
        fetch: fetch500,
        httpErrors: false,
        middleware: [retry({maxRetries: 0})],
      })
      try {
        await request({url: 'http://example.com/test', httpErrors: true})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof HttpError)) throw err
        expect(stackNames(err)).toContain('retryMiddleware')
      }
    })

    it('named wrapping middleware appears when it awaits next()', async () => {
      const request = createRequest({
        fetch: fetch404,
        middleware: [
          async function authMiddleware(opts, next) {
            return await next(opts)
          },
        ],
      })
      try {
        await request({url: 'http://example.com/test'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof HttpError)) throw err
        expect(stackNames(err)).toContain('authMiddleware')
      }
    })

    it('network error through retry shows retryMiddleware', async () => {
      const fetchNetworkError = async () => {
        throw new Error('connect ECONNREFUSED')
      }
      const request = createRequest({
        fetch: fetchNetworkError,
        middleware: [retry({maxRetries: 0})],
      })
      try {
        await request({url: 'http://example.com/test'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof Error)) throw err
        expect(stackNames(err)).toContain('retryMiddleware')
      }
    })
  })

  describe('error types', () => {
    it('TypeError from invalid JSON includes requestJson', async () => {
      const fetchHtml = async () => new Response('<html>not json</html>', {status: 200})
      const request = createRequest({fetch: fetchHtml})
      try {
        await request({url: 'http://example.com/test', as: 'json'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof TypeError)) throw err
        expect(stackNames(err)).toContain('requestJson')
      }
    })
  })

  describe('internal frames are hidden', () => {
    it('bufferAndCheck and executeBuffered do not appear in stack', async () => {
      const request = createRequest({fetch: fetch404})
      try {
        await request({url: 'http://example.com/test'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof HttpError)) throw err
        const names = stackNames(err)
        expect(names).not.toContain('bufferAndCheck')
        expect(names).not.toContain('executeBuffered')
      }
    })
  })

  describe('no anonymous functions in critical path', () => {
    it('stack has no anonymous entries', async () => {
      const request = createRequest({
        fetch: fetch404,
        middleware: [
          async function myMiddleware(opts, next) {
            return await next(opts)
          },
        ],
      })
      try {
        await request({url: 'http://example.com/test'})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof HttpError)) throw err
        for (const name of stackNames(err)) {
          expect(name).not.toBe('<anonymous>')
        }
      }
    })
  })

  describe('node fetch', () => {
    it('network error includes nodeFetch in stack', async () => {
      const {createNodeFetch} = await import('get-it/node')
      const request = createRequest({
        fetch: createNodeFetch({proxy: false}),
      })
      try {
        await request({url: 'http://localhost:1/', timeout: 5000})
        expect.fail('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof Error)) throw err
        expect(stackNames(err)).toContain('nodeFetch')
      }
    })
  })
})
