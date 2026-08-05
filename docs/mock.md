# Mock fetch and vitest matchers

`get-it/mock` gives you a mock fetch to test code that uses get-it. It uses no network and it patches no globals. `createMockFetch()` returns an object with a `fetch` function. You use this function where you normally pass `fetch`. The mock runs in any runtime that get-it supports, and with any test runner.

`get-it/vitest` adds custom matchers to the `expect` of vitest. Use them to assert on the mock. See [Vitest matchers](#vitest-matchers).

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

Create a mock. Inject `mock.fetch` into `createRequester`. Register the handlers. Then make the requests.

```ts
import {createRequester} from 'get-it'
import {createMockFetch} from 'get-it/mock'

const mock = createMockFetch()
const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})

mock.on('GET', '/api/docs').respond({status: 200, body: {results: []}})

const res = await request({url: '/api/docs', as: 'json'})
// res.body → {results: []}
```

A typical test asserts that the code used every registered response. The test then resets the mock.

```ts
afterEach(() => {
  mock.assertAllConsumed() // throws if registered responses weren't used
  mock.clear() // removes all handlers and recorded requests
})
```

`assertAllConsumed()` throws an `Error`. The error lists each handler that still has unconsumed responses. Persistent responses (see [One-shot vs persistent mocks](#one-shot-vs-persistent-mocks)) never count as unconsumed.

## Registering mocks

`mock.on(method, url, options?)` registers a handler. It returns a builder that attaches responses:

- `method` - HTTP method, compared exactly (use uppercase: `'GET'`, `'POST'`, ...)
- `url` - exact path, glob pattern, full URL, or predicate function (see [URL matching](#url-matching))
- `options` - optional constraints on `query`, `body`, and `headers`

`mock.onAny(url, options?)` is the same but matches any HTTP method.

The builder methods all return the builder, so they chain:

- `.respond(def)` - queue a one-shot response
- `.respondPersist(def)` - respond to every matching request, forever
- `.respondWithError(error)` - reject the request once with a transport-level error
- `.respondWithErrorPersist(error)` - reject every matching request

The mock consumes chained responses in order. This behavior is useful when you test retries:

```ts
mock
  .on('GET', '/api/flaky')
  .respond({status: 500, body: 'error'})
  .respond({status: 200, body: 'ok'})

// First call → 500, second call → 200, third call → MockFetchError
```

When several handlers can match a request, the mock uses the first handler that matches and still has an available response. The mock skips a handler with no more responses. A later handler can then match.

## Response definition

`.respond()` and `.respondPersist()` take a `MockResponseDef`:

- `status` - HTTP status code, defaults to `200`
- `statusText` - defaults to the standard text for the status code (`'OK'`, `'Not Found'`, ...)
- `body` - response body (see below)
- `headers` - response headers as a plain record
- `delay` - milliseconds before the response resolves (see below)

The `body` value sets how the mock serializes the body:

- the mock returns a string without a change
- `undefined` or `null` produces an empty body
- a `streamBody(...)` value streams chunks (see [Streaming response bodies](#streaming-response-bodies))
- for all other values, the mock uses `JSON.stringify`. It also sets `content-type: application/json`, unless you supply a `content-type` header

```ts
mock.on('GET', '/api/docs').respond({
  status: 200,
  headers: {'x-request-id': 'abc123'},
  body: {results: []}, // serialized as JSON, content-type set automatically
})
```

### Delayed responses

`delay` simulates the response time of the server. The mock sends the request immediately. The response resolves after `delay` milliseconds. A value of `0` or less resolves immediately.

```ts
mock.on('GET', '/slow').respond({status: 200, body: {ok: true}, delay: 100})
```

If the request aborts before the delay is complete, the request rejects with the reason of the signal. An `AbortController` signal or a get-it `timeout` can cause this abort. The mock also clears the pending timer. With this behavior, you can test timeout logic without a real server.

## Simulating network errors

`.respondWithError()` rejects the matched request and does not resolve to a response. A real `fetch()` rejects in the same way when a connection fails. The mock throws the error without a change, and it keeps `name`, `message`, and `cause`:

```ts
mock
  .on('GET', '/api/docs')
  .respondWithError(new TypeError('fetch failed', {cause: {code: 'ECONNRESET'}}))
```

Pass a factory function to get a fresh error instance per rejection (useful with `.respondWithErrorPersist()`):

```ts
mock.onAny('/api/docs').respondWithErrorPersist(() => new TypeError('fetch failed'))
```

In all other conditions, error responses operate like regular responses:

- Error responses chain with regular responses. Thus you can queue an error, then a success, to test the recovery after a retry.
- The mock records the request even when the request rejects. `getRequests()` shows it.
- One-shot error responses are consumable. `assertAllConsumed()` throws when an unconsumed `.respondWithError()` remains.

## URL matching

The `url` argument to `on()` / `onAny()` accepts four forms:

- an exact path: `/api/docs`
- a glob pattern: `*` matches within one path segment, `**` matches across segments
- a full URL with origin: `https://api.example.com/api/docs` (constrains the origin too)
- a predicate function that receives the request path (no origin, no query string) and returns a boolean

```ts
mock.on('GET', '/api/docs/*/revisions').respond({status: 200, body: []})
mock.on('GET', '/api/**').respond({status: 200, body: []})
mock.on('GET', 'https://api.example.com/v1/projects').respond({status: 200, body: []})
mock.on('GET', (url) => url.startsWith('/api/')).respond({status: 200, body: 'ok'})
```

Handlers registered with a plain path match requests to any host. Handlers registered with a full URL only match that origin.

A URL pattern can include a query string (`/api/docs?limit=10`). The query string becomes a query constraint. If you use a query string in the URL pattern and an asymmetric `query` matcher in the options, the registration throws. Use one form or the other.

## Query matching

A handler with no query constraint matches any query parameters. You can constrain the query with a query string in the URL pattern, or with the `query` option. The match is then strict. The request must have the same keys and the same values as the expected set.

```ts
mock.on('GET', '/api/docs', {query: {limit: '10'}}).respond({status: 200, body: {results: []}})

await request({url: '/api/docs', query: {limit: 10}}) // matches
await request({url: '/api/docs', query: {limit: 10, offset: 0}}) // no match: extra key
```

The mock converts number and boolean values in the `query` option to strings, because query parameters are always strings on the wire. Thus `{limit: 10}` matches `?limit=10`.

For partial matching, use `queryContaining()` or any other [value matcher](#value-matchers):

```ts
import {queryContaining} from 'get-it/mock'

mock
  .on('GET', '/api/docs', {query: queryContaining({limit: 10})})
  .respond({status: 200, body: {results: []}})
```

## Body matching

A handler with no `body` option matches any request body. With a `body` option, the match is strict by default. Objects must match deeply and have the same keys. Strings and bytes must be identical. For partial matching, use [value matchers](#value-matchers).

```ts
import {objectContaining} from 'get-it/mock'

// Strict: the request body must be exactly {_type: 'post', title: 'Hello'}
mock.on('POST', '/api/docs', {body: {_type: 'post', title: 'Hello'}}).respond({status: 201})

// Loose: extra keys on the request body are fine
mock.on('POST', '/api/docs', {body: objectContaining({_type: 'post'})}).respond({status: 201})
```

### How request bodies are normalized

The mock normalizes each request body to a canonical form. It uses this form for the matching and for the records of `getRequests()`:

- the mock parses a string body with a JSON `content-type`. You match against the object, not the JSON text. get-it serializes plain-object bodies in this way, so they round-trip
- other string bodies stay strings
- the mock records `Uint8Array`, `ArrayBuffer`, and `Buffer` bodies as a `Uint8Array` snapshot (a later change to the source does not affect the record)
- the mock drains a `ReadableStream` body and records it as one `Uint8Array`
- the mock records a `Blob` or `File` body as its bytes (`Uint8Array`)
- a `URLSearchParams` body becomes a plain record. A key that occurs more than one time becomes an array of strings
- a `FormData` body becomes a plain record. String fields stay strings. File fields become `{name, type, size, bytes}`. Fields that occur more than one time become arrays

The expected `body` that you pass to `on()` can also be a native `URLSearchParams`, `FormData`, `Blob`, `Uint8Array`, or `ArrayBuffer`. The mock normalizes it in the same way before the comparison. It compares binary bodies byte-for-byte.

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

The mock supplies the default `content-type` for body types that have one, if the request does not set it. Platform `fetch` operates in the same way. The mock records this header, and you can match on it:

- `URLSearchParams` → `application/x-www-form-urlencoded;charset=UTF-8`
- `FormData` → `multipart/form-data; boundary=...` (the boundary is random, so match the prefix with `stringMatching()`, not the whole value)
- `Blob` / `File` → the blob's `type`, when set

An explicit `content-type` header on the request always has priority.

## Header matching

The `headers` option uses containing semantics. The mock compares only the headers that you list, and it ignores the other request headers. It compares header names without case sensitivity. Values can be exact strings or [value matchers](#value-matchers). The full constraint can also be one asymmetric matcher:

```ts
import {objectContaining, stringMatching} from 'get-it/mock'

mock.on('POST', '/x', {headers: {'Content-Type': 'text/plain'}}).respond({status: 200})

mock.on('POST', '/x', {headers: {authorization: stringMatching(/^Bearer /)}}).respond({status: 200})

mock
  .on('POST', '/x', {headers: objectContaining({'content-type': stringMatching(/^text\//)})})
  .respond({status: 200})
```

## Value matchers

`get-it/mock` exports asymmetric matchers for loose matching. You can use them in each location that takes an expected value: `query`, `body`, `headers`, nested values, and the vitest matchers.

- `objectContaining(subset)` - matches an object that contains a minimum of the given keys, with matching values. It ignores extra keys
- `arrayContaining(items)` - matches an array that contains at least the given items, in any order
- `stringMatching(pattern)` - matches a string against a regex. If you give it a string, it matches a substring
- `anyValue()` - matches any value except `null`/`undefined` (same semantics as vitest's `expect.anything()`)
- `queryContaining(subset)` - like `objectContaining`, but for query-shaped records. It converts expected numbers and booleans to strings. An expected array matches a parameter that has each entry
- `bodyBytes(bytes)` - matches a recorded binary body (`Uint8Array`) against exact bytes. It accepts a `Uint8Array` or an `ArrayBuffer`

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

The matchers use the `asymmetricMatch` protocol of vitest and Jest. Thus `expect.objectContaining()`, `expect.stringContaining()`, and the related vitest matchers work in the same locations.

## One-shot vs persistent mocks

Responses from `.respond()` and `.respondWithError()` are one-shot. Exactly one matching request consumes each response, in registration order. When the queue of a handler is empty, the handler no longer matches. The mock then tries the later handlers. If no handler matches, the mock throws a `MockFetchError`.

`.respondPersist()` and `.respondWithErrorPersist()` register persistent responses that serve any number of requests:

```ts
mock.on('GET', '/api/config').respondPersist({status: 200, body: {feature: true}})
```

- A persistent response never counts as unconsumed for `assertAllConsumed()`.
- The mock uses responses in queue order. A persistent response never becomes empty. Thus you cannot reach a response that you queue after it on the same handler.

`mock.clear()` removes all handlers and all recorded requests. It resets the instance.

## Scoped mocks

When the code under test uses more than one host, `mock.scope(baseUrl)` gives a view of the mock for one origin:

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
- `scope.assertAllConsumed()` applies only to handlers that you register through that scope.
- `scope()` requires a full URL with origin and throws on a relative path.
- If you register a full URL through a scope, the mock uses the origin of that URL, not the origin of the scope.

You can mix scopes and plain registration. A handler on the root mock with a plain path matches any origin.

## Request recording

The mock records every request through `mock.fetch`, and it also records the requests that do not match. It records the requests that rejected with `respondWithError`. `mock.getRequests()` returns a new array of `RecordedRequest` objects, in call order:

- `method` - the HTTP method (`'GET'`, `'POST'`, ...)
- `url` - the path portion, without origin or query string (`'/api/docs'`)
- `fullUrl` - the complete URL as passed to fetch
- `query` - query parameters parsed into a `Record<string, string>`
- `headers` - a `Headers` instance, with any synthesized `content-type`
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

`streamBody(...parts)` declares a response body that the mock sends in chunks. The body can have pauses, a permanent stall, or an error during the download. Pass the result as `body` in a response definition:

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

- the mock encodes a string chunk as UTF-8. It sends a `Uint8Array` chunk as bytes
- `streamDelay(ms)` pauses before the next part. You can use it at any position in the script
- `streamStall()` never closes the body. The stream ends only when the consumer cancels it, or when the abort signal of the request fires
- `streamError(error)` errors the body stream with the given error

`streamStall()` and `streamError()` are terminal: they must be the last part. The mock validates the script immediately, so an invalid script throws a `TypeError` from `streamBody()`.

Streaming bodies operate with the other parts of the response definition:

- `delay` on the response definition still controls the time to the headers. The script controls the body after the headers.
- The mock builds a new stream from the script for each use. Thus a `streamBody` works with `respondPersist`.
- If the request signal aborts, the body errors with the abort reason. Real fetch operates in the same way.
- Buffered reads (no `as` option, or `text()` and `arrayBuffer()`) drain the script with the same timing. Thus you can test the total deadline without `as: 'stream'`.

### The StreamBody handle

The return value of `streamBody()` is also an observability handle. It counts the consumer cancellations of each stream from the script:

- `cancelCount` - number of times a consumer cancelled a stream produced from this script
- `lastCancelReason` - the reason passed to the most recent cancel, if any

```ts
const stalled = streamBody('partial', streamStall())
mock.on('GET', '/stuck').respond({body: stalled})

// ...code under test times out reading the body and cancels it...

expect(stalled.cancelCount).toBe(1)
expect(stalled).toHaveBeenCancelled() // matcher from 'get-it/vitest'
```

The mock tracks cancellation and abort separately. A cancellation occurs when the consumer calls `cancel()` on the stream. An abort occurs when the request signal fires. An abort errors the stream, but it does not increment `cancelCount`.

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

The mock scores each handler on the number of dimensions that match (origin, method, URL, query, body, headers). The handler with the best score is the closest mock. Diffs are structural when possible. A nested object body gives one entry for each path, such as `body.attributes.title: expected "a", received "b"`. A binary body shows a byte length (`Uint8Array(3 bytes)`).

The error instance also has `method`, `url`, `query`, and `body` fields for inspection in code. Its `name` is `'MockFetchError'`. `get-it/mock` exports the class for `instanceof` tests.

## Vitest matchers

`get-it/vitest` registers custom matchers on the `expect` of vitest. It also adds the vitest types. One side-effect import does both.

### Registration

Import it in a setup file:

```ts
// test/setup.ts
import 'get-it/vitest'
```

Then point vitest at the setup file:

```ts
// vitest.config.ts
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
  },
})
```

The import calls `expect.extend()` with the matchers. It also includes a `declare module 'vitest'` augmentation. TypeScript then knows the matchers, if the setup file is part of your TypeScript project. For one test file, you can also import `'get-it/vitest'` at the top of that file. All matchers support negation with `.not`.

### Matchers on the mock instance

`toHaveReceivedRequest(method, url, options?)` - asserts that the mock recorded a matching request. The `url` accepts an exact path, a glob pattern, or a full URL (a full URL also constrains the origin). It can include a query string. `options` accepts `query` and `body` constraints, and it accepts value matchers. The failure message lists all recorded requests.

```ts
expect(mock).toHaveReceivedRequest('POST', '/api/docs', {
  body: objectContaining({_type: 'post'}),
})
expect(mock).toHaveReceivedRequest('GET', '/api/docs?limit=10')
```

`toHaveReceivedRequestTimes(method, url, times)` - asserts an exact number of matching requests. It accepts the same `url` forms. A query string in the `url` constrains the count.

```ts
expect(mock).toHaveReceivedRequestTimes('GET', '/api/docs', 2)
expect(mock).toHaveReceivedRequestTimes('DELETE', '/api/docs/*', 0)
```

`toHaveConsumedAllMocks()` - asserts that the code used every registered one-shot response. This matcher is the assertion form of `mock.assertAllConsumed()`. On a failure, the message lists the unconsumed handlers.

```ts
expect(mock).toHaveConsumedAllMocks()
```

### Matchers on recorded requests

These matchers operate on one `RecordedRequest` from `mock.getRequests()`:

`toHaveHeader(name, value?)` - asserts that a header matches. The name is not case-sensitive (standard `Headers` semantics). The name can be a string or an asymmetric matcher. The value can also be a string or an asymmetric matcher. To assert presence only, omit the value. To assert absence, use `.not`.

```ts
const [req] = mock.getRequests()
expect(req).toHaveHeader('authorization', 'Bearer token123')
expect(req).toHaveHeader('content-type', stringMatching(/json/))
expect(req).toHaveHeader('authorization') // presence only, any value
expect(req).not.toHaveHeader('x-legacy-auth') // absence
expect(req).toHaveHeader(stringMatching(/^x-sanity-/), 'yes') // matcher for the name
```

`toHaveBody(expected)` - asserts that the normalized request body matches. The match is a strict deep equality, unless you use value matchers.

```ts
expect(req).toHaveBody({title: 'Hello'})
expect(req).toHaveBody(objectContaining({title: 'Hello'}))
```

`toHaveQuery(expected)` - asserts that the parsed query parameters match. The match is strict: all keys must be present and equal (the values are strings). For partial matching, use `queryContaining()`.

```ts
expect(req).toHaveQuery({limit: '10', offset: '0'})
expect(req).toHaveQuery(queryContaining({limit: 10}))
```

`toHaveMethod(expected)` - asserts that the HTTP method matches.

```ts
expect(req).toHaveMethod('POST')
```

`toHaveUrl(expected)` - asserts the request path with an exact string comparison. The `url` field holds the path only, with no origin and no query string.

```ts
expect(req).toHaveUrl('/api/docs')
```

### Matchers on stream bodies

`toHaveBeenCancelled()` - asserts that a consumer cancelled a `streamBody()` handle one or more times. The failure message for `.not` gives the cancel count and the last cancel reason.

```ts
const stalled = streamBody('partial', streamStall())
mock.on('GET', '/stuck').respond({body: stalled})

// ...consumer cancels the body, e.g. its read timeout fired...

expect(stalled).toHaveBeenCancelled()
```
