# Migrating from get-it v8 to v9

get-it v9 is a ground-up rewrite. It replaces the pub/sub channel system and Node `http`/`https` transport with standard `fetch()`, drops CommonJS, and simplifies the API surface.

This guide covers every breaking change and shows how to update your code.

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
| `observable()` middleware       | wrap with `from(promise)` in consumer              |
| `progress()` middleware         | removed, no replacement                            |
| `keepAlive()` middleware        | built into fetch                                   |
| `agent(opts)` middleware        | `createNodeFetch(opts)` or injectable `fetch`      |
| `proxy(opts)` middleware        | automatic via conditional exports                  |
| `mtls(opts)` middleware         | `createNodeFetch({ tls: { cert, key, ca } })`      |
| `bodySize: N`                   | `headers: {'content-length': N}`                   |
| `compress: false`               | removed (fetch always negotiates compression)      |
| `onlyBody: true`                | removed (use `res.body` / `res.json()` directly)   |
| `withCredentials: true`         | `credentials: 'include'`                           |
| `require('get-it')`             | `import { createRequester } from 'get-it'`         |
| `require('get-it/middleware')`  | `import { retry, debug } from 'get-it/middleware'` |

## Installation

```bash
npm install get-it@^9
```

v9 is ESM-only. If your project uses CommonJS, you'll need to either:

- Switch to ESM (`"type": "module"` in package.json)
- Use dynamic `import()` from CommonJS

## Behavioral changes

### `remoteAddress` removed from responses

v8.7.0 added `response.remoteAddress` containing the server's IP address, obtained from Node's `http` socket. v9 uses `fetch()` which does not expose socket-level information. There is no equivalent and no workaround — this field is no longer available.

### No redirect limit control

v8 used `follow-redirects` which supported a `maxRedirects` option (defaulting to 5). v9 uses `fetch()` which follows redirects automatically with no way to limit the count. The `redirect` option on fetch only supports `'follow'` (default), `'error'` (reject on any redirect), or `'manual'` (don't follow, return the 3xx response).

If you need to block redirects entirely, pass `redirect: 'error'` or `redirect: 'manual'` in the fetch init. There is no way to allow _some_ redirects but cap the count — fetch does not expose this.

### Retry middleware: changed set of retryable errors

v8's retry middleware treated `ENOTFOUND` and `ENETUNREACH` as non-retryable. v9 retries `ENOTFOUND` (DNS resolution failure) because transient DNS failures on valid hostnames can surface as `ENOTFOUND` rather than `EAI_AGAIN`. `ENETUNREACH` (no route to host) remains non-retryable since it indicates a routing or network interface problem that won't resolve on retry.

The full set of retryable error codes in v9:

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

To restore v8 behavior, provide a custom `shouldRetry`:

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

### No per-request retry overrides

v8 allowed retry settings on individual requests:

```ts
// v8
await request({url: '/critical', maxRetries: 10, shouldRetry: customPredicate})
```

v9's retry configuration is set once when creating the middleware. To use different retry behavior for different requests, create separate request instances:

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

Alternatively, use `meta` to pass hints and a custom `shouldRetry` that reads them:

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

### Query parameters no longer accept arrays

v8 expanded arrays into repeated keys: `{tags: ['a', 'b']}` → `tags=a&tags=b`. v9's `query` option only accepts scalar values (`string | number | boolean | undefined`). Passing an array will silently produce a single comma-joined value via `String()`:

```ts
// v8
await request({url: '/api', query: {tags: ['a', 'b']}})
// → /api?tags=a&tags=b

// v9 — WRONG, produces /api?tags=a%2Cb
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

v8 used the XHR-style boolean `withCredentials: true` to send cookies cross-origin. v9 uses the fetch-style `credentials` option:

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

Note: `credentials` is only relevant in browser environments. Some runtimes (e.g. Cloudflare Workers) will throw if `credentials` is set on a fetch init — get-it only forwards it when `window` is present in the global scope.

### `clone()` removed

v8 had `request.clone()` to create derived requesters that inherited the parent's middleware stack. v9 has no `clone()` — since `createRequester` takes a plain options object, you get the same result by spreading shared config:

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

v8's `promise({ onlyBody: true })` resolved with just the response body instead of the full response object. v9 always resolves with the full response — access the body directly:

```ts
// v8
const body = await request({url: '/users'}) // with onlyBody: true

// v9
const res = await request({url: '/users', as: 'json'})
const body = res.body
```

### `compress` removed

v8 supported a `compress` option (defaulting to `true`) that sent `accept-encoding: gzip, deflate` headers. In v9, fetch handles content negotiation automatically — there is no option to disable it.

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
  // JSON serialization, HTTP errors, and promise-based — all built in
})
```

Base URL, default headers, JSON request serialization, HTTP error throwing, and promise return are all built into the core. You no longer need middleware for these.

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

The response object has changed:

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
response.body // Uint8Array (default), or typed based on `as` option
response.json() // parse body as JSON (synchronous, returns unknown)
response.text() // decode body as UTF-8 string (synchronous)
response.bytes() // returns body as Uint8Array (synchronous)
```

### Reading response headers

```ts
// v8
const contentType = response.headers['content-type']

// v9
const contentType = response.headers.get('content-type')
```

## Body type selection with `as`

v9 introduces the `as` option to control how the response body is processed:

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

Standard `AbortController` — no custom cancellation primitives.

## HTTP errors

### Before (v8)

```ts
import {httpErrors} from 'get-it/middleware'

const request = getIt([httpErrors(), promise()])
// Throws on 4xx/5xx
```

### After (v9)

HTTP error throwing is built in and on by default. Opt out per-instance or per-request:

```ts
// Disable for all requests
const request = createRequester({httpErrors: false})

// Disable for a single request
const res = await request({url: '/maybe-404', httpErrors: false})
```

The `HttpError` class is exported from `get-it`:

```ts
import {HttpError} from 'get-it'

try {
  await request('/not-found')
} catch (err) {
  if (err instanceof HttpError) {
    console.log(err.status) // 404
    console.log(err.response) // full response object
  }
}
```

## Timeout

### Before (v8)

```ts
const request = getIt([promise()])
await request({url: '/slow', timeout: {connect: 5000, socket: 30000}})
```

### After (v9)

Timeout uses `AbortSignal.timeout()`. A single value in milliseconds:

```ts
const request = createRequester({timeout: 30000})

// Per-request override
await request({url: '/slow', timeout: 5000})

// Disable timeout
await request({url: '/slow', timeout: false})
```

The timeout signal is automatically combined with any user-provided `signal` using `AbortSignal.any()`.

**React Native**: v8 detected React Native (`navigator.product === 'ReactNative'`) and used a 60s default timeout. v9 uses 120s everywhere. To restore the shorter timeout:

```ts
const request = createRequester({timeout: 60000})
```

## Middleware

v9 has two middleware types instead of the v8 hook-based system:

### Transform middleware (object with hooks)

Flat pipeline — does not wrap the fetch call, invisible in stack traces:

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

Wraps the fetch call — appears in stack traces. Used for retry, error recovery:

```ts
import type {WrappingMiddleware} from 'get-it'

const myWrapper: WrappingMiddleware = async (options, next) => {
  console.log('before fetch')
  const response = await next(options)
  console.log('after fetch')
  return response
}
```

get-it distinguishes the two by shape: object = transform, function = wrapping.

### Passing middleware

```ts
import {createRequester} from 'get-it'
import {retry, debug} from 'get-it/middleware'

const request = createRequester({
  middleware: [retry({maxRetries: 3}), debug({log: console.log, verbose: true})],
})
```

Note: v8's `requester.use(middleware)` chaining is removed. Pass all middleware at creation time.

### Custom per-request properties (`meta`)

v8 allowed custom properties directly on the request options object. Middleware could access them via `processOptions`:

```ts
// v8 — custom properties on RequestOptions
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

v9's `RequestOptions` is a closed type — unknown properties are rejected by TypeScript. Use the `meta` field instead, which is typed as `Record<string, unknown>`:

```ts
// v9 — use meta for custom per-request data
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

The `meta` field is passed through to all middleware (both transform and wrapping) but is not sent over the wire.

## Middleware migration

### Removed middleware (no replacement needed)

| Middleware         | Reason                                                                          |
| ------------------ | ------------------------------------------------------------------------------- |
| `promise()`        | All requests return promises by default                                         |
| `jsonRequest()`    | Built in — plain objects and arrays are auto-serialized as JSON                 |
| `jsonResponse()`   | Use `as: 'json'` or `res.json()`                                                |
| `httpErrors()`     | Built in, on by default                                                         |
| `base(url)`        | Use `createRequester({ base: url })`                                            |
| `headers(obj)`     | Use `createRequester({ headers: obj })`                                         |
| `observable()`     | Wrap with RxJS `from(promise)` or similar                                       |
| `progress()`       | Removed — no replacement in fetch-based architecture                            |
| `keepAlive()`      | Built into fetch connection pooling                                             |
| `injectResponse()` | Removed — use injectable `fetch` for testing                                    |
| `urlEncoded()`     | Pass `new URLSearchParams(...)` as body — fetch sets content-type automatically |

### Still available

| v8        | v9        | Import              |
| --------- | --------- | ------------------- |
| `retry()` | `retry()` | `get-it/middleware` |
| `debug()` | `debug()` | `get-it/middleware` |

### Debug middleware changes

v8's `debug()` middleware used the [`debug`](https://www.npmjs.com/package/debug) npm package, enabled with the `DEBUG=get-it:*` environment variable — zero config, no code changes needed.

v9's `debug()` requires an explicit `log` function. Without one, it's a no-op:

```ts
import {debug} from 'get-it/middleware'

// v8 — just add the middleware, control via DEBUG env var
const request = getIt([debug()])
// $ DEBUG=get-it:* node app.js

// v9 — must pass a log function explicitly
const request = createRequester({
  middleware: [debug({log: console.log, verbose: true})],
})
```

To restore `DEBUG` env var behavior, install the `debug` package and pass it as the log function:

```ts
import createDebug from 'debug'
import {debug} from 'get-it/middleware'

const request = createRequester({
  middleware: [debug({log: createDebug('get-it'), verbose: true})],
})
// $ DEBUG=get-it node app.js
```

v8 supported `requestId` as a top-level request option. In v9, pass it via `meta`:

```ts
// v8
request({url: '/users', requestId: 'abc-123'})

// v9
request({url: '/users', meta: {requestId: 'abc-123'}})
```

**What's different from v8:**

- **Activation**: v8 used the `DEBUG=get-it:*` env var automatically. v9 requires an explicit `log` function (see above for restoring env var behavior).
- **Body truncation**: v9 truncates logged bodies at 16 KB and summarizes binary/stream bodies, preventing large payloads from flooding logs.

### Proxy / agent configuration

v8 had `agent()` and `proxy()` middleware that configured Node's `http.Agent`.

v9 uses conditional exports: when running in Node/Bun/Deno, `createRequester` automatically uses `createNodeFetch()` which reads proxy configuration from environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`).

For custom proxy or connection pool settings:

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

## Injectable fetch

v9 lets you provide a custom `fetch` implementation at instance or request level:

```ts
// Instance level — used for all requests
const request = createRequester({fetch: myCustomFetch})

// Per-request override
await request({url: '/test', fetch: mockFetch})
```

This replaces v8's `injectResponse()` for testing and `agent()` for custom transports.

## Headers

v9 uses `FetchHeaders` for input and `Headers` instances internally:

```ts
// All of these work as header input:
createRequester({headers: {'X-Custom': 'value'}}) // Record
createRequester({headers: new Headers({'X-Custom': 'value'})}) // Headers
createRequester({headers: [['X-Custom', 'value']]}) // Tuples
```

Per-request headers merge with instance headers (per-request wins on conflict):

```ts
const request = createRequester({headers: {'X-A': '1'}})
await request({url: '/test', headers: {'X-B': '2'}})
// Sends both X-A and X-B
```

### Headers in middleware

By the time `beforeRequest` receives the options, headers have been merged into a plain `Record<string, string>` with lowercase keys. This means spreading works naturally:

```ts
beforeRequest(opts) {
  return {...opts, headers: {...opts.headers, 'x-custom': 'value'}}
}
```

Use **lowercase header names** in middleware — since all keys are normalized to lowercase, using a different casing (e.g. `'Content-Type'` when `'content-type'` already exists) would create a duplicate entry rather than overriding it.

## Entry points

| Import              | Purpose                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| `get-it`            | Core. In Node/Bun/Deno, automatically includes proxy support via conditional exports. |
| `get-it/middleware` | `retry`, `debug`                                                                      |
| `get-it/node`       | `createNodeFetch()` for custom undici dispatcher configuration                        |

## TypeScript

v9 is written in TypeScript with erasable type syntax. All types are exported:

```ts
import type {
  RequestOptions,
  BufferedResponse,
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

// Observable — wrap the promise yourself
import {from} from 'rxjs'
const obs$ = from(request('/users'))

// Cancellation
const controller = new AbortController()
const res = request({url: '/users', signal: controller.signal})
controller.abort()
```
