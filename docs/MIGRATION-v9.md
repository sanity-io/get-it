# Migrating from get-it v8 to v9

get-it v9 is a full rewrite. It replaces the pub/sub channel system and the Node `http`/`https` transport with the standard `fetch()`. It also removes CommonJS and makes the API smaller.

This guide covers every breaking change and shows how to update your code.

## Migrating with an AI agent

This guide is also a playbook for a coding agent. Point your agent at the full document, not only at the quick reference. Use this sequence:

1. Search the codebase for these v8 patterns:
   - `getIt(`, `from 'get-it'`, `require('get-it')`, `.use(`, `.clone()`
   - `statusCode`, `statusMessage`, `.body`, and bracket-notation header access
   - `CancelToken`, `cancelToken`, `isCancel`, `withCredentials`, `requestId`
   - `stream: true`, `rawBody`, `onlyBody`, `compress`
   - the removed middleware: `promise`, `jsonRequest`, `jsonResponse`, `httpErrors`, `base`, `headers`, `observable`, `progress`, `keepAlive`, `agent`, `proxy`, `urlEncoded`
2. Apply the mappings from the sections below to each match.
3. Run `tsc --noEmit`, then run the test suite.
4. Search again for `statusCode`, bracket-notation header access, `CancelToken`, and custom request properties. Move the custom properties to `meta`.

## Quick reference

| v8                              | v9                                                 |
| ------------------------------- | -------------------------------------------------- |
| `getIt([promise(), base(url)])` | `createRequester({ base: url })`                   |
| `res.body` (pre-parsed)         | `res.json()` / `res.text()` / `as` option          |
| `res.statusCode`                | `res.status`                                       |
| `res.statusMessage`             | `res.statusText`                                   |
| `res.headers` (plain object)    | `res.headers` (`Headers` instance)                 |
| `stream: true`                  | `as: 'stream'`                                     |
| `rawBody: true`                 | default (body is `Uint8Array`)                     |
| `promise.CancelToken.source()`  | `new AbortController()`                            |
| `cancelToken: source.token`     | `signal: controller.signal`                        |
| `jsonResponse()` middleware     | `as: 'json'` or `res.json()`                       |
| `jsonRequest()` middleware      | built-in (auto-serializes objects)                 |
| `httpErrors()` middleware       | built-in, on by default                            |
| `headers({...})` middleware     | `createRequester({ headers: {...} })`              |
| `base(url)` middleware          | `createRequester({ base: url })`                   |
| `observable()` middleware       | wrap with `defer(() => promise)` in consumer       |
| `progress()` middleware         | removed, no replacement                            |
| `keepAlive()` middleware        | built into fetch                                   |
| `agent(opts)` middleware        | `createNodeFetch(opts)` or injectable `fetch`      |
| `proxy(opts)` middleware        | automatic, with conditional exports                |
| `mtls(opts)` middleware         | `createNodeFetch({ tls: { cert, key, ca } })`      |
| `bodySize: N`                   | `headers: {'content-length': N}`                   |
| `compress: false`               | removed (fetch always negotiates compression)      |
| `onlyBody: true`                | removed (use `res.body` / `res.json()` directly)   |
| `fetch: {cache: 'no-store'}`    | wrap fetch (see below)                             |
| `withCredentials: true`         | `credentials: 'include'`                           |
| `require('get-it')`             | `import { createRequester } from 'get-it'`         |
| `require('get-it/middleware')`  | `import { retry, debug } from 'get-it/middleware'` |

## Installation

```bash
npm install get-it@^9
```

v9 is ESM-only. If your project uses CommonJS, do one of these:

- Change the project to ESM (`"type": "module"` in package.json)
- Use a dynamic `import()` from CommonJS

## Behavioral changes

### `remoteAddress` removed from responses

v8.7.0 added `response.remoteAddress`. This field held the IP address of the server, from the `http` socket of Node. v9 uses `fetch()`, which does not expose socket-level data. There is no equivalent and no workaround.

### No redirect limit control

v8 used `follow-redirects`, which supported a `maxRedirects` option with a default of 5. v9 uses `fetch()`, which follows redirects automatically. You cannot limit the count. The `redirect` option on fetch supports `'follow'` (the default), `'error'` (reject on any redirect), and `'manual'` (do not follow, return the 3xx response).

To block all redirects, pass `redirect: 'error'` or `redirect: 'manual'` in the fetch init. You cannot allow _some_ redirects and limit the count, because fetch does not expose this control.

### Retry middleware: changed set of retryable errors

The retry middleware of v8 treated `ENOTFOUND` and `ENETUNREACH` as non-retryable. v9 retries `ENOTFOUND` (a DNS resolution failure), because a temporary DNS failure on a valid hostname can give `ENOTFOUND` and not `EAI_AGAIN`. `ENETUNREACH` (no route to host) stays non-retryable. This code shows a routing error or a network interface error, and a retry cannot correct it.

These are the retryable error codes in v9:

| Retried                   | Not retried   |
| ------------------------- | ------------- |
| `ECONNRESET`              | `ENETUNREACH` |
| `ECONNREFUSED`            | HTTP errors   |
| `ETIMEDOUT`               |               |
| `EPIPE`                   |               |
| `ENOTFOUND` _(new)_       |               |
| `ENETDOWN`                |               |
| `EHOSTUNREACH`            |               |
| `EAI_AGAIN`               |               |
| `UND_ERR_CONNECT_TIMEOUT` |               |
| `UND_ERR_SOCKET`          |               |

To get the v8 behavior again, supply your own `shouldRetry`:

```ts
import {retry} from 'get-it/middleware'

const request = createRequester({
  middleware: [
    retry({
      shouldRetry: (error) => {
        if (!(error instanceof Error)) return false
        const code = 'code' in error ? error.code : undefined
        return code !== 'ENOTFOUND' // don't retry DNS failures
      },
    }),
  ],
})
```

### Per-request retry overrides limited to `maxRetries`

v8 permitted all retry options on an individual request:

```ts
// v8
await request({url: '/critical', maxRetries: 10, shouldRetry: customPredicate})
```

v9 keeps `maxRetries` on a request. It overrides the value in the middleware for that request, and it can increase or decrease the value:

```ts
// v9
await request({url: '/critical', maxRetries: 10})
await request({url: '/no-retries', maxRetries: 0})
```

You set `retryDelay` and `shouldRetry` one time, when you create the middleware. To use different values for different requests, create separate request instances:

```ts
// v9
import {retry} from 'get-it/middleware'

const request = createRequester({
  base: 'https://api.example.com',
  middleware: [retry({maxRetries: 3})],
})

const criticalRequest = createRequester({
  base: 'https://api.example.com',
  middleware: [retry({maxRetries: 10, shouldRetry: customPredicate})],
})
```

As an alternative, use `meta` to pass hints, with your own `shouldRetry` that reads them:

```ts
const request = createRequester({
  middleware: [
    retry({
      shouldRetry: (error, attempt, opts) => {
        const max = typeof opts.meta?.['maxRetries'] === 'number' ? opts.meta['maxRetries'] : 5
        return attempt < max
      },
    }),
  ],
})

await request({url: '/critical', meta: {maxRetries: 10}})
```

v9 exports the default retry helpers. You can extend them, and you do not have to write new ones:

```ts
import {retry, isRetryableRequest, getRetryDelay} from 'get-it/middleware'

const request = createRequester({
  middleware: [
    retry({
      shouldRetry: (error, attempt, opts) => {
        // Retry POST on ECONNRESET, plus all defaults
        if (opts.method === 'POST') {
          const cause = error instanceof Error ? error.cause : undefined
          if (cause instanceof Error && 'code' in cause && cause.code === 'ECONNRESET') {
            return true
          }
        }
        return isRetryableRequest(error, attempt, opts)
      },
      retryDelay: getRetryDelay,
    }),
  ],
})
```

### Query parameters no longer accept arrays

v8 expanded an array into repeated keys: `{tags: ['a', 'b']}` → `tags=a&tags=b`. The `query` option of v9 accepts only scalar values (`string | number | boolean | undefined`). If you pass an array, `String()` gives one comma-joined value, with no warning:

```ts
// v8
await request({url: '/api', query: {tags: ['a', 'b']}})
// → /api?tags=a&tags=b

// v9: WRONG, produces /api?tags=a%2Cb
await request({url: '/api', query: {tags: ['a', 'b']}})
```

If you need repeated query keys, pass a `URLSearchParams` instance:

```ts
const params = new URLSearchParams()
params.append('tags', 'a')
params.append('tags', 'b')
await request({url: '/api', query: params})
```

### `withCredentials` replaced by `credentials`

v8 used the XHR-style boolean `withCredentials: true` to send cookies to a different origin. v9 uses the fetch-style `credentials` option:

```ts
// v8
await request({url: '/api', withCredentials: true})

// v9
await request({url: '/api', credentials: 'include'})
```

The mapping:

| v8                       | v9                                             |
| ------------------------ | ---------------------------------------------- |
| `withCredentials: true`  | `credentials: 'include'`                       |
| `withCredentials: false` | `credentials: 'omit'`                          |
| _(not set)_              | `credentials: 'same-origin'` (browser default) |

`credentials` obeys the fetch API. get-it sends it each time that you set it, and it does the same in browser workers and edge runtimes.

### `fetch` option changed meaning

In v8, the `fetch` option on the request options was a `boolean | Omit<RequestInit, 'method'>`. It selected the native `fetch` API in place of the `http` and `https` modules of Node. It also sent `RequestInit` options such as `cache`:

```ts
// v8: opt into native fetch with cache control
await request({url: '/api', fetch: {cache: 'no-store'}})
```

v9 always uses `fetch`, because there is no `http` or `https` transport. On both `RequesterOptions` and `RequestOptions`, the `fetch` option is now a `FetchFunction`. It is an injectable fetch implementation, not a flag.

To pass `RequestInit` options such as `cache`, wrap the global fetch:

```ts
const request = createRequester({
  fetch: (url, init) => globalThis.fetch(url, {...init, cache: 'no-store'}),
})
```

### `clone()` removed

v8 had `request.clone()`. It created derived requesters that inherited the middleware stack of the parent. v9 has no `clone()`. `createRequester` takes a plain options object, so you get the same result when you spread a shared configuration:

```ts
// v8
const base = getIt([base('https://api.example.com'), promise()])
const withAuth = base.clone().use(headers({Authorization: 'Bearer ...'}))

// v9
const shared = {
  base: 'https://api.example.com',
  middleware: [retry()],
}

const request = createRequester(shared)
const withAuth = createRequester({
  ...shared,
  headers: {Authorization: 'Bearer ...'},
})
```

### `onlyBody` removed

In v8, `promise({ onlyBody: true })` resolved with the response body only, and not with the full response object. v9 always resolves with the full response. Read the body directly:

```ts
// v8
const body = await request({url: '/users'}) // with onlyBody: true

// v9
const res = await request({url: '/users', as: 'json'})
const body = res.body
```

### `compress` removed

v8 supported a `compress` option with a default of `true`. It sent an `accept-encoding: gzip, deflate` header. In v9, fetch does the content negotiation automatically, and there is no option to disable it.

## Creating a request instance

### Before (v8)

```ts
import getIt from 'get-it'
import {promise, base, headers, jsonRequest, jsonResponse, httpErrors} from 'get-it/middleware'

const request = getIt([
  base('https://api.example.com'),
  headers({Authorization: 'Bearer ...'}),
  jsonRequest(),
  jsonResponse(),
  httpErrors(),
  promise(),
])
```

### After (v9)

```ts
import {createRequester} from 'get-it'

const request = createRequester({
  base: 'https://api.example.com',
  headers: {Authorization: 'Bearer ...'},
  // JSON serialization, HTTP errors, and promise-based: all built in
})
```

The core has the base URL, the default headers, the JSON request serialization, the HTTP error throwing, and the promise return. You no longer need middleware for these functions.

## Making requests

### Before (v8)

```ts
const response = await request({url: '/users', method: 'POST', body: {name: 'Espen'}})
const data = response.body // pre-parsed if jsonResponse() was used
```

### After (v9)

```ts
// Option A: use `as: 'json'` for typed responses
const response = await request<User[]>({url: '/users', as: 'json'})
const data = response.body // typed as User[]

// Option B: use convenience methods
const response = await request('/users')
const data = response.json() // returns unknown
const text = response.text() // returns string

// Simple string URL still works
const response = await request('/users')
```

## Response shape changes

The response object is different:

```ts
// v8
response.statusCode // number
response.statusMessage // string
response.headers // Record<string, string>
response.body // pre-parsed body (depends on middleware)

// v9
response.status // number
response.statusText // string
response.headers // Headers instance (use .get(), .has(), .forEach())
response.url // final response URL after redirects
response.redirected // whether the response resulted from following a redirect
response.body // Uint8Array (default), or typed based on `as` option
response.json() // parse body as JSON (synchronous, returns unknown)
response.text() // decode body as UTF-8 string (synchronous)
response.bytes() // returns body as Uint8Array (synchronous)
```

All v9 response modes expose `url` and `redirected`. `url` is the final URL
reported by fetch after redirect handling. On an `HttpError`, `error.url` is
the attempted request URL and `error.response.url` is the final response URL.

### Reading response headers

```ts
// v8
const contentType = response.headers['content-type']

// v9
const contentType = response.headers.get('content-type')
```

## Body type selection with `as`

v9 adds the `as` option. It controls how get-it processes the response body:

| `as` value  | `body` type                                     | Buffered? |
| ----------- | ----------------------------------------------- | --------- |
| _(omitted)_ | `Uint8Array` + `.json()`, `.text()`, `.bytes()` | yes       |
| `'json'`    | `unknown` (or generic `T`)                      | yes       |
| `'text'`    | `string`                                        | yes       |
| `'stream'`  | `ReadableStream<Uint8Array>`                    | no        |

```ts
// Replaces jsonResponse() middleware
const res = await request({url: '/users', as: 'json'})

// Replaces stream: true
const res = await request({url: '/large-file', as: 'stream'})

// Replaces rawBody: true (this is now the default)
const res = await request('/data')
res.body // Uint8Array
```

## Cancellation

### Before (v8)

```ts
import {promise} from 'get-it/middleware'

const source = promise.CancelToken.source()
const res = request({url: '/users', cancelToken: source.token})
source.cancel('Operation cancelled')
```

### After (v9)

```ts
const controller = new AbortController()
const res = request({url: '/users', signal: controller.signal})
controller.abort()
```

v9 uses the standard `AbortController`. There are no custom cancellation primitives.

## HTTP errors

### Before (v8)

```ts
import {httpErrors} from 'get-it/middleware'

const request = getIt([httpErrors(), promise()])
// Throws on 4xx/5xx
```

### After (v9)

HTTP error throwing is built in, and it is on by default. You can disable it for an instance or for one request:

```ts
// Disable for all requests
const request = createRequester({httpErrors: false})

// Disable for a single request
const res = await request({url: '/maybe-404', httpErrors: false})
```

The `HttpError` class and a cross-package structural guard are exported from
`get-it`:

```ts
import {isHttpError} from 'get-it'

try {
  await request('/not-found')
} catch (err) {
  if (isHttpError(err)) {
    console.log(err.status) // 404
    console.log(err.response) // full response object
  }
}
```

Use `isHttpError()` instead of `instanceof HttpError` when an application can
contain more than one installed get-it version. It recognizes the stable error
shape shared by all v9 releases and narrows to `HttpErrorLike`; response URL
metadata is optional because early v9 releases did not include it.
`isTimeoutError()` provides the same structural check for get-it's
headers-phase `TimeoutError` class. It does not match the platform
`DOMException` used for total-deadline timeouts.

## Timeout

### Before (v8)

```ts
const request = getIt([promise()])
await request({url: '/slow', timeout: {connect: 5000, socket: 30000}})
```

### After (v9)

The timeout uses `AbortSignal.timeout()`. Give one value in milliseconds:

```ts
const request = createRequester({timeout: 30000})

// Per-request override
await request({url: '/slow', timeout: 5000})

// Disable timeout
await request({url: '/slow', timeout: false})
```

From v9.2, `timeout` also accepts a structured object for more control:

```ts
// v8: timeout: {connect: 5000, socket: 30000}
// v9 equivalent for the connect half:
await request({url: '/slow', timeout: {headers: 5000}})
```

| v8                   | v9                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeout: {connect}` | `timeout: {headers}`. Per-attempt time to response headers, throws a retryable `TimeoutError`                                                                              |
| `timeout: {socket}`  | No direct equivalent. There is no detection of an idle or stalled connection. Use `total` instead, or monitor the stream. With `retry()`, `total` applies to each attempt. |

For a streaming download that must not have a total deadline, but must fail quickly on an unresponsive server:

```ts
import {retry} from 'get-it/middleware'

const request = createRequester({
  middleware: [retry()],
  timeout: {headers: 15_000, total: false},
})
```

get-it combines the timeout signal and your `signal` automatically with `AbortSignal.any()`.

**React Native**: v8 detected React Native (`navigator.product === 'ReactNative'`) and used a default timeout of 60 seconds. v9 uses 120 seconds in all runtimes. To get the shorter timeout again:

```ts
const request = createRequester({timeout: 60000})
```

## Middleware

v9 has two middleware types. They replace the hook-based system of v8:

### Transform middleware (object with hooks)

A flat pipeline. It does not wrap the fetch call, and it is not visible in stack traces:

```ts
import type {TransformMiddleware} from 'get-it'

const myTransform: TransformMiddleware = {
  beforeRequest(options) {
    // Modify request options before fetch
    return {...options, headers: new Headers(options.headers)}
  },
  afterResponse(response) {
    // Modify response after fetch
    return response
  },
}
```

### Wrapping middleware (function)

It wraps the fetch call and is visible in stack traces. Use it for retries and error recovery:

```ts
import type {WrappingMiddleware} from 'get-it'

const myWrapper: WrappingMiddleware = async (options, next) => {
  console.log('before fetch')
  const response = await next(options)
  console.log('after fetch')
  return response
}
```

get-it identifies the two types by shape: an object is a transform middleware, and a function is a wrapping middleware.

### Passing middleware

```ts
import {createRequester} from 'get-it'
import {retry, debug} from 'get-it/middleware'

const request = createRequester({
  middleware: [retry({maxRetries: 3}), debug({log: console.log, verbose: true})],
})
```

v9 removes the `requester.use(middleware)` chain of v8. Pass all middleware when you create the requester.

### Custom per-request properties (`meta`)

v8 permitted custom properties directly on the request options object. Middleware read them with `processOptions`:

```ts
// v8: custom properties on RequestOptions
const request = getIt([
  {
    processOptions: (opts) => {
      const lineage = opts.lineage // custom property, no type error
      if (lineage) opts.headers['x-lineage'] = lineage
      return opts
    },
  },
  promise(),
])

await request({url: '/api', lineage: 'abc'})
```

The `RequestOptions` of v9 is a closed type, and TypeScript rejects unknown properties. Use the `meta` field instead. Its type is `Record<string, unknown>`:

```ts
// v9: use meta for custom per-request data
const request = createRequester({
  middleware: [
    {
      beforeRequest: (opts) => ({
        ...opts,
        headers: {
          ...opts.headers,
          ...(typeof opts.meta?.['lineage'] === 'string'
            ? {'x-lineage': opts.meta['lineage']}
            : {}),
        },
      }),
    },
  ],
})

await request({url: '/api', meta: {lineage: 'abc'}})
```

get-it sends the `meta` field to all middleware, both transform and wrapping. It does not send `meta` over the wire.

## Middleware migration

### Removed middleware (no replacement needed)

| Middleware         | Reason                                                                   |
| ------------------ | ------------------------------------------------------------------------ |
| `promise()`        | All requests return promises by default                                  |
| `jsonRequest()`    | Built in. Plain objects and arrays are auto-serialized as JSON           |
| `jsonResponse()`   | Use `as: 'json'` or `res.json()`                                         |
| `httpErrors()`     | Built in, on by default                                                  |
| `base(url)`        | Use `createRequester({ base: url })`                                     |
| `headers(obj)`     | Use `createRequester({ headers: obj })`                                  |
| `observable()`     | Wrap with RxJS `defer(() => promise)` (cold) or `from(promise)` (eager)  |
| `progress()`       | Removed. There is no replacement in the fetch-based architecture         |
| `keepAlive()`      | Built into fetch connection pooling                                      |
| `injectResponse()` | Removed. Use injectable `fetch`, or `get-it/mock`, for testing           |
| `urlEncoded()`     | Pass `new URLSearchParams(...)` as body, and fetch sets the content-type |

### Still available

| v8        | v9        | Import              |
| --------- | --------- | ------------------- |
| `retry()` | `retry()` | `get-it/middleware` |
| `debug()` | `debug()` | `get-it/middleware` |

### Debug middleware changes

The `debug()` middleware of v8 used the [`debug`](https://www.npmjs.com/package/debug) npm package. The `DEBUG=get-it:*` environment variable enabled it. It needed no configuration and no code changes.

The `debug()` of v9 needs an explicit `log` function. Without this function, it does nothing:

```ts
import {debug} from 'get-it/middleware'

// v8: add the middleware, control via DEBUG env var
const request = getIt([debug()])
// $ DEBUG=get-it:* node app.js

// v9: must pass a log function explicitly
const request = createRequester({
  middleware: [debug({log: console.log, verbose: true})],
})
```

To get the `DEBUG` environment variable behavior again, install the `debug` package. Then pass it as the log function:

```ts
import createDebug from 'debug'
import {debug} from 'get-it/middleware'

const request = createRequester({
  middleware: [debug({log: createDebug('get-it'), verbose: true})],
})
// $ DEBUG=get-it node app.js
```

v8 supported `requestId` as a top-level request option. In v9, pass it in `meta`:

```ts
// v8
request({url: '/users', requestId: 'abc-123'})

// v9
request({url: '/users', meta: {requestId: 'abc-123'}})
```

There is one other difference. v9 truncates a logged body at 16 KB, and it summarizes binary and stream bodies. Large payloads no longer flood the logs.

### Proxy / agent configuration

v8 had `agent()` and `proxy()` middleware. They configured the `http.Agent` of Node.

v9 uses conditional exports. In Node and Bun, `createRequester` automatically uses `createNodeFetch()`. This function reads the proxy configuration from the environment variables `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`.

In Deno, `createRequester` uses the built-in `fetch`. This fetch also reads `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`.

To set your own proxy or connection pool configuration:

```ts
import {createRequester} from 'get-it'
import {createNodeFetch} from 'get-it/node'

const request = createRequester({
  fetch: createNodeFetch({
    proxy: 'http://proxy:8080', // explicit proxy URL
    connections: 30, // max connections per origin
    allowH2: true, // enable HTTP/2
  }),
})
```

In Deno, you can set the proxy, the CA certificates, or HTTP/2 for each client. Inject a fetch that passes a Deno `HttpClient`:

```ts
const client = Deno.createHttpClient({
  proxy: {url: 'http://proxy:8080'},
  http2: true,
})

const request = createRequester({
  fetch: (url, init) => fetch(url, {...init, client}),
})
```

## Injectable fetch

In v9, you can supply your own `fetch` implementation for an instance or for one request:

```ts
// Instance level: used for all requests
const request = createRequester({fetch: myCustomFetch})

// Per-request override
await request({url: '/test', fetch: mockFetch})
```

This option replaces the `injectResponse()` of v8 for tests, and the `agent()` of v8 for custom transports.

## Headers

v9 accepts `FetchHeaders` as input. Internally, it uses `Headers` instances:

```ts
// All of these work as header input:
createRequester({headers: {'X-Custom': 'value'}}) // Record
createRequester({headers: new Headers({'X-Custom': 'value'})}) // Headers
createRequester({headers: [['X-Custom', 'value']]}) // Tuples
```

Headers on a request merge with the headers on the instance. On a conflict, the header on the request has priority:

```ts
const request = createRequester({headers: {'X-A': '1'}})
await request({url: '/test', headers: {'X-B': '2'}})
// Sends both X-A and X-B
```

### Headers in middleware

Before `beforeRequest` receives the options, get-it merges the headers into a plain `Record<string, string>` with lowercase keys. Thus you can spread the object:

```ts
beforeRequest(opts) {
  return {...opts, headers: {...opts.headers, 'x-custom': 'value'}}
}
```

Use **lowercase header names** in middleware. get-it normalizes all keys to lowercase. If you use a different case (`'Content-Type'` when `'content-type'` is present), you create a duplicate entry and you do not override the first entry.

## Entry points

| Import              | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `get-it`            | Core. It includes environment proxy support in Node, Bun, and Deno. |
| `get-it/middleware` | `retry`, `debug`, `isRetryableRequest`, `getRetryDelay`             |
| `get-it/node`       | `createNodeFetch()` for your own undici dispatcher configuration    |
| `get-it/mock`       | `createMockFetch()` and matchers. It replaces `injectResponse()`    |
| `get-it/vitest`     | Custom vitest matchers for mock assertions                          |

## TypeScript

v9 is written in TypeScript with erasable type syntax. It exports all of the types:

```ts
import type {
  RequestOptions,
  BufferedResponse,
  HttpErrorLike,
  JsonResponse,
  TextResponse,
  StreamResponse,
  TransformMiddleware,
  WrappingMiddleware,
  FetchFunction,
  FetchHeaders,
  FetchBody,
  FetchInit,
  RequesterOptions,
  RequestFunction,
} from 'get-it'
```

### Generic JSON responses

```ts
interface User {
  name: string
  email: string
}

const res = await request<User[]>({url: '/users', as: 'json'})
res.body // User[] (type-only, no runtime validation)
```

## Complete migration example

### Before (v8)

```ts
import getIt from 'get-it'
import {
  promise,
  base,
  headers,
  jsonRequest,
  jsonResponse,
  httpErrors,
  retry,
  observable,
} from 'get-it/middleware'

const request = getIt([
  base('https://api.example.com'),
  headers({Authorization: 'Bearer token'}),
  jsonRequest(),
  jsonResponse(),
  httpErrors(),
  retry({maxRetries: 3}),
  promise(),
])

// Promise-based request
const response = await request({url: '/users', method: 'GET'})
const users = response.body

// Observable-based request
const requesterWithObs = getIt([base('https://api.example.com'), observable()])
const obs$ = requesterWithObs({url: '/users'})

// Cancellation
const source = promise.CancelToken.source()
const res = request({url: '/users', cancelToken: source.token})
source.cancel()
```

### After (v9)

```ts
import {createRequester, HttpError} from 'get-it'
import {retry} from 'get-it/middleware'

const request = createRequester({
  base: 'https://api.example.com',
  headers: {Authorization: 'Bearer token'},
  middleware: [retry({maxRetries: 3})],
})

// Promise-based request (the only kind now)
const response = await request<User[]>({url: '/users', as: 'json'})
const users = response.body

// Observable: wrap the promise yourself
// Use `defer` so the request fires on subscribe (cold), matching v8's
// `observable()`. Plain `from(request('/users'))` would fire eagerly.
import {defer} from 'rxjs'
const obs$ = defer(() => request('/users'))

// Cancellation
const controller = new AbortController()
const res = request({url: '/users', signal: controller.signal})
controller.abort()
```
