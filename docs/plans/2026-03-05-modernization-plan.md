# get-it v2 Modernization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite get-it from scratch as a fetch-based, TypeScript, ESM-only HTTP client with a clean middleware system.

**Architecture:** Universal core with zero dependencies wraps `fetch()`. Conditional exports give Node/Bun/Deno a pre-configured fetch with proxy-from-env. Two middleware types: flat transforms (invisible in stack traces) and wrapping functions (for retry). Response supports `as` option for body type selection, with `.json()`/`.text()`/`.bytes()` convenience methods.

**Tech Stack:** TypeScript (erasable syntax only), Vitest, `@sanity/pkg-utils`, undici (Node helpers only)

**Design doc:** `docs/plans/2026-03-05-modernization-design.md`

---

## Task 0: Repo Restructure

Archive old source code and start fresh while preserving repo-level config.

**Step 1: Archive old source**

```bash
mkdir _v1
mv src _v1/src
mv test _v1/test
mv test-esm _v1/test-esm 2>/dev/null || true
mv test-deno _v1/test-deno 2>/dev/null || true
```

**Step 2: Create new directory structure**

```bash
mkdir -p src
mkdir -p src/middleware
mkdir -p src/node
mkdir -p test
mkdir -p test/helpers
```

**Step 3: Copy test server infrastructure**

The test servers are well-built and reusable. Copy them:

```bash
cp -r _v1/test/helpers/server.ts test/helpers/server.ts
cp -r _v1/test/helpers/proxy.ts test/helpers/proxy.ts
cp -r _v1/test/helpers/globalSetup.http.ts test/helpers/globalSetup.http.ts
cp -r _v1/test/helpers/globalSetup.https.ts test/helpers/globalSetup.https.ts
cp -r _v1/test/helpers/globalSetup.proxy.http.ts test/helpers/globalSetup.proxy.http.ts
cp -r _v1/test/helpers/globalSetup.proxy.https.ts test/helpers/globalSetup.proxy.https.ts
cp -r _v1/test/certs test/certs
```

Adapt the server helper imports if needed — remove references to old get-it middleware. Create a minimal `test/helpers/index.ts`:

```ts
export const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
export const httpPort = 9980
export const httpsPort = 9443
export const baseUrl = `http://${hostname}:${httpPort}/req-test`
export const baseUrlHttps = `https://${hostname}:${httpsPort}/req-test`
```

**Step 4: Update config files**

- Update `tsconfig.settings.json` paths to reflect new structure
- Update `vite.config.ts` to point to new test helpers
- Strip `package.json` of old dependencies (`follow-redirects`, `tunnel-agent`, `@types/follow-redirects`) and old devDependencies no longer needed (`zen-observable`, `@types/zen-observable`, `node-fetch`, `parse-headers`)
- Remove old middleware path aliases, add new ones

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: archive v1 source, scaffold v2 structure"
```

---

## Task 1: Core Types

Define the public type surface for the new API.

**Files:**
- Create: `src/types.ts`

**Step 1: Write the types**

```ts
// Minimal fetch type — the subset of fetch() that get-it needs
type FetchFunction = (input: string, init?: FetchInit) => Promise<FetchResponse>

interface FetchInit {
  method?: string
  headers?: HeadersInit
  body?: BodyInit | null
  signal?: AbortSignal
  redirect?: RequestRedirect
}

interface FetchResponse {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  body: ReadableStream<Uint8Array> | null
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

// Instance configuration
interface CreateRequestOptions {
  base?: string
  headers?: Record<string, string>
  httpErrors?: boolean          // default: true
  timeout?: number | false
  fetch?: FetchFunction
  middleware?: Array<TransformMiddleware | WrappingMiddleware>
}

// Per-request options (when passing an object)
interface RequestOptions {
  url: string
  method?: string
  body?: unknown
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean | undefined>
  as?: 'json' | 'text' | 'stream'
  signal?: AbortSignal
  httpErrors?: boolean
  timeout?: number | false
  fetch?: FetchFunction
}

// Response types — conditional on `as`
interface BufferedResponse {
  status: number
  statusText: string
  headers: Headers
  body: Uint8Array
  json(): unknown
  text(): string
  bytes(): Uint8Array
}

interface JsonResponse<T = unknown> {
  status: number
  statusText: string
  headers: Headers
  body: T
}

interface TextResponse {
  status: number
  statusText: string
  headers: Headers
  body: string
}

interface StreamResponse {
  status: number
  statusText: string
  headers: Headers
  body: ReadableStream<Uint8Array>
}

// Middleware types
interface TransformMiddleware {
  beforeRequest?: (options: RequestOptions) => RequestOptions
  afterResponse?: (response: BufferedResponse) => BufferedResponse
}

type WrappingMiddleware = (
  options: RequestOptions,
  next: (options: RequestOptions) => Promise<BufferedResponse>
) => Promise<BufferedResponse>

// Error class
class HttpError extends Error {
  status: number
  statusText: string
  headers: Headers
  body: unknown
  response: BufferedResponse
}
```

Refine the exact generics and overloads. The request function needs overloaded signatures based on `as`:
- `as: 'json'` → `JsonResponse<T>`
- `as: 'text'` → `TextResponse`
- `as: 'stream'` → `StreamResponse`
- no `as` → `BufferedResponse`

**Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS (types only, no implementation yet — but must be valid TypeScript)

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: define v2 type surface"
```

---

## Task 2: Response Object

Build the response wrapper that provides `.json()`, `.text()`, `.bytes()`.

**Files:**
- Create: `src/response.ts`
- Create: `test/response.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { createBufferedResponse } from '../src/response'

describe('createBufferedResponse', () => {
  it('exposes status, statusText, headers', () => {
    const res = createBufferedResponse(200, 'OK', new Headers({ 'x-test': '1' }), new Uint8Array())
    expect(res.status).toBe(200)
    expect(res.statusText).toBe('OK')
    expect(res.headers.get('x-test')).toBe('1')
  })

  it('body is the raw Uint8Array', () => {
    const bytes = new TextEncoder().encode('hello')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.body).toEqual(bytes)
  })

  it('.text() decodes body as UTF-8 string', () => {
    const bytes = new TextEncoder().encode('hello world')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.text()).toBe('hello world')
  })

  it('.json() parses body as JSON', () => {
    const bytes = new TextEncoder().encode('{"name":"espen"}')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.json()).toEqual({ name: 'espen' })
  })

  it('.bytes() returns the same Uint8Array', () => {
    const bytes = new TextEncoder().encode('data')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.bytes()).toBe(bytes)
  })

  it('.json() and .text() can be called multiple times', () => {
    const bytes = new TextEncoder().encode('"hello"')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.json()).toBe('hello')
    expect(res.json()).toBe('hello')
    expect(res.text()).toBe('"hello"')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/response.test.ts
```

Expected: FAIL — `createBufferedResponse` does not exist

**Step 3: Implement**

Create `src/response.ts` with `createBufferedResponse(status, statusText, headers, body)` that returns a `BufferedResponse`. The `.text()` and `.json()` methods decode from the stored `Uint8Array`. Consider caching the decoded text string on first `.text()` call.

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/response.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/response.ts test/response.test.ts
git commit -m "feat: response object with .json()/.text()/.bytes()"
```

---

## Task 3: Minimal Core — createRequest with fetch

The simplest possible `createRequest` that makes a fetch call and returns a `BufferedResponse`. No middleware, no built-ins yet. Just: take a URL, call fetch, buffer the response.

**Files:**
- Create: `src/index.ts`
- Create: `test/basics.test.ts`

**Step 1: Write the failing test**

Tests should use the real test server (already running via globalSetup). Basic tests:

```ts
import { describe, expect, it } from 'vitest'
import { createRequest } from '../src/index'
import { baseUrl } from './helpers'

describe('createRequest - basics', () => {
  const request = createRequest()

  it('makes a GET request and returns a buffered response', async () => {
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to collect')
  })

  it('accepts a URL string', async () => {
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
  })

  it('accepts an options object with url', async () => {
    const res = await request({ url: `${baseUrl}/plain-text` })
    expect(res.status).toBe(200)
  })

  it('.json() parses JSON responses', async () => {
    const res = await request(`${baseUrl}/json`)
    expect(res.json()).toEqual({ foo: 'bar' })
  })

  it('.bytes() returns raw Uint8Array', async () => {
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.bytes()).toBeInstanceOf(Uint8Array)
  })

  it('sends POST with string body', async () => {
    const res = await request({
      url: `${baseUrl}/echo`,
      method: 'POST',
      body: 'hello',
    })
    expect(res.text()).toBe('hello')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/basics.test.ts
```

**Step 3: Implement minimal createRequest**

Create `src/index.ts` that exports `createRequest(options?)`. The function returns a request function that:
1. Normalizes input (string → `{ url }`)
2. Calls `fetch(url, init)` using `globalThis.fetch` or the injected fetch
3. Reads `response.arrayBuffer()`
4. Returns a `BufferedResponse` via `createBufferedResponse()`

No middleware, no built-ins. Just the bare fetch → buffered response pipeline.

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/basics.test.ts
```

**Step 5: Commit**

```bash
git add src/index.ts test/basics.test.ts
git commit -m "feat: minimal createRequest with fetch"
```

---

## Task 4: Built-in Behaviors

Add the inlined behaviors one at a time: base URL, headers, JSON body, query string, httpErrors, timeout. Each follows the same pattern: write test, implement, verify, commit.

**Files:**
- Modify: `src/index.ts`
- Create: `src/errors.ts` (for HttpError class)
- Create: `test/built-ins.test.ts`

### 4a: Base URL

**Test:**
```ts
it('prepends base URL to relative paths', async () => {
  const request = createRequest({ base: baseUrl })
  const res = await request('/plain-text')
  expect(res.text()).toBe('Just some plain text for you to collect')
})
```

Implementation: if `base` is set and `url` doesn't start with `http://` or `https://`, prepend it.

### 4b: Default Headers

**Test:**
```ts
it('sends default headers on every request', async () => {
  const request = createRequest({ base: baseUrl, headers: { 'X-Custom': 'hello' } })
  const res = await request('/debug')
  const debug = res.json() as any
  expect(debug.headers['x-custom']).toBe('hello')
})

it('per-request headers merge with defaults', async () => {
  const request = createRequest({ base: baseUrl, headers: { 'X-A': '1' } })
  const res = await request({ url: '/debug', headers: { 'X-B': '2' } })
  const debug = res.json() as any
  expect(debug.headers['x-a']).toBe('1')
  expect(debug.headers['x-b']).toBe('2')
})

it('per-request headers override defaults', async () => {
  const request = createRequest({ base: baseUrl, headers: { 'X-A': '1' } })
  const res = await request({ url: '/debug', headers: { 'X-A': '2' } })
  const debug = res.json() as any
  expect(debug.headers['x-a']).toBe('2')
})
```

Implementation: merge `instanceHeaders` with `requestHeaders`, request wins.

### 4c: JSON Request Body

**Test:**
```ts
it('auto-serializes plain object body as JSON', async () => {
  const request = createRequest({ base: baseUrl })
  const res = await request({ url: '/json-echo', method: 'POST', body: { foo: 'bar' } })
  expect(res.json()).toEqual({ foo: 'bar' })
})

it('sets content-type to application/json for object bodies', async () => {
  const request = createRequest({ base: baseUrl })
  const res = await request({ url: '/debug', method: 'POST', body: { test: true } })
  const debug = res.json() as any
  expect(debug.headers['content-type']).toBe('application/json')
})

it('does not serialize string bodies as JSON', async () => {
  const request = createRequest({ base: baseUrl })
  const res = await request({ url: '/echo', method: 'POST', body: 'raw string' })
  expect(res.text()).toBe('raw string')
})
```

Implementation: use a `isPlainObject()` check. If body is a plain object or array, `JSON.stringify()` it and set `content-type: application/json`.

### 4d: Query String

**Test:**
```ts
it('appends query parameters to URL', async () => {
  const request = createRequest({ base: baseUrl })
  const res = await request({ url: '/query-string', query: { foo: 'bar', num: 42 } })
  expect(res.json()).toEqual({ foo: 'bar', num: '42' })
})

it('merges with existing query parameters', async () => {
  const request = createRequest({ base: baseUrl })
  const res = await request({ url: '/query-string?existing=1', query: { added: '2' } })
  const body = res.json() as any
  expect(body.existing).toBe('1')
  expect(body.added).toBe('2')
})

it('skips undefined query values', async () => {
  const request = createRequest({ base: baseUrl })
  const res = await request({ url: '/query-string', query: { a: '1', b: undefined } })
  const body = res.json() as any
  expect(body.a).toBe('1')
  expect(body).not.toHaveProperty('b')
})
```

Implementation: use `URL` and `URLSearchParams` to build the query string.

### 4e: HTTP Errors

**Test:**
```ts
it('throws HttpError on 4xx status by default', async () => {
  const request = createRequest({ base: baseUrl })
  await expect(request('/status?code=404')).rejects.toThrow(HttpError)
  try {
    await request('/status?code=404')
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError)
    expect((err as HttpError).status).toBe(404)
    expect((err as HttpError).response).toBeDefined()
  }
})

it('throws HttpError on 5xx status by default', async () => {
  const request = createRequest({ base: baseUrl })
  await expect(request('/status?code=500')).rejects.toThrow(HttpError)
})

it('does not throw when httpErrors is false (instance)', async () => {
  const request = createRequest({ base: baseUrl, httpErrors: false })
  const res = await request('/status?code=404')
  expect(res.status).toBe(404)
})

it('does not throw when httpErrors is false (per-request)', async () => {
  const request = createRequest({ base: baseUrl })
  const res = await request({ url: '/status?code=404', httpErrors: false })
  expect(res.status).toBe(404)
})
```

Implementation: create `src/errors.ts` with `HttpError` class. After buffering response, check `status >= 400` and throw if `httpErrors !== false`.

### 4f: Timeout

**Test:**
```ts
it('aborts request after timeout', async () => {
  const request = createRequest({ base: baseUrl, timeout: 200 })
  await expect(request('/delay?delay=2000')).rejects.toThrow()
})

it('per-request timeout overrides instance timeout', async () => {
  const request = createRequest({ base: baseUrl, timeout: 5000 })
  await expect(request({ url: '/delay?delay=2000', timeout: 200 })).rejects.toThrow()
})

it('timeout: false disables timeout', async () => {
  const request = createRequest({ base: baseUrl, timeout: false })
  const res = await request('/delay?delay=200')
  expect(res.status).toBe(200)
})
```

Implementation: use `AbortSignal.timeout(ms)`. If user also provides a `signal`, combine with `AbortSignal.any([userSignal, timeoutSignal])`.

### 4g: Cancellation via AbortSignal

**Test:**
```ts
it('aborts request when signal is aborted', async () => {
  const controller = new AbortController()
  const request = createRequest({ base: baseUrl })
  const promise = request({ url: '/delay?delay=5000', signal: controller.signal })
  controller.abort()
  await expect(promise).rejects.toThrow()
})
```

Implementation: pass `signal` through to `fetch()`. Combined with timeout signal via `AbortSignal.any()` if both exist.

**After all sub-tasks pass, commit:**

```bash
git add src/ test/built-ins.test.ts
git commit -m "feat: built-in behaviors (base, headers, json body, query, httpErrors, timeout)"
```

---

## Task 5: The `as` Option

Add response body type selection.

**Files:**
- Modify: `src/index.ts`
- Create: `test/as-option.test.ts`

**Test:**
```ts
describe('as option', () => {
  const request = createRequest({ base: baseUrl })

  it('as: "json" returns parsed JSON body', async () => {
    const res = await request({ url: '/json', as: 'json' })
    expect(res.body).toEqual({ foo: 'bar' })
  })

  it('as: "text" returns string body', async () => {
    const res = await request({ url: '/plain-text', as: 'text' })
    expect(typeof res.body).toBe('string')
    expect(res.body).toBe('Just some plain text for you to collect')
  })

  it('as: "stream" returns ReadableStream', async () => {
    const res = await request({ url: '/plain-text', as: 'stream' })
    expect(res.body).toBeInstanceOf(ReadableStream)
    // Read the stream to verify content
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let done = false
    while (!done) {
      const result = await reader.read()
      if (result.value) chunks.push(result.value)
      done = result.done
    }
    const text = new TextDecoder().decode(new Uint8Array(
      chunks.reduce((acc, c) => [...acc, ...c], [] as number[])
    ))
    expect(text).toBe('Just some plain text for you to collect')
  })

  it('as: "stream" returns response immediately (before body is consumed)', async () => {
    const res = await request({ url: '/drip', as: 'stream' })
    expect(res.status).toBe(200)
    expect(res.body).toBeInstanceOf(ReadableStream)
    // Cancel the stream — we just want to verify it's available before completion
    await res.body.cancel()
  })

  it('no as: body is Uint8Array with convenience methods', async () => {
    const res = await request(`${baseUrl}/json`)
    expect(res.body).toBeInstanceOf(Uint8Array)
    expect(res.json()).toEqual({ foo: 'bar' })
    expect(typeof res.text()).toBe('string')
  })
})
```

Implementation:
- `as: 'stream'` — return response with `body: fetchResponse.body` without consuming it. No `.json()`/`.text()`/`.bytes()` methods.
- `as: 'json'` — buffer body, parse as JSON, return with `body: parsed`.
- `as: 'text'` — buffer body, decode as text, return with `body: text`.
- No `as` — buffer body, return `BufferedResponse` with convenience methods.

Note: `httpErrors` check must happen before body consumption for all modes, since it only needs headers + status.

Wait — for httpErrors we need to still read the body for the error message. Approach: for `as: 'stream'` with httpErrors, we need to buffer the body on error to attach it to `HttpError`. For successful stream responses, don't consume.

**Commit:**
```bash
git add src/ test/as-option.test.ts
git commit -m "feat: as option for response body type"
```

---

## Task 6: Injectable Fetch

**Files:**
- Modify: `src/index.ts`
- Create: `test/injectable-fetch.test.ts`

**Test:**
```ts
describe('injectable fetch', () => {
  it('uses injected fetch at instance level', async () => {
    let calledWith: string | undefined
    const fakeFetch = async (input: string, init?: any) => {
      calledWith = input
      return new Response('mocked', { status: 200 })
    }
    const request = createRequest({ fetch: fakeFetch })
    const res = await request('https://example.com/test')
    expect(calledWith).toBe('https://example.com/test')
    expect(res.text()).toBe('mocked')
  })

  it('uses per-request fetch override', async () => {
    let instanceCalled = false
    let requestCalled = false
    const instanceFetch = async () => { instanceCalled = true; return new Response('instance') }
    const requestFetch = async () => { requestCalled = true; return new Response('request') }

    const request = createRequest({ fetch: instanceFetch })
    const res = await request({ url: 'https://example.com', fetch: requestFetch })
    expect(instanceCalled).toBe(false)
    expect(requestCalled).toBe(true)
    expect(res.text()).toBe('request')
  })

  it('falls back to globalThis.fetch when not injected', async () => {
    const request = createRequest({ base: baseUrl })
    const res = await request('/plain-text')
    expect(res.status).toBe(200)
  })
})
```

Implementation: resolve fetch as `perRequestFetch ?? instanceFetch ?? globalThis.fetch`.

**Commit:**
```bash
git add src/ test/injectable-fetch.test.ts
git commit -m "feat: injectable fetch (instance + per-request)"
```

---

## Task 7: Middleware System

The core middleware execution engine.

**Files:**
- Create: `src/middleware.ts` (the engine, not the middleware exports)
- Create: `test/middleware.test.ts`

**Test:**
```ts
describe('middleware system', () => {
  it('runs beforeRequest transforms in order', async () => {
    const order: string[] = []
    const request = createRequest({
      base: baseUrl,
      middleware: [
        { beforeRequest: (opts) => { order.push('a'); return opts } },
        { beforeRequest: (opts) => { order.push('b'); return opts } },
      ],
    })
    await request('/plain-text')
    expect(order).toEqual(['a', 'b'])
  })

  it('beforeRequest can modify options', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [
        { beforeRequest: (opts) => ({ ...opts, headers: { ...opts.headers, 'X-Added': '1' } }) },
      ],
    })
    const res = await request({ url: '/debug' })
    const debug = res.json() as any
    expect(debug.headers['x-added']).toBe('1')
  })

  it('runs afterResponse transforms in order', async () => {
    const order: string[] = []
    const request = createRequest({
      base: baseUrl,
      middleware: [
        { afterResponse: (res) => { order.push('a'); return res } },
        { afterResponse: (res) => { order.push('b'); return res } },
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
    const request = createRequest({ base: baseUrl, middleware: [wrapping] })
    await request('/plain-text')
    expect(wrappedCalled).toBe(true)
  })

  it('wrapping middleware can retry on failure', async () => {
    let attempts = 0
    const retryOnce: WrappingMiddleware = async (opts, next) => {
      try {
        attempts++
        return await next(opts)
      } catch {
        attempts++
        return await next(opts)
      }
    }
    // Use the /fail endpoint which succeeds after N attempts
    const request = createRequest({ base: baseUrl, middleware: [retryOnce] })
    const res = await request('/fail?n=1')
    expect(res.status).toBe(200)
    expect(attempts).toBe(2)
  })

  it('wrapping middleware appears in error stack traces', async () => {
    async function myNamedMiddleware(opts: any, next: any) {
      return next(opts)
    }
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [myNamedMiddleware],
    })
    // This test just verifies middleware is in the call chain
    const res = await request('/plain-text')
    expect(res.status).toBe(200)
  })

  it('transform and wrapping middleware compose correctly', async () => {
    const order: string[] = []
    const request = createRequest({
      base: baseUrl,
      middleware: [
        { beforeRequest: (opts) => { order.push('before'); return opts } },
        async (opts, next) => { order.push('wrap-pre'); const r = await next(opts); order.push('wrap-post'); return r },
        { afterResponse: (res) => { order.push('after'); return res } },
      ],
    })
    await request('/plain-text')
    expect(order).toEqual(['before', 'wrap-pre', 'wrap-post', 'after'])
  })
})
```

Implementation:
1. Separate middleware array into transforms and wrappers (by checking `typeof mw === 'function'`).
2. Collect all `beforeRequest` hooks and all `afterResponse` hooks from transforms.
3. Build the execution chain:
   - Run `beforeRequest` transforms sequentially
   - Nest wrapping middlewares around the core fetch call
   - Run `afterResponse` transforms sequentially
4. The built-in behaviors (base, headers, etc.) execute before all middleware.

**Commit:**
```bash
git add src/middleware.ts test/middleware.test.ts
git commit -m "feat: middleware system (transform + wrapping)"
```

---

## Task 8: Retry Middleware

**Files:**
- Create: `src/middleware/retry.ts`
- Create: `test/retry.test.ts`

**Step 1: Write tests**

```ts
describe('retry middleware', () => {
  const request = createRequest({ base: baseUrl, middleware: [retry()] })

  it('retries on network error', async () => {
    // /fail?n=2 succeeds on 3rd attempt
    const res = await request('/fail?n=2')
    expect(res.status).toBe(200)
  })

  it('respects maxRetries', async () => {
    const request = createRequest({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({ maxRetries: 1 })],
    })
    await expect(request('/permafail')).rejects.toThrow()
  })

  it('does not retry HTTP errors by default', async () => {
    let attempts = 0
    const countingMiddleware = async (opts: any, next: any) => { attempts++; return next(opts) }
    const request = createRequest({
      base: baseUrl,
      middleware: [countingMiddleware, retry()],
    })
    await expect(request('/status?code=500')).rejects.toThrow()
    expect(attempts).toBe(1)
  })

  it('accepts custom shouldRetry', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [retry({
        maxRetries: 2,
        shouldRetry: (error, attemptNumber) => attemptNumber < 2,
      })],
    })
    await expect(request('/permafail')).rejects.toThrow()
  })

  it('uses exponential backoff', async () => {
    const start = Date.now()
    const request = createRequest({
      base: baseUrl,
      middleware: [retry({ maxRetries: 2, retryDelay: (n) => n * 100 })],
    })
    await expect(request('/permafail')).rejects.toThrow()
    const elapsed = Date.now() - start
    // Should have waited ~100ms + ~200ms = ~300ms
    expect(elapsed).toBeGreaterThan(200)
  })
})
```

**Step 2: Implement**

`src/middleware/retry.ts` — a wrapping middleware. Loop up to `maxRetries`, call `next()`, catch errors, check `shouldRetry()`, wait `retryDelay(attempt)`, retry. Default `shouldRetry` checks for network errors (not HttpError). Default delay: `100 * 2^attempt + Math.random() * 100`.

Reference `_v1/src/middleware/retry/shared-retry.ts` and `_v1/src/util/node-shouldRetry.ts` for the shouldRetry logic.

**Commit:**
```bash
git add src/middleware/retry.ts test/retry.test.ts
git commit -m "feat: retry middleware"
```

---

## Task 9: Debug Middleware

**Files:**
- Create: `src/middleware/debug.ts`
- Create: `test/debug.test.ts`

**Test:**
```ts
describe('debug middleware', () => {
  it('logs request and response', async () => {
    const logs: string[] = []
    const log = (msg: string) => logs.push(msg)
    const request = createRequest({
      base: baseUrl,
      middleware: [debug({ log })],
    })
    await request('/plain-text')
    expect(logs.some(l => l.includes('GET'))).toBe(true)
    expect(logs.some(l => l.includes('200'))).toBe(true)
  })

  it('redacts specified headers', async () => {
    const logs: string[] = []
    const log = (msg: string, ...args: unknown[]) => logs.push(`${msg} ${JSON.stringify(args)}`)
    const request = createRequest({
      base: baseUrl,
      headers: { Authorization: 'Bearer secret' },
      middleware: [debug({ log, redactHeaders: ['authorization'] })],
    })
    await request('/plain-text')
    const allLogs = logs.join('\n')
    expect(allLogs).not.toContain('secret')
    expect(allLogs).toContain('REDACTED')
  })

  it('works with no log function (noop)', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [debug()],
    })
    // Should not throw
    const res = await request('/plain-text')
    expect(res.status).toBe(200)
  })
})
```

**Implementation:** Transform middleware with `beforeRequest` (log method + URL + headers) and `afterResponse` (log status + timing). Redact headers from the redactHeaders list before logging.

**Commit:**
```bash
git add src/middleware/debug.ts test/debug.test.ts
git commit -m "feat: debug middleware with header redaction"
```

---

## Task 10: URL-Encoded Middleware

**Files:**
- Create: `src/middleware/urlEncoded.ts`
- Create: `test/urlEncoded.test.ts`

**Test:**
```ts
describe('urlEncoded middleware', () => {
  it('encodes object body as x-www-form-urlencoded', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [urlEncoded()],
    })
    const res = await request({ url: '/urlencoded', method: 'POST', body: { foo: 'bar', baz: 'qux' } })
    expect(res.json()).toEqual({ foo: 'bar', baz: 'qux' })
  })

  it('sets content-type header', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [urlEncoded()],
    })
    const res = await request({ url: '/debug', method: 'POST', body: { foo: 'bar' } })
    const debug = res.json() as any
    expect(debug.headers['content-type']).toContain('application/x-www-form-urlencoded')
  })
})
```

Note: when `urlEncoded()` is used, it should take priority over the built-in JSON body serialization. The middleware's `beforeRequest` should encode the body and set content-type, so the core sees a string body with content-type already set and skips JSON serialization.

Reference `_v1/src/middleware/urlEncoded.ts` for encoding logic.

**Commit:**
```bash
git add src/middleware/urlEncoded.ts test/urlEncoded.test.ts
git commit -m "feat: urlEncoded middleware"
```

---

## Task 11: Middleware Barrel Export

**Files:**
- Create: `src/middleware/index.ts`

Export all middleware from `get-it/middleware`:

```ts
export { retry } from './retry'
export { debug } from './debug'
export { urlEncoded } from './urlEncoded'
```

Update `package.json` exports to add the `./middleware` entry point.

**Commit:**
```bash
git add src/middleware/index.ts package.json
git commit -m "feat: middleware barrel export"
```

---

## Task 12: Node Entry Point with Proxy-from-env

**Files:**
- Create: `src/node/index.ts`
- Create: `src/node/nodeFetch.ts`
- Create: `src/index.node.ts` (the Node-specific entry point)
- Create: `test/node-proxy.test.ts`

**Step 1: Create nodeFetch helper**

`src/node/nodeFetch.ts` — creates a fetch function using undici's `EnvHttpProxyAgent` or `ProxyAgent` or `Agent`:

```ts
import { fetch as undiciFetch, EnvHttpProxyAgent, ProxyAgent, Agent } from 'undici'

interface NodeFetchOptions {
  proxy?: string | boolean  // true = read from env, string = explicit URL
  maxSockets?: number
  maxTotalSockets?: number
  allowH2?: boolean
}

function nodeFetch(options?: NodeFetchOptions): FetchFunction {
  // Build undici Agent/ProxyAgent/EnvHttpProxyAgent based on options
  // Return a fetch function bound to that dispatcher
}
```

**Step 2: Create Node entry point**

`src/index.node.ts` — re-exports `createRequest` but with a default fetch that uses `EnvHttpProxyAgent`:

```ts
import { createRequest as coreCreateRequest } from './index'
import { nodeFetch } from './node/nodeFetch'

const defaultNodeFetch = nodeFetch({ proxy: true })

function createRequest(options?: CreateRequestOptions) {
  return coreCreateRequest({
    ...options,
    fetch: options?.fetch ?? defaultNodeFetch,
  })
}

export { createRequest }
// Re-export everything else from core
export * from './types'
```

**Step 3: Update package.json conditional exports**

```json
{
  "exports": {
    ".": {
      "node": { "source": "./src/index.node.ts", "import": "./dist/index.node.js" },
      "bun": { "source": "./src/index.node.ts", "import": "./dist/index.node.js" },
      "deno": { "source": "./src/index.node.ts", "import": "./dist/index.node.js" },
      "default": { "source": "./src/index.ts", "import": "./dist/index.js" }
    }
  }
}
```

**Step 4: Write proxy tests**

```ts
describe('node proxy support', () => {
  it('uses proxy from environment variable', async () => {
    // Use the proxy test server on port 4000
    // Set HTTP_PROXY env, make request, verify it went through proxy
  })

  it('nodeFetch with explicit proxy', async () => {
    const request = createRequest({
      fetch: nodeFetch({ proxy: `http://localhost:4000` }),
    })
    // Verify request goes through proxy
  })
})
```

Reference `_v1/test/proxy.test.ts` for proxy test patterns.

Note: `undici` must be added as a dependency (or peer dependency for Node entry).

**Commit:**
```bash
git add src/node/ src/index.node.ts test/node-proxy.test.ts package.json
git commit -m "feat: node entry point with proxy-from-env"
```

---

## Task 13: mTLS Middleware

**Files:**
- Create: `src/middleware/mtls.ts`
- Create: `test/mtls.test.ts`

Node-only middleware. Uses undici's `Agent` with TLS options to create a custom fetch.

Reference `_v1/test/mtls.test.ts` and `_v1/test/helpers/mtls.ts` for the test server setup and test patterns. Copy the mTLS test helper that creates a custom HTTPS server requiring client certs.

**Commit:**
```bash
git add src/middleware/mtls.ts test/mtls.test.ts
git commit -m "feat: mtls middleware"
```

---

## Task 14: Build & Package Configuration

**Files:**
- Modify: `package.json`
- Modify: `package.config.ts`
- Modify: `tsconfig.settings.json`
- Possibly modify: `tsconfig.dist.json`

**Step 1: Update package.json**

- Remove old dependencies: `follow-redirects`, `@types/follow-redirects`, `tunnel-agent`
- Add dependency: `undici` (for Node entry point — check if we need it as dep or if Node built-in suffices)
- Remove old devDependencies: `zen-observable`, `@types/zen-observable`, `node-fetch`, `parse-headers`
- Update exports map for new entry points
- Remove `main`, `module`, `browser` fields (using exports only)
- Remove `require` entries (ESM-only)
- Update `files` to include only new dist/src
- Update scripts if needed

**Step 2: Update build config**

Update `package.config.ts` to build the new entry points. Remove RSC-specific bundle config unless needed.

**Step 3: Update TypeScript config**

Update path aliases in `tsconfig.settings.json`:
```json
{
  "paths": {
    "get-it": ["./src"],
    "get-it/middleware": ["./src/middleware"],
    "get-it/node": ["./src/node"]
  }
}
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Verify typecheck**

```bash
npm run typecheck
```

**Commit:**
```bash
git add package.json package.config.ts tsconfig.settings.json
git commit -m "chore: update build config for v2"
```

---

## Task 15: Cross-environment Test Setup

Update vitest configs for the new codebase. Ensure tests run in:
- Node (default)
- Browser (happy-dom)
- Edge runtime

**Files:**
- Modify: `vite.config.ts`
- Modify: `vitest.browser.config.ts`
- Modify: `vitest.edge.config.ts`
- Possibly remove: `vitest.react-server.config.ts` (evaluate if still needed)

**Step 1: Update configs**

Point module aliases to new source files. Verify test paths point to new `test/` directory.

**Step 2: Run all test suites**

```bash
npm test
npm run test:browser
npm run test:edge-runtime
```

Fix any environment-specific issues (e.g. `AbortSignal.any()` or `AbortSignal.timeout()` availability).

**Commit:**
```bash
git add vite.config.ts vitest.*.config.ts
git commit -m "chore: update test configs for v2"
```

---

## Task 16: Migration Guide

**Files:**
- Create: `docs/MIGRATION-v2.md`

Write a comprehensive migration guide covering:
- API changes (with before/after code examples)
- Removed features and alternatives
- New features
- Breaking changes checklist

Use the migration table from the design doc as a starting point, but expand each entry with full code examples.

**Commit:**
```bash
git add docs/MIGRATION-v2.md
git commit -m "docs: v2 migration guide"
```

---

## Task 17: Migration Skill

Create a Claude skill that helps consumers migrate their code from get-it v1 to v2.

**Files:**
- Create: `.claude/skills/migrate-get-it-v2.md`

The skill should:
1. Search the consumer's codebase for get-it v1 usage patterns
2. Identify each pattern (imports, middleware usage, CancelToken, observable, etc.)
3. Apply the transformation from the migration guide
4. Handle edge cases (custom middleware, unusual configurations)

Structure it as a systematic find-and-replace workflow:
- Find all `getIt` / `get-it` imports
- Find all middleware imports and usages
- Find CancelToken patterns → AbortController
- Find observable patterns → promise
- Find `stream: true` → `as: 'stream'`
- Find `rawBody: true` → no `as` (body is Uint8Array)
- Update response access patterns (`.body` → `.json()` / `.text()`)

**Commit:**
```bash
git add .claude/skills/migrate-get-it-v2.md
git commit -m "feat: claude skill for v1 → v2 migration"
```

---

## Task 18: Cleanup

Final cleanup pass:

1. **Remove `_v1/` directory** — all reference work is done
2. **Update README.md** — new API, new examples
3. **Run full test suite** across all environments
4. **Run build** and verify output
5. **Run `npm pack --dry-run`** to check published files

**Commit:**
```bash
git rm -r _v1
git add -A
git commit -m "chore: remove v1 archive, finalize v2"
```
