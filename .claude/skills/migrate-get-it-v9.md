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
import {createRequester} from 'get-it'
```

Note: `getIt` was a default export. `createRequester` is a named export.

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
// Everything else is built into createRequester() or removed
```

### Node helpers

```ts
// v8 — no equivalent
// v9
import {createNodeFetch} from 'get-it/node'
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
const request = createRequester({
  base: 'https://api.example.com',
  headers: {Authorization: 'Bearer ...'},
  middleware: [retry({maxRetries: 3})],
})
```

Mapping of v8 middleware to v9 createRequester options:

- `base(url)` → `{ base: url }`
- `headers(obj)` → `{ headers: obj }`
- `httpErrors()` → built-in, on by default. Use `{ httpErrors: false }` to opt out.
- `promise()` → not needed, promises are the default
- `jsonRequest()` → not needed, auto-serializes objects
- `jsonResponse()` → not needed, use `as: 'json'` or `res.json()`
- `retry(opts)` → keep as `middleware: [retry(opts)]`
- `debug(opts)` → keep as `middleware: [debug(opts)]` — note: now requires explicit `log` function
- `urlEncoded()` → remove, pass `new URLSearchParams(...)` as body instead
- `observable()` → remove, wrap promise with `from()` in consumer
- `progress()` → remove entirely, no replacement
- `keepAlive()` → remove, built into fetch
- `agent(opts)` → use `{ fetch: createNodeFetch(opts) }` or remove if default proxy behavior is sufficient

## Step 4: Transform removed request options

Search for these v8 request options and transform them:

```ts
// v8: withCredentials
request({url, withCredentials: true})
// v9: credentials
request({url, credentials: 'include'})

// v8: bodySize
request({url, bodySize: 1024})
// v9: set content-length header
request({url, headers: {'content-length': '1024'}})

// v8: requestId (used by debug middleware)
request({url, requestId: 'abc-123'})
// v9: use meta
request({url, meta: {requestId: 'abc-123'}})

// v8: compress (default true)
request({url, compress: false})
// v9: removed — fetch handles content negotiation automatically

// v8: onlyBody via promise({onlyBody: true})
const body = await request({url})
// v9: removed — access body from the response
const res = await request({url, as: 'json'})
const body = res.body
```

## Step 5: Transform CancelToken to AbortController

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

## Step 6: Transform response access

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

## Step 7: Transform stream and rawBody options

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

## Step 8: Transform custom middleware

If the codebase has custom v8 middleware using the hook system (`processOptions`, `onReturn`, `onResponse`, `onRequest`, etc.), these need rewriting.

### Simple request/response transforms

```ts
// v8
const myMiddleware = {
  processOptions: (options) => ({...options, headers: {...options.headers, 'X-Custom': 'value'}}),
  onResponse: (response) => ({...response, body: transform(response.body)}),
}

// v9 — TransformMiddleware
// Note: headers are already Record<string, string> with lowercase keys, so spreading works naturally
const myMiddleware: TransformMiddleware = {
  beforeRequest: (options) => ({
    ...options,
    headers: {...options.headers, 'x-custom': 'value'},
  }),
  afterResponse: (response) => response, // modify as needed
}
```

Use **lowercase header names** in middleware — all keys are normalized to lowercase.

### Custom per-request data

v8 allowed arbitrary properties on the request options object. v9 uses the typed `meta` field:

```ts
// v8
request({url, myCustomProp: 'value'})
// in middleware: options.myCustomProp

// v9
request({url, meta: {myCustomProp: 'value'}})
// in middleware: options.meta?.myCustomProp
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

## Step 9: Remove .use() and .clone() chaining

```ts
// v8
const request = getIt([promise()])
request.use(retry())
request.use(debug())

// v9 — pass all middleware at creation time
const request = createRequester({
  middleware: [retry(), debug()],
})
```

There is no `.use()` method in v9.

```ts
// v8 — clone
const base = getIt([base('https://api.example.com'), promise()])
const withAuth = base.clone().use(headers({Authorization: 'Bearer ...'}))

// v9 — spread shared config
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

## Step 10: Update proxy configuration

If the codebase explicitly configures proxies:

```ts
// v8
import {proxy} from 'get-it/middleware'
const request = getIt([proxy({host: 'proxy', port: 8080}), promise()])

// v9 — automatic in Node (reads HTTP_PROXY env var)
// For explicit proxy:
import {createNodeFetch} from 'get-it/node'
const request = createRequester({
  fetch: createNodeFetch({proxy: 'http://proxy:8080'}),
})
```

## Step 11: Update debug middleware usage

```ts
// v8 — zero config, controlled via DEBUG env var
const request = getIt([debug(), promise()])
// $ DEBUG=get-it:* node app.js

// v9 — requires explicit log function
import {debug} from 'get-it/middleware'
const request = createRequester({
  middleware: [debug({log: console.log, verbose: true})],
})

// To restore DEBUG env var behavior:
import createDebug from 'debug'
const request = createRequester({
  middleware: [debug({log: createDebug('get-it'), verbose: true})],
})
```

## Step 12: Verify

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
- Custom request properties that need moving to `meta`
- `withCredentials` → `credentials`
- `requestId` → `meta.requestId`
