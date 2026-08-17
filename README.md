# get-it

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/downloads-month/get-it)](https://npmx.dev/package/get-it)
[![Latest version](https://npmx.dev/api/registry/badge/version/get-it)](https://npmx.dev/package/get-it)
[![Pre-gzip size](https://npmx.dev/api/registry/badge/size/get-it)](https://npmx.dev/package/get-it)
[![Number of dependencies](https://npmx.dev/api/registry/badge/dependencies/get-it)](https://npmx.dev/package/get-it)
[![Node versions supported](https://npmx.dev/api/registry/badge/engines/get-it)](https://npmx.dev/package/get-it)

Generic HTTP request library for Node.js (>= 22.12), browsers, Deno, Bun, and edge runtimes. It is built on `fetch()`.

## Features

- Promise-based API with TypeScript types
- Automatic JSON serialization/deserialization
- Base URL and default headers
- HTTP error throwing (on by default)
- Timeout with `AbortSignal.timeout()`
- Cancellation with the standard `AbortController`
- Proxy support in Node.js, Bun, and Deno (reads `HTTP_PROXY`/`HTTPS_PROXY` from environment)
- Middleware system for retry, debug logging, and custom logic
- Injectable `fetch` for testing and custom transports
- Built-in mock fetch with request matching, recording, and vitest matchers

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
const users = await request('/users')
console.log(users.json())

// POST with JSON body (auto-serialized)
const created = await request({
  url: '/users',
  method: 'POST',
  body: {name: 'Espen'},
  as: 'json',
})
console.log(created.body) // parsed JSON
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
// Default: buffered, with convenience methods
const res = await request('/data')
res.status // number
res.statusText // string
res.headers // Headers
res.url // final response URL after redirects
res.redirected // whether the response resulted from following a redirect
res.body // Uint8Array
res.json() // parse as JSON (synchronous)
res.text() // decode as string (synchronous)

// Typed JSON
const users = await request<User[]>({url: '/users', as: 'json'})
users.body // User[]

// Streaming
const file = await request({url: '/large-file', as: 'stream'})
file.body // ReadableStream<Uint8Array>
```

## Options

### Instance options (`createRequester`)

| Option       | Type                                | Default            | Description                                                     |
| ------------ | ----------------------------------- | ------------------ | --------------------------------------------------------------- |
| `base`       | `string`                            | none               | Base URL prepended to relative paths                            |
| `headers`    | `FetchHeaders`                      | none               | Default headers for all requests                                |
| `httpErrors` | `boolean`                           | `true`             | Throw `HttpError` on status >= 400                              |
| `timeout`    | `number \| false \| TimeoutOptions` | `120_000` total    | Timeout in ms, or `{total, headers}`. See [Timeouts](#timeouts) |
| `fetch`      | `FetchFunction`                     | `globalThis.fetch` | Custom fetch implementation                                     |
| `middleware` | `Array`                             | `[]`               | Transform and wrapping middleware                               |

### Per-request options

| Option        | Type                                                       | Description                                                    |
| ------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `url`         | `string`                                                   | Request URL (required)                                         |
| `method`      | `string`                                                   | HTTP method                                                    |
| `body`        | `unknown`                                                  | Request body (objects auto-serialized as JSON)                 |
| `headers`     | `FetchHeaders`                                             | Merged with instance headers                                   |
| `query`       | `Record<string, string \| number \| boolean \| undefined>` | URL query parameters                                           |
| `as`          | `'json' \| 'text' \| 'stream'`                             | Response body type                                             |
| `signal`      | `AbortSignal`                                              | Cancellation signal                                            |
| `httpErrors`  | `boolean`                                                  | Override instance setting                                      |
| `timeout`     | `number \| false \| TimeoutOptions`                        | Override the instance timeout (it replaces all of it)          |
| `fetch`       | `FetchFunction`                                            | Override instance fetch                                        |
| `redirect`    | `'error' \| 'follow' \| 'manual'`                          | Redirect strategy (`'manual'` is opaque in browsers, see note) |
| `credentials` | `'include' \| 'omit' \| 'same-origin'`                     | Credentials mode (browser-only)                                |

> **Note on `redirect: 'manual'`:** In browsers, the Fetch spec gives an opaque-redirect response (status `0`, empty headers). You cannot read the 3xx status or the headers, such as `location`. A read does not throw and does not warn. `headers.get()` returns `null`, and iteration gives nothing. To detect this case, test for `status === 0`. Other runtimes (Node.js, Bun, Deno, edge runtimes, workers) return the real 3xx response, and you can read its status and headers.

## Timeouts

`timeout` accepts a total deadline in milliseconds, `false` to disable, or a structured object:

```ts
const request = createRequester({
  timeout: {
    total: 120_000, // total deadline, request start through body (default 120_000)
    headers: 15_000, // max time to receive response headers, per attempt (disabled by default)
  },
})
```

- `total`: the deadline that a plain number gives you. It covers all of the request, and it includes the body stream in `as: 'stream'` mode. It rejects with a `TimeoutError` DOMException. The `retry()` middleware never retries this error. With the `retry()` middleware, the deadline applies to each attempt. Each retry gets a new total timer.
- `headers`: the time to receive the response headers for one fetch attempt. It does not cover the body download. It rejects with the `TimeoutError` of get-it (`code: 'ETIMEDOUT'`, `phase: 'headers'`). The default `retry()` middleware retries this error on GET and HEAD. The timer is inside the middleware chain, so each attempt gets a new timer. There are no requirements for the order of the middleware.

### Escape hatch: rejection-only timeouts (`signal: false`)

By default, a timeout attaches an abort signal to the fetch init. Keep this default unless your environment prevents it. Next.js is the one known case. Its patched fetch reads a request with a signal as a request that does not use React Request Memoization. Without this option, users of RSC must choose between timeouts and memoization. For that case, `timeout: {total: 30_000, signal: false}` makes both `total` and `headers` reject only. The request promise rejects with the same errors at the deadline, but get-it attaches nothing to the fetch init.

This option has a cost. When a timeout occurs, get-it does not stop the request. The request continues in the background and holds its connection until the server completes it. A `signal` from the caller stays unchanged and still aborts the request. In `as: 'stream'` mode, `total` covers only the time up to the response headers, because get-it cannot retract a stream that you already have.

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
import {isHttpError} from 'get-it'

try {
  await request('/not-found')
} catch (err) {
  if (isHttpError(err)) {
    console.log(err.status) // 404
    console.log(err.response) // full response object
  }
}

// Disable for a single request
const res = await request({url: '/maybe-404', httpErrors: false})
```

`isHttpError()` recognizes the stable HTTP error shape from any get-it v9
release, where `instanceof HttpError` would fail for another installed copy.
It narrows to `HttpErrorLike`; newer response fields such as `response.url` are
optional because early v9 releases did not include them. `isTimeoutError()`
recognizes both get-it's headers-phase `TimeoutError` and the platform
`DOMException` used for total-deadline timeouts. Check for
`error.code === 'ETIMEDOUT'` after narrowing when you need to distinguish the
headers timeout. The guard also accepts DOM implementations such as happy-dom
that omit the spec-required numeric `code`.

## Cancellation

```ts
const controller = new AbortController()
const promise = request({url: '/slow', signal: controller.signal})
controller.abort()
```

get-it combines the timeout signal and your signal automatically with `AbortSignal.any()`. Rejection-only timeouts (`timeout: {signal: false}`) are the exception. For these, get-it sends your signal without a change.

## Middleware

There are two types of middleware. You pass both types in the `middleware` array.

**Transform middleware** (object). A flat pipeline. It is not visible in stack traces.

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

**Wrapping middleware** (function). It wraps the fetch call, and it is visible in stack traces.

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

A `maxRetries` option on a request overrides the value in the retry middleware for that request. To disable retries, set it to `0`.

## Runtime proxy support

In Node.js and Bun, `createRequester` automatically uses an undici-based fetch that reads proxy configuration from environment variables.

In Deno, `createRequester` uses Deno's built-in `fetch`, which also reads `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`.

To set your own proxy or connection pool configuration:

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

In Deno, you can set the proxy, the CA certificates, or HTTP/2 for each client. Create a Deno `HttpClient` and inject your own fetch:

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

`get-it/mock` gives you a mock fetch to test code that uses get-it. It uses no network and it patches no globals. Inject `mock.fetch` where you normally pass `fetch`.

```ts
import {createRequester} from 'get-it'
import {createMockFetch, objectContaining} from 'get-it/mock'

const mock = createMockFetch()
const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})

// Register handlers: responses are one-shot by default
mock.on('GET', '/api/docs', {query: {limit: '10'}}).respond({status: 200, body: {results: []}})

mock
  .on('POST', '/api/docs', {body: objectContaining({_type: 'post'})})
  .respond({status: 201, body: {id: 'abc'}})

const res = await request({url: '/api/docs', query: {limit: 10}, as: 'json'})
// res.body → {results: []}
```

The mock matches requests on the method, the URL (exact, glob, or predicate), the query, the body, and the headers. For loose matching, use `objectContaining()` and the related matchers. The mock records every request. A request that matches no mock throws a `MockFetchError` with a diff against the closest mock.

`get-it/vitest` adds custom matchers to vitest's `expect`:

```ts
// In your test setup file (added through the setupFiles option of vitest)
import 'get-it/vitest'
```

```ts
expect(mock).toHaveReceivedRequest('POST', '/api/docs', {
  body: objectContaining({_type: 'post'}),
})
expect(mock).toHaveConsumedAllMocks()
```

For the full documentation, read [docs/mock.md](docs/mock.md). It covers response sequences, persistent mocks, network errors, and delayed and streaming response bodies (`streamBody()`). It also covers scoped mocks for code that uses more than one host, request recording, value matchers, and all of the vitest matchers.

## Entry points

| Import              | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `get-it`            | Core (it selects the Node variant with conditional exports) |
| `get-it/middleware` | `retry`, `debug`, `isRetryableRequest`, `getRetryDelay`     |
| `get-it/node`       | `createNodeFetch()` for your own undici dispatcher          |
| `get-it/mock`       | `createMockFetch()` and matchers for testing                |
| `get-it/vitest`     | Custom vitest matchers for mock assertions                  |

## Migrating from v8

For the full migration guide, read [docs/MIGRATION-v9.md](docs/MIGRATION-v9.md). The guide is also a playbook for AI agents. Point your agent at the guide and tell it to migrate the codebase.

## Contributing

We welcome contributions. [CONTRIBUTING.md](CONTRIBUTING.md) covers the development setup, the rules for dependencies and bundle size, and how pull requests and releases work.

## License

MIT-licensed. See LICENSE.

[gzip-badge]: https://img.shields.io/bundlephobia/minzip/get-it?label=gzip%20size&style=flat-square
[size-badge]: https://img.shields.io/bundlephobia/min/get-it?label=size&style=flat-square
[bundlephobia]: https://bundlephobia.com/package/get-it
