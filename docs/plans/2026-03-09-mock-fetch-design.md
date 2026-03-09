# Mock Fetch API Design

## Problem

Downstream libraries like `@sanity/client` use get-it for HTTP requests. Their tests need to mock requests, but currently this requires manually building fake `fetch` functions with no helpers for constructing responses, matching requests, or making assertions.

## Solution

Two new package exports:

- `get-it/mock` — framework-agnostic mock fetch factory with request matching, recording, and diff-based error messages.
- `get-it/vitest` — custom vitest matchers for ergonomic assertions.

## Core API: `get-it/mock`

### `createMockFetch()`

Returns a `MockFetch` object:

- `mock.fetch` — a `FetchFunction` to inject into `createRequester({fetch: mock.fetch})`
- `mock.on(method, url, options?)` — register a handler, returns a chainable `MockHandler`
- `mock.onAny(url, options?)` — matches any HTTP method
- `mock.clear()` — remove all handlers and recorded requests
- `mock.assertAllConsumed()` — throws if any registered responses were never used
- `mock.requests` — array of all `RecordedRequest` objects

### Handler registration

```ts
// Exact URL
mock.on('GET', '/api/docs')
  .respond({status: 200, body: {results: []}})

// With query params (order-independent, strict by default)
mock.on('GET', '/api/docs', {query: {limit: '10', type: 'post'}})
  .respond({status: 200, body: {results: []}})

// With body matching (strict deep-equal by default)
mock.on('POST', '/api/docs', {body: {_type: 'post', title: 'Hello'}})
  .respond({status: 201, body: {id: 'abc'}})

// Glob pattern
mock.on('GET', '/api/docs/*/revisions')
  .respond({status: 200, body: []})

// Function predicate
mock.on('GET', (url) => url.startsWith('/api/'))
  .respond({status: 200, body: 'ok'})
```

### Responses: one-shot by default

```ts
mock.on('GET', '/api/docs')
  .respond({status: 500, body: 'server error'})   // 1st call
  .respond({status: 200, body: {results: []}})     // 2nd call
  // 3rd call -> error: no more responses

// Persistent handler for repeated calls
mock.on('GET', '/api/health')
  .respondPersist({status: 200, body: 'ok'})
```

### Response shape

```ts
mock.on('GET', '/api/docs').respond({
  status: 200,                          // required
  body: {results: []},                  // optional, POJO = JSON (auto-serialized, sets content-type)
  headers: {'x-custom': 'value'},       // optional
  statusText: 'OK',                     // optional, defaults based on status
})
```

POJO bodies imply JSON for both matching (request) and responding:
- In `.respond()`: object is JSON-serialized, `content-type: application/json` set automatically.
- In `.on()` matcher: incoming request body is deserialized as JSON before deep-comparing. Non-JSON content-type fails the match.
- For non-JSON, pass a `string` or `Uint8Array`.

## Loose matching

Matchers implement the `asymmetricMatch(value): boolean` protocol, making them compatible with vitest/Jest asymmetric matchers out of the box.

```ts
import {objectContaining, arrayContaining, stringMatching, anyValue} from 'get-it/mock'

// Subset match on body (extra fields ignored)
mock.on('POST', '/api/docs', {
  body: objectContaining({_type: 'post'})
}).respond({status: 201, body: {id: 'abc'}})

// Flexible values
mock.on('POST', '/api/docs', {
  body: {_type: 'post', createdAt: anyValue()}
}).respond({status: 201, body: {id: 'abc'}})

// String pattern
mock.on('POST', '/api/docs', {
  body: objectContaining({title: stringMatching(/^Hello/)})
}).respond({status: 201, body: {id: 'abc'}})

// Array subset
mock.on('POST', '/api/docs', {
  body: objectContaining({tags: arrayContaining(['featured'])})
}).respond({status: 201, body: {id: 'abc'}})

// Works on query params too
mock.on('GET', '/api/docs', {
  query: objectContaining({limit: '10'})
}).respond({status: 200, body: []})
```

Vitest matchers also work directly since they share the protocol:

```ts
mock.on('POST', '/api/docs', {
  body: expect.objectContaining({title: expect.stringContaining('hello')})
}).respond(...)
```

## Unmatched request errors

When no mock matches, throws `MockFetchError` with:

1. What was requested
2. The closest registered mock (scored by method, path, query, body match)
3. A field-level diff showing exactly what didn't match
4. A list of all registered mocks with their remaining response counts

```
MockFetchError: No mock matched POST /api/documents?limit=10

  Closest mock:
    POST /api/documents?limit=20

  Differences:
    query.limit: expected "20", received "10"

  All registered mocks:
    1. GET /api/health (1 response remaining)
    2. POST /api/documents?limit=20 (1 response remaining)
```

Exhausted mocks (all responses consumed) are also flagged, since "already used" is a common cause.

## Request recording

Every request through `mock.fetch` is recorded:

```ts
interface RecordedRequest {
  url: string                           // path without query string
  fullUrl: string                       // original URL including query string
  method: string
  headers: Headers
  query: Record<string, string>         // parsed from URL
  body: unknown                         // parsed JSON if content-type is json, raw string otherwise
}
```

Accessible via `mock.requests` for manual inspection.

## Vitest matchers: `get-it/vitest`

```ts
// test/setup.ts (or vitest.config setupFiles)
import 'get-it/vitest'
```

### On the mock object

```ts
expect(mock).toHaveReceivedRequest('POST', '/api/docs', {
  body: objectContaining({_type: 'post'}),
  query: {limit: '10'},
})
expect(mock).toHaveReceivedRequestTimes('GET', '/api/docs', 3)
expect(mock).not.toHaveReceivedRequest('DELETE', '/api/docs')
expect(mock).toHaveConsumedAllMocks()
```

### On individual recorded requests

```ts
const req = mock.requests[0]

expect(req).toHaveHeader('authorization', 'Bearer token123')
expect(req).toHaveHeader('content-type', expect.stringContaining('json'))
expect(req).toHaveBody(objectContaining({_type: 'post'}))
expect(req).toHaveQuery({limit: '10', offset: '0'})
expect(req).toHaveMethod('POST')
expect(req).toHaveUrl('/api/docs')
```

Matchers produce clear diffs on failure showing what was expected vs what was received, with closest-match highlighting when multiple requests exist.

## Lifecycle

No global state. Each test creates its own mock:

```ts
let mock: MockFetch

beforeEach(() => {
  mock = createMockFetch()
})

afterEach(() => {
  mock.assertAllConsumed()
})
```

For downstream libs:

```ts
const mock = createMockFetch()
const client = createClient({
  projectId: 'test',
  dataset: 'test',
  fetch: mock.fetch,  // passed through to createRequester
})
```

## Non-goals

- No global fetch patching (use MSW if you need that)
- No `createNodeFetch` integration (mock replaces fetch entirely; proxy/agent config is an integration test concern)
- No built-in fake timers or delay simulation (use vitest's fake timers)
