# Mock fetch and vitest matchers

`get-it/mock` provides a mock fetch for testing code that uses get-it. There is no network access and no global patching: `createMockFetch()` returns an object whose `fetch` function you inject wherever you would normally pass `fetch`. It works in any runtime get-it works in, and with any test runner.

`get-it/vitest` adds custom matchers to vitest's `expect` for asserting on the mock. See [Vitest matchers](#vitest-matchers).

- [Setup](#setup)
- [Registering mocks](#registering-mocks)
- [Response definition](#response-definition)
- [Simulating network errors](#simulating-network-errors)
- [URL matching](#url-matching)
- [Query matching](#query-matching)
- [Body matching](#body-matching)
- [Header matching](#header-matching)
- [Value matchers](#value-matchers)
- [One-shot vs persistent mocks](#one-shot-vs-persistent-mocks)
- [Scoped mocks](#scoped-mocks)
- [Request recording](#request-recording)
- [Streaming response bodies](#streaming-response-bodies)
- [Unmatched requests and diagnostics](#unmatched-requests-and-diagnostics)
- [Vitest matchers](#vitest-matchers)

## Setup

Create a mock, inject `mock.fetch` into `createRequester`, register handlers, make requests:

```ts
import {createRequester} from 'get-it'
import {createMockFetch} from 'get-it/mock'

const mock = createMockFetch()
const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})

mock.on('GET', '/api/docs').respond({status: 200, body: {results: []}})

const res = await request({url: '/api/docs', as: 'json'})
// res.body → {results: []}
```

A typical test lifecycle asserts that every registered response was used, then resets:

```ts
afterEach(() => {
  mock.assertAllConsumed() // throws if registered responses weren't used
  mock.clear() // removes all handlers and recorded requests
})
```

`assertAllConsumed()` throws an `Error` listing each handler that still has unconsumed responses. Persistent responses (see [One-shot vs persistent mocks](#one-shot-vs-persistent-mocks)) never count as unconsumed.

## Registering mocks

`mock.on(method, url, options?)` registers a handler and returns a builder for attaching responses:

- `method` - HTTP method, compared exactly (use uppercase: `'GET'`, `'POST'`, ...)
- `url` - exact path, glob pattern, full URL, or predicate function (see [URL matching](#url-matching))
- `options` - optional constraints on `query`, `body`, and `headers`

`mock.onAny(url, options?)` is the same but matches any HTTP method.

The builder methods all return the builder, so they chain:

- `.respond(def)` - queue a one-shot response
- `.respondPersist(def)` - respond to every matching request, forever
- `.respondWithError(error)` - reject the request once with a transport-level error
- `.respondWithErrorPersist(error)` - reject every matching request

Chained responses are consumed in order, which is useful for testing retries:

```ts
mock
  .on('GET', '/api/flaky')
  .respond({status: 500, body: 'error'})
  .respond({status: 200, body: 'ok'})

// First call → 500, second call → 200, third call → MockFetchError
```

When several handlers could match a request, the first registered handler that matches and still has an available response wins. A handler whose responses are exhausted is skipped, so a later handler can take over.

## Response definition

`.respond()` and `.respondPersist()` take a `MockResponseDef`:

- `status` - HTTP status code, defaults to `200`
- `statusText` - defaults to the standard text for the status code (`'OK'`, `'Not Found'`, ...)
- `body` - response body (see below)
- `headers` - response headers as a plain record
- `delay` - milliseconds before the response resolves (see below)

The `body` value determines serialization:

- a string is returned as-is
- `undefined` or `null` produces an empty body
- a `streamBody(...)` value streams chunks (see [Streaming response bodies](#streaming-response-bodies))
- anything else is `JSON.stringify`-ed, and `content-type: application/json` is set unless you provided a `content-type` header yourself

```ts
mock.on('GET', '/api/docs').respond({
  status: 200,
  headers: {'x-request-id': 'abc123'},
  body: {results: []}, // serialized as JSON, content-type set automatically
})
```

### Delayed responses

`delay` simulates server response time. The request is treated as sent immediately; the response resolves after `delay` milliseconds. Values of `0` or less resolve immediately.

```ts
mock.on('GET', '/slow').respond({status: 200, body: {ok: true}, delay: 100})
```

If the request is aborted before the delay elapses - via an `AbortController` signal or a get-it `timeout` - the request rejects with the signal's reason and the pending timer is cleared. This makes timeout logic testable without a real server.

## Simulating network errors

`.respondWithError()` rejects the matched request the way a real `fetch()` rejects on a failed connection, instead of resolving to a response. The error is thrown unmodified, preserving `name`, `message`, and `cause`:

```ts
mock
  .on('GET', '/api/docs')
  .respondWithError(new TypeError('fetch failed', {cause: {code: 'ECONNRESET'}}))
```

Pass a factory function to get a fresh error instance per rejection (useful with `.respondWithErrorPersist()`):

```ts
mock.onAny('/api/docs').respondWithErrorPersist(() => new TypeError('fetch failed'))
```

Notes:

- Error responses chain with regular responses, so you can queue an error followed by a success to test retry recovery.
- The request is still recorded (visible in `getRequests()`) even when it rejects.
- One-shot error responses count toward consumption: `assertAllConsumed()` throws while an unconsumed `.respondWithError()` remains.

## URL matching

The `url` argument to `on()` / `onAny()` accepts four forms:

- an exact path: `/api/docs`
- a glob pattern: `*` matches within one path segment, `**` matches across segments
- a full URL with origin: `https://api.example.com/api/docs` (constrains the origin too)
- a predicate function receiving the request path (without origin or query string) and returning a boolean

```ts
mock.on('GET', '/api/docs/*/revisions').respond({status: 200, body: []})
mock.on('GET', '/api/**').respond({status: 200, body: []})
mock.on('GET', 'https://api.example.com/v1/projects').respond({status: 200, body: []})
mock.on('GET', (url) => url.startsWith('/api/')).respond({status: 200, body: 'ok'})
```

Handlers registered with a plain path match requests to any host. Handlers registered with a full URL only match that origin.

A URL pattern may include a query string (`/api/docs?limit=10`), which becomes a query constraint. Combining a query string in the URL pattern with an asymmetric `query` matcher in options throws at registration time; use one form or the other.

## Query matching

A handler with no query constraint matches any query parameters. Once you constrain the query - via a query string in the URL pattern or the `query` option - matching is strict: the request's query parameters must match the expected set exactly (same keys, same values).

```ts
mock.on('GET', '/api/docs', {query: {limit: '10'}}).respond({status: 200, body: {results: []}})

await request({url: '/api/docs', query: {limit: 10}}) // matches
await request({url: '/api/docs', query: {limit: 10, offset: 0}}) // no match: extra key
```

Number and boolean values in the `query` option are coerced to strings, since query parameters are always strings on the wire: `{limit: 10}` matches `?limit=10`.

For partial matching, use `queryContaining()` or any other [value matcher](#value-matchers):

```ts
import {queryContaining} from 'get-it/mock'

mock
  .on('GET', '/api/docs', {query: queryContaining({limit: 10})})
  .respond({status: 200, body: {results: []}})
```

## Body matching

A handler with no `body` option matches any request body. With a `body` option, matching is strict by default: objects must match deeply with the same keys, strings and bytes must be identical. Use [value matchers](#value-matchers) for partial matching.

```ts
import {objectContaining} from 'get-it/mock'

// Strict: the request body must be exactly {_type: 'post', title: 'Hello'}
mock.on('POST', '/api/docs', {body: {_type: 'post', title: 'Hello'}}).respond({status: 201})

// Loose: extra keys on the request body are fine
mock.on('POST', '/api/docs', {body: objectContaining({_type: 'post'})}).respond({status: 201})
```

### How request bodies are normalized

The mock normalizes each request body to a canonical form, used both for matching and for what `getRequests()` records:

- a string body with a JSON `content-type` is parsed, so you match against the object, not the JSON text (get-it serializes plain-object bodies this way, so they round-trip)
- other string bodies stay strings
- `Uint8Array` / `ArrayBuffer` / `Buffer` bodies are recorded as a `Uint8Array` snapshot (later mutation of the source does not affect the recording)
- a `ReadableStream` body is drained and recorded as a single `Uint8Array`
- a `Blob` or `File` body is recorded as its bytes (`Uint8Array`)
- a `URLSearchParams` body becomes a plain record; a key appearing multiple times becomes an array of strings
- a `FormData` body becomes a plain record; string fields stay strings, file fields become `{name, type, size, bytes}`, and repeated fields become arrays

The expected `body` you pass to `on()` may also be a native `URLSearchParams`, `FormData`, `Blob`, `Uint8Array`, or `ArrayBuffer`; it is normalized the same way before comparison. Binary bodies are compared byte-for-byte.

```ts
import {bodyBytes, objectContaining} from 'get-it/mock'

// Exact bytes
mock.on('POST', '/upload', {body: bodyBytes(new Uint8Array([1, 2, 3]))}).respond({status: 201})

// Match a FormData file part by name, type, and content
const pngBytes = new Uint8Array([137, 80, 78, 71])
mock
  .on('POST', '/upload', {
    body: objectContaining({
      file: objectContaining({name: 'a.png', type: 'image/png', bytes: bodyBytes(pngBytes)}),
    }),
  })
  .respond({status: 201})
```

### Synthesized content-type headers

Mirroring platform `fetch`, the mock fills in the default `content-type` for body types that have one, when the request did not set one explicitly. The synthesized header is recorded and matchable:

- `URLSearchParams` → `application/x-www-form-urlencoded;charset=UTF-8`
- `FormData` → `multipart/form-data; boundary=...` (the boundary is random; match the prefix with `stringMatching()`, not the whole value)
- `Blob` / `File` → the blob's `type`, when set

An explicit `content-type` header on the request always wins.

## Header matching

The `headers` option uses containing semantics: only the headers you list are checked, extra request headers are ignored. Header names are compared case-insensitively. Values can be exact strings or [value matchers](#value-matchers), and the whole constraint can be a single asymmetric matcher:

```ts
import {objectContaining, stringMatching} from 'get-it/mock'

mock.on('POST', '/x', {headers: {'Content-Type': 'text/plain'}}).respond({status: 200})

mock.on('POST', '/x', {headers: {authorization: stringMatching(/^Bearer /)}}).respond({status: 200})

mock
  .on('POST', '/x', {headers: objectContaining({'content-type': stringMatching(/^text\//)})})
  .respond({status: 200})
```

## Value matchers

`get-it/mock` exports asymmetric matchers for loose matching, usable anywhere an expected value goes (`query`, `body`, `headers`, nested values, and the vitest matchers):

- `objectContaining(subset)` - matches an object that contains at least the given keys with matching values; extra keys are ignored
- `arrayContaining(items)` - matches an array that contains at least the given items, in any order
- `stringMatching(pattern)` - matches a string against a regex, or by substring when given a string
- `anyValue()` - matches any value
- `queryContaining(subset)` - like `objectContaining` for query-shaped records: expected numbers/booleans are coerced to strings, and an array expected value matches a multi-value parameter containing each entry
- `bodyBytes(bytes)` - matches a recorded binary body (`Uint8Array`) against exact bytes; accepts a `Uint8Array` or `ArrayBuffer`

Matchers nest:

```ts
import {arrayContaining, objectContaining, stringMatching} from 'get-it/mock'

mock
  .on('POST', '/api/docs', {
    body: objectContaining({
      title: stringMatching(/^Hello/),
      tags: arrayContaining(['news']),
    }),
  })
  .respond({status: 201, body: {id: 'abc'}})
```

They implement the `asymmetricMatch` protocol shared with vitest and Jest, so vitest's `expect.objectContaining()`, `expect.stringContaining()` and friends work in all the same places.

## One-shot vs persistent mocks

Responses queued with `.respond()` and `.respondWithError()` are one-shot: each is consumed by exactly one matching request, in registration order. When a handler's queue is exhausted, the handler no longer matches (later handlers get a chance, and if none match, a `MockFetchError` is thrown).

`.respondPersist()` and `.respondWithErrorPersist()` register persistent responses that serve any number of requests:

```ts
mock.on('GET', '/api/config').respondPersist({status: 200, body: {feature: true}})
```

Details:

- A persistent response never counts as unconsumed for `assertAllConsumed()`.
- Responses are picked in queue order, and a persistent response never exhausts, so anything queued after it on the same handler is unreachable.

`mock.clear()` removes all handlers and recorded requests, resetting the instance.

## Scoped mocks

When code under test talks to multiple hosts, `mock.scope(baseUrl)` gives a view of the mock constrained to one origin:

```ts
const mock = createMockFetch()
const api = mock.scope('https://abc123.api.sanity.io')
const cdn = mock.scope('https://abc123.apicdn.sanity.io')

api.on('POST', '/v1/data/mutate/prod').respond({status: 200, body: {transactionId: 'tx1'}})
cdn.on('GET', '/v1/data/query/prod').respond({status: 200, body: {result: []}})

const request = createRequester({fetch: mock.fetch})
await request({url: 'https://abc123.apicdn.sanity.io/v1/data/query/prod', as: 'json'})

cdn.getRequests() // 1 request
api.getRequests() // 0 requests
mock.getRequests() // all requests, across scopes
```

A `MockScope` has `on()`, `onAny()`, `getRequests()`, and `assertAllConsumed()`:

- Handlers registered through a scope only match requests to that origin.
- `scope.getRequests()` only returns requests sent to that origin.
- `scope.assertAllConsumed()` only checks handlers registered through that scope.
- `scope()` requires a full URL with origin and throws on a relative path.
- Registering a full URL through a scope uses the URL's own origin instead of the scope's.

Scopes and plain registration mix freely: handlers registered on the root mock with a plain path match any origin.

## Request recording

Every request through `mock.fetch` is recorded, whether it matched or not (including requests that rejected via `respondWithError`). `mock.getRequests()` returns a fresh array of `RecordedRequest` objects in call order:

- `method` - the HTTP method (`'GET'`, `'POST'`, ...)
- `url` - the path portion, without origin or query string (`'/api/docs'`)
- `fullUrl` - the complete URL as passed to fetch
- `query` - query parameters parsed into a `Record<string, string>`
- `headers` - a `Headers` instance, including any synthesized `content-type`
- `body` - the normalized body (see [Body matching](#body-matching)), or `undefined`

```ts
await request({url: '/api/docs', method: 'POST', body: {title: 'Hello'}, query: {validate: true}})

const [req] = mock.getRequests()
req.method // 'POST'
req.url // '/api/docs'
req.query // {validate: 'true'}
req.body // {title: 'Hello'}
req.headers.get('content-type') // 'application/json'
```

## Streaming response bodies

`streamBody(...parts)` declares a response body delivered in chunks, with optional pauses, a permanent stall, or a mid-download error. Pass the result as `body` in a response definition:

```ts
import {createMockFetch, streamBody, streamDelay, streamError, streamStall} from 'get-it/mock'

const mock = createMockFetch()

// Two chunks with a 1s pause in between
mock.on('GET', '/backup').respond({
  status: 200,
  body: streamBody('partial', streamDelay(1000), 'done'),
})

// A download that stalls forever after the first chunk
const stalled = streamBody('partial', streamStall())
mock.on('GET', '/stuck').respond({body: stalled})

// A connection cut mid-download
mock.on('GET', '/flaky').respond({
  body: streamBody('partial', streamError(new Error('connection reset'))),
})
```

Script parts:

- a string chunk is UTF-8 encoded; a `Uint8Array` chunk passes through as bytes
- `streamDelay(ms)` pauses before delivering the next part; allowed anywhere in the script
- `streamStall()` never closes the body; the stream ends only when the consumer cancels it or the request's abort signal fires
- `streamError(error)` errors the body stream with the given error

`streamStall()` and `streamError()` are terminal: they must be the last part. The script is validated eagerly, so an invalid script throws a `TypeError` from `streamBody()` itself.

Behavior:

- `delay` on the response definition still controls time-to-headers; the script controls the body after that.
- A fresh stream is built from the script for every consumption, so a `streamBody` works with `respondPersist`.
- Aborting the request signal errors the body with the abort reason, matching real fetch behavior.
- Buffered reads (no `as` option, or `text()` / `arrayBuffer()`) drain the script with the same timing, so total-deadline timeout behavior is testable without `as: 'stream'`.

### The StreamBody handle

The `streamBody()` return value doubles as an observability handle. Consumer cancellations of any stream built from the script are aggregated on it:

- `cancelCount` - number of times a consumer cancelled a stream produced from this script
- `lastCancelReason` - the reason passed to the most recent cancel, if any

```ts
const stalled = streamBody('partial', streamStall())
mock.on('GET', '/stuck').respond({body: stalled})

// ...code under test times out reading the body and cancels it...

expect(stalled.cancelCount).toBe(1)
expect(stalled).toHaveBeenCancelled() // matcher from 'get-it/vitest'
```

Cancellation (consumer calls `cancel()` on the stream) and abort (the request signal fires) are tracked separately: an abort errors the stream but does not increment `cancelCount`.

## Unmatched requests and diagnostics

A request that matches no registered handler rejects with a `MockFetchError`. The message includes the closest-matching mock, a field-level diff against it, and the full list of registered mocks with their consumption state:

```
MockFetchError: No mock matched POST /api/documents?limit=10

  Closest mock:
    POST /api/documents?limit=20

  Differences:
    query.limit: expected "20", received "10"

  All registered mocks:
    1. POST /api/documents?limit=20 (exhausted)
    2. GET /api/other (1 responses remaining)
```

The closest mock is chosen by scoring each handler on how many dimensions match (origin, method, URL, query, body, headers). Diffs are structural where possible: nested object bodies produce per-path entries like `body.attributes.title: expected "a", received "b"`, and binary bodies render as byte lengths (`Uint8Array(3 bytes)`).

The error instance also exposes `method`, `url`, `query`, and `body` fields for programmatic inspection, and its `name` is `'MockFetchError'`. The class is exported from `get-it/mock` for `instanceof` checks.

## Vitest matchers

`get-it/vitest` registers custom matchers on vitest's `expect` and augments vitest's types, both via a single side-effect import.

### Registration

Import it in a setup file:

```ts
// test/setup.ts
import 'get-it/vitest'
```

And point vitest at the setup file:

```ts
// vitest.config.ts
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
  },
})
```

The import calls `expect.extend()` with the matchers and includes a `declare module 'vitest'` augmentation, so TypeScript knows about the matchers as long as the setup file is part of your TypeScript project (for a single test file, importing `'get-it/vitest'` at the top works too). All matchers support negation with `.not`.

### Matchers on the mock instance

`toHaveReceivedRequest(method, url, options?)` - asserts a matching request was recorded. The `url` accepts an exact path, a glob pattern, or a full URL (which also constrains the origin), and may include a query string. `options` accepts `query` and `body` constraints, including value matchers. The failure message lists all recorded requests.

```ts
expect(mock).toHaveReceivedRequest('POST', '/api/docs', {
  body: objectContaining({_type: 'post'}),
})
expect(mock).toHaveReceivedRequest('GET', '/api/docs?limit=10')
```

`toHaveReceivedRequestTimes(method, url, times)` - asserts an exact number of matching requests. Same `url` forms; query strings in the `url` constrain the count.

```ts
expect(mock).toHaveReceivedRequestTimes('GET', '/api/docs', 2)
expect(mock).toHaveReceivedRequestTimes('DELETE', '/api/docs/*', 0)
```

`toHaveConsumedAllMocks()` - asserts every registered one-shot response was used; the assertion form of `mock.assertAllConsumed()`. On failure, the message lists the unconsumed handlers.

```ts
expect(mock).toHaveConsumedAllMocks()
```

### Matchers on recorded requests

These operate on a single `RecordedRequest` from `mock.getRequests()`:

`toHaveHeader(name, value)` - asserts a header matches. The name is case-insensitive (standard `Headers` semantics) and the value can be a string or an asymmetric matcher.

```ts
const [req] = mock.getRequests()
expect(req).toHaveHeader('authorization', 'Bearer token123')
expect(req).toHaveHeader('content-type', stringMatching(/json/))
```

`toHaveBody(expected)` - asserts the normalized request body matches. Strict deep equality unless you use value matchers.

```ts
expect(req).toHaveBody({title: 'Hello'})
expect(req).toHaveBody(objectContaining({title: 'Hello'}))
```

`toHaveQuery(expected)` - asserts the parsed query parameters match. Strict: all keys must be present and equal (values are strings). Use `queryContaining()` for partial matching.

```ts
expect(req).toHaveQuery({limit: '10', offset: '0'})
expect(req).toHaveQuery(queryContaining({limit: 10}))
```

`toHaveMethod(expected)` - asserts the HTTP method.

```ts
expect(req).toHaveMethod('POST')
```

`toHaveUrl(expected)` - asserts the request path (the `url` field: path only, no origin or query string) by exact string comparison.

```ts
expect(req).toHaveUrl('/api/docs')
```

### Matchers on stream bodies

`toHaveBeenCancelled()` - asserts a `streamBody()` handle was cancelled by a consumer at least once. The failure message for `.not` includes the cancel count and last cancel reason.

```ts
const stalled = streamBody('partial', streamStall())
mock.on('GET', '/stuck').respond({body: stalled})

// ...consumer cancels the body, e.g. its read timeout fired...

expect(stalled).toHaveBeenCancelled()
```
