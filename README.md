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
- Works in Node.js, browsers, Deno, Bun, and edge runtimes

## Installation

```bash
npm install get-it
```

## Usage

```ts
import {createRequest} from 'get-it'

const request = createRequest({
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

### Instance options (`createRequest`)

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
      headers: new Headers({
        ...Object.fromEntries(new Headers(options.headers)),
        'X-Custom': 'value',
      }),
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

const request = createRequest({
  middleware: [retry({maxRetries: 3}), debug({log: console.log, verbose: true})],
})
```

## Node.js proxy support

In Node.js, Bun, and Deno, `createRequest` automatically uses an undici-based fetch that reads proxy configuration from environment variables.

For custom proxy or connection pool settings:

```ts
import {createRequest} from 'get-it'
import {nodeFetch} from 'get-it/node'

const request = createRequest({
  fetch: nodeFetch({
    proxy: 'http://proxy:8080',
    connections: 30,
    allowH2: true,
  }),
})
```

## Entry points

| Import              | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `get-it`            | Core (auto-selects Node variant via conditional exports) |
| `get-it/middleware` | `retry`, `debug`                                         |
| `get-it/node`       | `nodeFetch()` for custom undici dispatcher config        |

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
