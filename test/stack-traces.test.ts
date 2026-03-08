import {createRequest, HttpError} from 'get-it'
import {retry} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

/**
 * Detect whether the runtime preserves async stack frames across module
 * boundaries. V8 does this natively, but some environments (e.g. happy-dom)
 * break the async context tracking, causing caller frames to disappear.
 * We probe with a real request to catch cross-module async frame loss.
 */
const hasAsyncStackFrames = await (async () => {
  const probe = createRequest({
    fetch: async () => new Response('x', {status: 500}),
  })
  try {
    await probe({url: 'http://probe'})
    return false
  } catch (err: unknown) {
    if (!(err instanceof HttpError)) return false
    return stackNames(err).includes('request')
  }
})()

// Fake fetch returning an error status — simulates a browser/edge environment
const fetch404 = async () => new Response('Not Found', {status: 404, statusText: 'Not Found'})
const fetch500 = async () =>
  new Response('Internal Server Error', {status: 500, statusText: 'Internal Server Error'})

describe('stack traces', () => {
  describe('public API boundary', () => {
    it.runIf(hasAsyncStackFrames)(
      'HttpError includes request (the public entry point)',
      async () => {
        const request = createRequest({fetch: fetch404})
        try {
          await request({url: 'http://example.com/test'})
          expect.fail('should have thrown')
        } catch (err: unknown) {
          if (!(err instanceof HttpError)) throw err
          expect(stackNames(err)).toContain('request')
        }
      },
    )

    it.runIf(hasAsyncStackFrames)('as: "json" includes request and requestJson', async () => {
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

    it.runIf(hasAsyncStackFrames)('as: "text" includes request and requestText', async () => {
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

    it.runIf(hasAsyncStackFrames)('as: "stream" includes request and requestStream', async () => {
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
    it.runIf(hasAsyncStackFrames)('retry middleware appears in stack', async () => {
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

    it.runIf(hasAsyncStackFrames)(
      'named wrapping middleware appears when it awaits next()',
      async () => {
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
      },
    )

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
    it.runIf(hasCaptureStackTrace())(
      'bufferAndCheck and executeBuffered do not appear in stack',
      async () => {
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
      },
    )
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
})

/**
 * Extract function names from an Error stack trace.
 * Supports V8 (`at name (file)`), SpiderMonkey and JSC (`name@file`).
 */
function stackNames(error: Error): string[] {
  if (!error.stack) return []
  return error.stack
    .split('\n')
    .map((line) => {
      // V8: "    at funcName (file:line:col)" or "    at Object.funcName (file:line:col)"
      const v8 = line.match(/at (?:Object\.)?(\S+)\s*\(/)
      if (v8) return v8[1]
      // SpiderMonkey/JSC: "funcName@file:line:col" or "async*funcName@file:line:col"
      // Also handles "name/<@file" (Firefox closures). Excludes bare "@file" (anonymous).
      const sm = line.match(/^(?:async\*)?([^@/<]+)(?:\/<?)?@/)
      if (sm) return sm[1]
      return null
    })
    .filter((name): name is string => name !== null)
}

/**
 * Detect whether Error.captureStackTrace actually strips frames.
 * WebKit exposes the API but doesn't strip the target function.
 */
function hasV8CaptureStackTrace(ctor: ErrorConstructor): ctor is ErrorConstructor & {
  captureStackTrace(error: Error, omitAbove: (...args: never) => unknown): void
} {
  return 'captureStackTrace' in ctor
}

function hasCaptureStackTrace(): boolean {
  if (!hasV8CaptureStackTrace(Error)) return false
  function target() {
    const err = new Error()
    Error.captureStackTrace(err, target)
    return !err.stack?.includes('target')
  }
  return target()
}
