# get-it

[![npm stat](https://img.shields.io/npm/dm/get-it.svg?style=flat-square)](https://npm-stat.com/charts.html?package=get-it)
[![npm version](https://img.shields.io/npm/v/get-it.svg?style=flat-square)](https://www.npmjs.com/package/get-it)
[![gzip size][gzip-badge]][bundlephobia]
[![size][size-badge]][bundlephobia]

Generic HTTP request library for node.js (>= 22.12), browsers, and edge runtimes. Built on `fetch()`.

## Features

- Promise-based API with full TypeScript support
- Automatic JSON serialization/deserialization
- Base URL and default headers
- HTTP error throwing (on by default)
- Timeout via `AbortSignal.timeout()`
- Cancellation via standard `AbortController`
- Proxy support in Node.js, Bun, and Deno (reads `HTTP_PROXY`/`HTTPS_PROXY` from environment)
- Middleware system for retry, debug logging, and custom logic
- Injectable `fetch` for testing and custom transports
- Built-in mock fetch with request matching, recording, and vitest matchers
- Works in Node.js, browsers, Deno, Bun, and edge runtimes

## Installation

```bash
npm install get-it
```

## Usage

```ts
import {createRequester} from 'get-it'

const request = createRequester({
  base: 'https://api.example.com',
  headers: {Authorization: 'Bearer ...'},
})

// Simple GET
const res = await request('/users')
console.log(res.json())

// POST with JSON body (auto-serialized)
const res = await request({
  url: '/users',
  method: 'POST',
  body: {name: 'Espen'},
  as: 'json',
})
console.log(res.body) // parsed JSON
```

## Response

The response object depends on the `as` option:

| `as` value  | `body` type                                     | Buffered? |
| ----------- | ----------------------------------------------- | --------- |
| _(omitted)_ | `Uint8Array` + `.json()`, `.text()`, `.bytes()` | yes       |
| `'json'`    | `unknown` (or generic `T`)                      | yes       |
| `'text'`    | `string`                                        | yes       |
| `'stream'`  | `ReadableStream<Uint8Array>`                    | no        |

```ts
// Default — buffered with convenience methods
const res = await request('/data')
res.status // number
res.statusText // string
res.headers // Headers
res.body // Uint8Array
res.json() // parse as JSON (synchronous)
res.text() // decode as string (synchronous)

// Typed JSON
const res = await request<User[]>({url: '/users', as: 'json'})
res.body // User[]

// Streaming
const res = await request({url: '/large-file', as: 'stream'})
res.body // ReadableStream<Uint8Array>
```

## Options

### Instance options (`createRequester`)

| Option       | Type                                | Default            | Description                                                      |
| ------------ | ----------------------------------- | ------------------ | ---------------------------------------------------------------- |
| `base`       | `string`                            | —                  | Base URL prepended to relative paths                             |
| `headers`    | `FetchHeaders`                      | —                  | Default headers for all requests                                 |
| `httpErrors` | `boolean`                           | `true`             | Throw `HttpError` on status >= 400                               |
| `timeout`    | `number \| false \| TimeoutOptions` | —                  | Timeout in ms, or `{total, headers}` — see [Timeouts](#timeouts) |
| `fetch`      | `FetchFunction`                     | `globalThis.fetch` | Custom fetch implementation                                      |
| `middleware` | `Array`                             | `[]`               | Transform and wrapping middleware                                |

### Per-request options

| Option        | Type                                                       | Description                                                     |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| `url`         | `string`                                                   | Request URL (required)                                          |
| `method`      | `string`                                                   | HTTP method                                                     |
| `body`        | `unknown`                                                  | Request body (objects auto-serialized as JSON)                  |
| `headers`     | `FetchHeaders`                                             | Merged with instance headers                                    |
| `query`       | `Record<string, string \| number \| boolean \| undefined>` | URL query parameters                                            |
| `as`          | `'json' \| 'text' \| 'stream'`                             | Response body type                                              |
| `signal`      | `AbortSignal`                                              | Cancellation signal                                             |
| `httpErrors`  | `boolean`                                                  | Override instance setting                                       |
| `timeout`     | `number \| false \| TimeoutOptions`                        | Override instance timeout (replaces it wholesale)               |
| `fetch`       | `FetchFunction`                                            | Override instance fetch                                         |
| `redirect`    | `'error' \| 'follow' \| 'manual'`                          | Redirect strategy (`'manual'` is opaque in browsers - see note) |
| `credentials` | `'include' \| 'omit' \| 'same-origin'`                     | Credentials mode (browser-only)                                 |

> **Note on `redirect: 'manual'`:** In browsers this yields an opaque-redirect response (status `0`, empty headers) per the Fetch spec, so the 3xx status and headers (e.g. `location`) are unreadable. Reading them neither throws nor warns - `headers.get()` returns `null` and iteration is empty - so detect the case via `status === 0`. Non-browser runtimes (Node.js, Bun, Deno, edge runtimes, workers) return the real 3xx response, so its status and headers are readable.

## Timeouts

`timeout` accepts a total deadline in milliseconds, `false` to disable, or a structured object:

```ts
const request = createRequester({
  timeout: {
    total: 120_000, // total deadline, request start through body (default 120 000)
    headers: 15_000, // max time to receive response headers, per attempt (disabled by default)
  },
})
```

- `total` — the existing deadline. Covers everything, including the body stream in `as: 'stream'` mode. Rejects with a `TimeoutError` DOMException, which the `retry()` middleware never retries. When combined with the retry() middleware, the deadline applies per attempt - each retry gets a fresh total timer.
- `headers` — time to receive response headers for one fetch attempt. Does not cover body download. Rejects with get-it's `TimeoutError` (`code: 'ETIMEDOUT'`, `phase: 'headers'`), which the default `retry()` middleware retries on GET/HEAD. Because the timer lives inside the middleware chain, each retry attempt gets a fresh timer — no middleware ordering requirements.

For long-running streaming downloads, disable the total deadline and keep a headers timeout:

```ts
import {createRequester} from 'get-it'
import {retry} from 'get-it/middleware'

const request = createRequester({
  middleware: [retry()],
  timeout: {headers: 15_000, total: false},
})
const res = await request({url: 'https://example.com/big-file', as: 'stream'})
```

## Error handling

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

// Disable for a single request
const res = await request({url: '/maybe-404', httpErrors: false})
```

## Cancellation

```ts
const controller = new AbortController()
const promise = request({url: '/slow', signal: controller.signal})
controller.abort()
```

Timeout and user-provided signals are combined automatically with `AbortSignal.any()`.

## Middleware

Two types of middleware, passed in the `middleware` array:

**Transform middleware** (object) — flat pipeline, invisible in stack traces:

```ts
const addHeader: TransformMiddleware = {
  beforeRequest(options) {
    return {
      ...options,
      headers: {...options.headers, 'x-custom': 'value'},
    }
  },
}
```

**Wrapping middleware** (function) — wraps the fetch call, appears in stack traces:

```ts
const logger: WrappingMiddleware = async (options, next) => {
  console.log('fetching', options.url)
  const response = await next(options)
  console.log('done', response.status)
  return response
}
```

### Built-in middleware

```ts
import {retry, debug} from 'get-it/middleware'

const request = createRequester({
  middleware: [retry({maxRetries: 3}), debug({log: console.log, verbose: true})],
})
```

## Runtime proxy support

In Node.js and Bun, `createRequester` automatically uses an undici-based fetch that reads proxy configuration from environment variables.

In Deno, `createRequester` uses Deno's built-in `fetch`, which also reads `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`.

For custom proxy or connection pool settings:

```ts
import {createRequester} from 'get-it'
import {createNodeFetch} from 'get-it/node'

const request = createRequester({
  fetch: createNodeFetch({
    proxy: 'http://proxy:8080',
    connections: 30,
    allowH2: true,
  }),
})
```

For explicit per-client proxy settings, custom CA certificates, or HTTP/2 settings in Deno, create a Deno `HttpClient` and inject a custom fetch:

```ts
const client = Deno.createHttpClient({
  proxy: {url: 'http://proxy:8080'},
  http2: true,
})

const request = createRequester({
  fetch: (url, init) => fetch(url, {...init, client}),
})
```

## Testing

`get-it/mock` provides a mock fetch for testing code that uses get-it. No network, no global patching — just inject `mock.fetch` where you'd normally pass `fetch`.

```ts
import {createRequester} from 'get-it'
import {createMockFetch, objectContaining} from 'get-it/mock'

const mock = createMockFetch()
const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})

// Register handlers — responses are one-shot by default
mock.on('GET', '/api/docs', {query: {limit: '10'}}).respond({status: 200, body: {results: []}})

mock
  .on('POST', '/api/docs', {body: objectContaining({_type: 'post'})})
  .respond({status: 201, body: {id: 'abc'}})

const res = await request({url: '/api/docs', query: {limit: 10}, as: 'json'})
// res.body → {results: []}
```

Requests are matched on method, URL (exact, glob, or predicate), query, body, and headers, with loose matching via `objectContaining()` and friends. Every request is recorded for inspection, unmatched requests throw a `MockFetchError` with a diff against the closest mock, and `get-it/vitest` adds custom matchers to vitest's `expect`:

```ts
// In your test setup file (wired via vitest's setupFiles)
import 'get-it/vitest'
```

```ts
expect(mock).toHaveReceivedRequest('POST', '/api/docs', {
  body: objectContaining({_type: 'post'}),
})
expect(mock).toHaveConsumedAllMocks()
```

See [docs/mock.md](docs/mock.md) for the full documentation: response sequences and persistent mocks, network errors, delayed and streaming response bodies (`streamBody()`), scoped mocks for multi-host code, request recording, value matchers, and the complete vitest matcher reference.

## Entry points

| Import              | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `get-it`            | Core (auto-selects Node variant via conditional exports) |
| `get-it/middleware` | `retry`, `debug`, `isRetryableRequest`, `getRetryDelay`  |
| `get-it/node`       | `createNodeFetch()` for custom undici dispatcher config  |
| `get-it/mock`       | `createMockFetch()` and matchers for testing             |
| `get-it/vitest`     | Custom vitest matchers for mock assertions               |

## Migrating from v8

See [docs/MIGRATION-v9.md](docs/MIGRATION-v9.md) for a comprehensive migration guide. It doubles as a playbook for AI agents: point yours at the guide and ask it to migrate the codebase.

## License

MIT-licensed. See LICENSE.

## Release new version

Run the ["CI & Release" workflow](https://github.com/sanity-io/get-it/actions).
Make sure to select the main branch and check "Release new version".

Semantic release will only release on configured branches, so it is safe to run release on any branch.

[gzip-badge]: https://img.shields.io/bundlephobia/minzip/get-it?label=gzip%20size&style=flat-square
[size-badge]: https://img.shields.io/bundlephobia/min/get-it?label=size&style=flat-square
[bundlephobia]: https://bundlephobia.com/package/get-it
