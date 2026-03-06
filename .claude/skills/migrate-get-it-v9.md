# Migrate get-it v8 to v9

Systematic migration of a codebase from get-it v8 to v9. Work through each step in order, searching the codebase for patterns and transforming them.

Reference: `docs/MIGRATION-v9.md` in the get-it repo for full details.

## Step 1: Update the package

```bash
npm install get-it@^9
```

Remove any get-it-related packages that are no longer needed (there are none — get-it was always a single package).

## Step 2: Find and update imports

Search for all get-it imports:

```
grep -r "from 'get-it'" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs'
grep -r "require('get-it')" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.cjs'
```

### Main import

```ts
// v8
import getIt from 'get-it'
// or
const getIt = require('get-it')

// v9
import {createRequest} from 'get-it'
```

Note: `getIt` was a default export. `createRequest` is a named export.

### Middleware imports

```ts
// v8
import {
  promise,
  base,
  headers,
  jsonRequest,
  jsonResponse,
  httpErrors,
  retry,
  debug,
  observable,
  progress,
  keepAlive,
  agent,
} from 'get-it/middleware'

// v9 — only these middleware still exist:
import {retry, debug} from 'get-it/middleware'
// Everything else is built into createRequest() or removed
```

### Node helpers

```ts
// v8 — no equivalent
// v9
import {nodeFetch} from 'get-it/node'
```

## Step 3: Transform instance creation

Search for `getIt(` calls and transform them:

```ts
// v8
const request = getIt([
  base('https://api.example.com'),
  headers({Authorization: 'Bearer ...'}),
  jsonRequest(),
  jsonResponse(),
  httpErrors(),
  retry({maxRetries: 3}),
  promise(),
])

// v9
const request = createRequest({
  base: 'https://api.example.com',
  headers: {Authorization: 'Bearer ...'},
  middleware: [retry({maxRetries: 3})],
})
```

Mapping of v8 middleware to v9 createRequest options:

- `base(url)` → `{ base: url }`
- `headers(obj)` → `{ headers: obj }`
- `httpErrors()` → built-in, on by default. Use `{ httpErrors: false }` to opt out.
- `promise()` → not needed, promises are the default
- `jsonRequest()` → not needed, auto-serializes objects
- `jsonResponse()` → not needed, use `as: 'json'` or `res.json()`
- `retry(opts)` → keep as `middleware: [retry(opts)]`
- `debug(opts)` → keep as `middleware: [debug(opts)]`
- `urlEncoded()` → remove, pass `new URLSearchParams(...)` as body instead
- `observable()` → remove, wrap promise with `from()` in consumer
- `progress()` → remove entirely, no replacement
- `keepAlive()` → remove, built into fetch
- `agent(opts)` → use `{ fetch: nodeFetch(opts) }` or remove if default proxy behavior is sufficient

## Step 4: Transform CancelToken to AbortController

Search for `CancelToken` and `cancelToken`:

```ts
// v8
import {promise} from 'get-it/middleware'
const source = promise.CancelToken.source()
request({url: '/api', cancelToken: source.token})
source.cancel('reason')

// v9
const controller = new AbortController()
request({url: '/api', signal: controller.signal})
controller.abort()
```

Also search for `Cancel` and `isCancel`:

```ts
// v8
import { promise } from 'get-it/middleware'
if (promise.isCancel(err)) { ... }

// v9
if (err instanceof DOMException && err.name === 'AbortError') { ... }
```

## Step 5: Transform response access

Search for response property access patterns:

### Status code

```ts
// v8
response.statusCode
// v9
response.status
```

### Status message

```ts
// v8
response.statusMessage
// v9
response.statusText
```

### Headers

```ts
// v8
response.headers['content-type']
// v9
response.headers.get('content-type')
```

### Body

```ts
// v8 (with jsonResponse middleware)
response.body // already parsed

// v9 — choose one:
response.json() // parse as JSON (synchronous)
response.text() // decode as string (synchronous)
response.body // raw Uint8Array

// Or use `as` option:
const res = await request({url, as: 'json'})
res.body // parsed JSON
```

## Step 6: Transform stream and rawBody options

```ts
// v8
request({url, stream: true})
// v9
request({url, as: 'stream'})

// v8
request({url, rawBody: true})
// v9 — this is now the default behavior
request({url}) // body is Uint8Array
```

## Step 7: Transform custom middleware

If the codebase has custom v8 middleware using the hook system (`processOptions`, `onReturn`, `onResponse`, `onRequest`, etc.), these need rewriting.

### Simple request/response transforms

```ts
// v8
const myMiddleware = {
  processOptions: (options) => ({...options, headers: {...options.headers, 'X-Custom': 'value'}}),
  onResponse: (response) => ({...response, body: transform(response.body)}),
}

// v9 — TransformMiddleware
const myMiddleware: TransformMiddleware = {
  beforeRequest: (options) => ({
    ...options,
    headers: new Headers({
      ...Object.fromEntries(new Headers(options.headers)),
      'X-Custom': 'value',
    }),
  }),
  afterResponse: (response) => response, // modify as needed
}
```

### Wrapping middleware (retry, error recovery)

```ts
// v9 — WrappingMiddleware (a function, not an object)
const myWrapper: WrappingMiddleware = async (options, next) => {
  try {
    return await next(options)
  } catch (err) {
    // handle error, retry, etc.
    throw err
  }
}
```

## Step 8: Remove .use() chaining

```ts
// v8
const request = getIt([promise()])
request.use(retry())
request.use(debug())

// v9 — pass all middleware at creation time
const request = createRequest({
  middleware: [retry(), debug()],
})
```

There is no `.use()` method in v9.

## Step 9: Update proxy configuration

If the codebase explicitly configures proxies:

```ts
// v8
import {proxy} from 'get-it/middleware'
const request = getIt([proxy({host: 'proxy', port: 8080}), promise()])

// v9 — automatic in Node (reads HTTP_PROXY env var)
// For explicit proxy:
import {nodeFetch} from 'get-it/node'
const request = createRequest({
  fetch: nodeFetch({proxy: 'http://proxy:8080'}),
})
```

## Step 10: Verify

After completing all transformations:

1. Run the TypeScript compiler: `npx tsc --noEmit`
2. Run the test suite
3. Manually test key workflows

Common issues to check:

- Response body access patterns (`.body` vs `.json()` vs `.text()`)
- Header access (bracket notation vs `.get()`)
- Status code property name (`statusCode` vs `status`)
- CancelToken remnants
- Observable usage that needs wrapping with `from()`
