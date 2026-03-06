# get-it v2 — Modernization Design

## Goals

- Rewrite from scratch in TypeScript (erasable syntax only)
- ESM-only, no CommonJS
- `fetch()` as the underlying transport in all environments
- Readable stack traces — no pub/sub indirection
- Smaller bundle size
- Zero runtime dependencies in the core

## Architecture

### Core Principles

1. **Single universal core** — the main `get-it` package has no environment-specific code. It takes a `fetch` function (defaulting to globalThis.fetch) and builds on top of it.
2. **Conditional exports** — Node/Bun/Deno automatically resolve to a variant that pre-configures fetch with `EnvHttpProxyAgent` from undici for proxy-from-env support and sensible connection pool defaults. Browsers/workers get the pure version.
3. **Promise-first** — all requests return `Promise`. No observable support, no pub/sub channel system.
4. **Injectable fetch** — consumers can provide their own `fetch` at instance level (default for all requests) and per-request (override for a single call).

### Entry Points

```
get-it           → core (browser/worker/universal)
                 → node variant via conditional exports (node/bun/deno)
get-it/middleware → retry, debug, urlEncoded, mtls
get-it/node      → nodeFetch() helper for custom undici dispatcher config
```

The conditional export in `package.json`:

```json
{
  "exports": {
    ".": {
      "node": "./dist/node.js",
      "bun": "./dist/node.js",
      "deno": "./dist/node.js",
      "default": "./dist/index.js"
    }
  }
}
```

## Public API

### Creating a Request Instance

```ts
import { createRequest } from 'get-it'

const request = createRequest({
  base: 'https://api.example.com',
  headers: { Authorization: 'Bearer ...' },
  httpErrors: true,       // default: true — throws HttpError on 4xx/5xx
  timeout: 30000,         // uses AbortSignal.timeout()
  fetch: myCustomFetch,   // injectable fetch (instance default)
  middleware: [retry(), debug({ ... })],
})
```

### Making Requests

```ts
// Simple — URL string
const res = await request('/users')

// Full options
const res = await request({
  url: '/users',
  method: 'POST',
  body: {name: 'Espen'}, // auto-JSON if plain object
  as: 'json', // determines body type
  signal: controller.signal, // AbortController cancellation
  headers: {'X-Custom': 'value'}, // merged with instance headers
  fetch: otherFetch, // per-request fetch override
})
```

### Response Shape

```ts
interface Response<T> {
  status: number
  statusText: string
  headers: Headers
  body: T

  // Convenience methods (when `as` is not set)
  json(): unknown
  text(): string
  bytes(): Uint8Array
}
```

When `as` is omitted, the response body is buffered as `Uint8Array` and the convenience methods decode from that buffer. They are synchronous (data is already fetched) and can be called multiple times.

| `as` value | `body` type                                     | Buffered? |
| ---------- | ----------------------------------------------- | --------- |
| omitted    | `Uint8Array` + `.json()`, `.text()`, `.bytes()` | yes       |
| `'json'`   | `unknown` (or generic `T`)                      | yes       |
| `'text'`   | `string`                                        | yes       |
| `'stream'` | `ReadableStream<Uint8Array>`                    | no        |

Generic type parameter for JSON:

```ts
const res = await request<User[]>({url: '/users', as: 'json'})
// res.body: User[]
```

This is a type-only convenience (no runtime validation).

## Built-in Behavior (Inlined in Core)

These are small enough to be part of the core, not middleware:

- **Base URL** — prepend `base` config to relative URLs
- **Default headers** — merge instance headers with per-request headers
- **JSON request body** — auto-serialize plain objects, set `content-type: application/json`
- **Query string** — merge `query` object into URL search params
- **HTTP errors** — throw `HttpError` on status >= 400 (default on, opt out with `httpErrors: false`)
- **Timeout** — `AbortSignal.timeout(ms)` composed with user-provided signal

## Middleware System

Two types of middleware, passed in the same `middleware` array:

### Transform Middleware (flat, invisible in stack traces)

```ts
interface TransformMiddleware {
  beforeRequest?: (options: RequestOptions) => RequestOptions
  afterResponse?: (response: Response) => Response
}
```

Applied as a flat pipeline: all `beforeRequest` hooks run sequentially before fetch, all `afterResponse` hooks run sequentially after. They do not wrap the fetch call, so they never appear in error stack traces.

### Wrapping Middleware (appears in stack traces)

```ts
type WrappingMiddleware = (
  request: RequestOptions,
  next: (request: RequestOptions) => Promise<Response>,
) => Promise<Response>
```

Wraps the fetch call. Used for retry, error recovery, or anything that needs try/catch around the request. These appear in stack traces, which is intentional — you want to see `retry` in the trace when debugging.

Get-it distinguishes the two by shape: object = transform, function = wrapping.

### Execution Order

```
beforeRequest transforms (sequential, flat)
  → wrapping middlewares (nested)
    → fetch()
  ← wrapping middlewares
afterResponse transforms (sequential, flat)
```

## Middleware That Ships

### `retry(options?)`

- **Type**: Wrapping
- **Purpose**: Retry failed requests with exponential backoff
- **Options**: `maxRetries` (default 5), `retryDelay`, `shouldRetry`
- **Default behavior**: Retries network errors and ECONNRESET on GET/HEAD. Does not retry HTTP status errors.
- **Backoff**: `100 * 2^attempt + random(0-100ms)`

### `debug(options?)`

- **Type**: Transform
- **Purpose**: Log requests/responses with header redaction
- **Options**: `log` function, `redactHeaders` list, `verbose` flag
- **Log function type**: `(message: string, ...args: unknown[]) => void`
- **Compatible with**: `console.log`, `debug('namespace')`, any custom logger

### `urlEncoded()`

- **Type**: Transform
- **Purpose**: Encode request body as `application/x-www-form-urlencoded`

### `mtls(options)` (Node-only)

- **Type**: Transform
- **Purpose**: Mutual TLS — configures cert/key/ca via custom undici dispatcher
- **Options**: `{ ca, cert, key }`

## Node Helpers (`get-it/node`)

### `nodeFetch(options?)`

Creates a `fetch` function with a custom undici dispatcher. For advanced transport-level configuration:

```ts
import {nodeFetch} from 'get-it/node'

const request = createRequest({
  fetch: nodeFetch({
    proxy: 'http://proxy:8080', // explicit proxy
    // or proxy: true             // read from env (default behavior of node entry)
    maxSockets: 30,
    maxTotalSockets: 256,
    allowH2: true,
  }),
})
```

## Cancellation

Standard `AbortController` — pass `signal` in request options:

```ts
const controller = new AbortController()
const res = request({url: '/users', signal: controller.signal})
controller.abort()
```

No custom CancelToken, no cancellation machinery in get-it.

## Error Handling

### HttpError

Thrown by default on HTTP status >= 400:

```ts
class HttpError extends Error {
  status: number
  statusText: string
  headers: Headers
  body: unknown // parsed body if available
  response: Response // full response object
}
```

Opt out with `httpErrors: false` in config or per-request options.

### Network Errors

Passed through as-is from fetch. The retry middleware can catch and retry these.

## What's Dropped from v1

- Observable support — consumers use `from()` wrapper
- Progress events — consumers handle upload progress directly (e.g. XHR)
- Pub/sub channel system — replaced by async/await
- CancelToken — replaced by AbortController signal
- `follow-redirects` dependency — fetch handles redirects
- `tunnel-agent` dependency — undici handles tunneling
- `injectResponse` / request injection
- `keepAlive` middleware — built into fetch; ECONNRESET retry in retry middleware
- `agent` middleware — use `nodeFetch()` helper or injectable fetch
- `maxRedirects` option
- `jsonResponse` middleware — use `as: 'json'` or `res.json()`
- CommonJS support
- Multiple consumer-facing entry points — conditional exports handle environment detection

## Migration Path

| v1                               | v2                                         |
| -------------------------------- | ------------------------------------------ |
| `getIt([promise()])`             | `createRequest()`                          |
| `getIt([base(url), headers(h)])` | `createRequest({ base: url, headers: h })` |
| `promise.CancelToken.source()`   | `new AbortController()`                    |
| `cancelToken: source.token`      | `signal: controller.signal`                |
| `jsonResponse()` middleware      | `as: 'json'` or `res.json()`               |
| `jsonRequest()` middleware       | built-in (auto-JSON plain objects)         |
| `httpErrors()` middleware        | built-in, on by default                    |
| `observable()` middleware        | `from(promise)` in consumer                |
| `progress()` middleware          | handle in consumer                         |
| `keepAlive()` middleware         | built into fetch                           |
| `agent(opts)` middleware         | `nodeFetch(opts)` or injectable fetch      |
| `res.body` (pre-parsed)          | `res.json()` / `res.text()` / `as` option  |
| `stream: true`                   | `as: 'stream'`                             |
| `rawBody: true`                  | `as` omitted (body is `Uint8Array`)        |
