# get-it

[![npm stat](https://img.shields.io/npm/dm/get-it.svg?style=flat-square)](https://npm-stat.com/charts.html?package=get-it)
[![npm version](https://img.shields.io/npm/v/get-it.svg?style=flat-square)](https://www.npmjs.com/package/get-it)
[![gzip size][gzip-badge]][bundlephobia]
[![size][size-badge]][bundlephobia]

Generic HTTP request library for node.js (>= 20.19), browsers, and edge runtimes. Built on `fetch()`.

## Features

- Promise-based API with full TypeScript support
- Automatic JSON serialization/deserialization
- Base URL and default headers
- HTTP error throwing (on by default)
- Timeout via `AbortSignal.timeout()`
- Cancellation via standard `AbortController`
- Proxy support in Node.js (reads `HTTP_PROXY`/`HTTPS_PROXY` from environment)
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

| Option       | Type              | Default            | Description                                |
| ------------ | ----------------- | ------------------ | ------------------------------------------ |
| `base`       | `string`          | —                  | Base URL prepended to relative paths       |
| `headers`    | `FetchHeaders`    | —                  | Default headers for all requests           |
| `httpErrors` | `boolean`         | `true`             | Throw `HttpError` on status >= 400         |
| `timeout`    | `number \| false` | —                  | Timeout in ms (uses `AbortSignal.timeout`) |
| `fetch`      | `FetchFunction`   | `globalThis.fetch` | Custom fetch implementation                |
| `middleware` | `Array`           | `[]`               | Transform and wrapping middleware          |

### Per-request options

| Option       | Type                                                       | Description                                    |
| ------------ | ---------------------------------------------------------- | ---------------------------------------------- |
| `url`        | `string`                                                   | Request URL (required)                         |
| `method`     | `string`                                                   | HTTP method                                    |
| `body`       | `unknown`                                                  | Request body (objects auto-serialized as JSON) |
| `headers`    | `FetchHeaders`                                             | Merged with instance headers                   |
| `query`      | `Record<string, string \| number \| boolean \| undefined>` | URL query parameters                           |
| `as`         | `'json' \| 'text' \| 'stream'`                             | Response body type                             |
| `signal`     | `AbortSignal`                                              | Cancellation signal                            |
| `httpErrors` | `boolean`                                                  | Override instance setting                      |
| `timeout`    | `number \| false`                                          | Override instance timeout                      |
| `fetch`      | `FetchFunction`                                            | Override instance fetch                        |

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

## Node.js proxy support

In Node.js, Bun, and Deno, `createRequester` automatically uses an undici-based fetch that reads proxy configuration from environment variables.

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

## Testing

`get-it/mock` provides a mock fetch for testing code that uses get-it. No network, no global patching — just inject `mock.fetch` where you'd normally pass `fetch`.

```ts
import {createRequester} from 'get-it'
import {createMockFetch, objectContaining} from 'get-it/mock'

const mock = createMockFetch()
const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})

// Register handlers — responses are one-shot by default
mock.on('GET', '/api/docs', {query: {limit: '10'}})
  .respond({status: 200, body: {results: []}})

mock.on('POST', '/api/docs', {body: objectContaining({_type: 'post'})})
  .respond({status: 201, body: {id: 'abc'}})

const res = await request({url: '/api/docs', query: {limit: 10}, as: 'json'})
// res.body → {results: []}
```

### Request matching

Requests are matched strictly by default — method, URL path, query parameters, and body must all match exactly. For looser matching, use the built-in matchers:

```ts
import {objectContaining, arrayContaining, stringMatching, anyValue} from 'get-it/mock'

mock.on('POST', '/api/docs', {
  body: objectContaining({_type: 'post', title: stringMatching(/^Hello/)}),
}).respond({status: 201, body: {id: 'abc'}})
```

These implement the `asymmetricMatch` protocol, so vitest's `expect.objectContaining()` and friends work too.

URL matching supports exact strings, glob patterns (`/api/docs/*/revisions`), and function predicates:

```ts
mock.on('GET', '/api/docs/*/revisions').respond({status: 200, body: []})
mock.on('GET', (url) => url.startsWith('/api/')).respond({status: 200, body: 'ok'})
```

### Response sequences

Chain `.respond()` for ordered sequences (useful for testing retries):

```ts
mock.on('GET', '/api/flaky')
  .respond({status: 500, body: 'error'})
  .respond({status: 200, body: 'ok'})

// First call → 500, second call → 200, third call → throws
```

Use `.respondPersist()` for handlers that should match indefinitely.

### Unmatched requests

Any request that doesn't match a registered handler throws a `MockFetchError` with the closest matching handler and a field-level diff:

```
MockFetchError: No mock matched POST /api/documents?limit=10

  Closest mock:
    POST /api/documents?limit=20

  Differences:
    query.limit: expected "20", received "10"
```

### Request inspection

Every request is recorded for later inspection:

```ts
await request({url: '/api/docs', body: {title: 'Hello'}, method: 'POST'})

const reqs = mock.getRequests()
reqs[0].method  // 'POST'
reqs[0].url     // '/api/docs'
reqs[0].body    // {title: 'Hello'}
reqs[0].headers // Headers
```

### Lifecycle

```ts
afterEach(() => {
  mock.assertAllConsumed() // fail if registered responses weren't used
  mock.clear()
})
```

### Vitest matchers

`get-it/vitest` adds custom matchers to vitest's `expect`:

```ts
// In your test setup file or vitest.config setupFiles
import 'get-it/vitest'
```

```ts
// Assert requests were made
expect(mock).toHaveReceivedRequest('POST', '/api/docs', {
  body: objectContaining({_type: 'post'}),
})
expect(mock).toHaveReceivedRequestTimes('GET', '/api/docs', 2)
expect(mock).toHaveConsumedAllMocks()

// Assert on individual recorded requests
const req = mock.getRequests()[0]
expect(req).toHaveHeader('authorization', 'Bearer token123')
expect(req).toHaveBody(objectContaining({_type: 'post'}))
expect(req).toHaveQuery({limit: '10'})
expect(req).toHaveMethod('POST')
expect(req).toHaveUrl('/api/docs')
```

## Entry points

| Import              | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `get-it`            | Core (auto-selects Node variant via conditional exports) |
| `get-it/middleware` | `retry`, `debug`, `isRetryableRequest`, `getRetryDelay`  |
| `get-it/node`       | `createNodeFetch()` for custom undici dispatcher config  |
| `get-it/mock`       | `createMockFetch()` and matchers for testing             |
| `get-it/vitest`     | Custom vitest matchers for mock assertions               |

## Migrating from v8

See [docs/MIGRATION-v9.md](docs/MIGRATION-v9.md) for a comprehensive migration guide.

## License

MIT-licensed. See LICENSE.

## Release new version

Run the ["CI & Release" workflow](https://github.com/sanity-io/get-it/actions).
Make sure to select the main branch and check "Release new version".

Semantic release will only release on configured branches, so it is safe to run release on any branch.

[gzip-badge]: https://img.shields.io/bundlephobia/minzip/get-it?label=gzip%20size&style=flat-square
[size-badge]: https://img.shields.io/bundlephobia/min/get-it?label=size&style=flat-square
[bundlephobia]: https://bundlephobia.com/package/get-it
