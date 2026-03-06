# Migrate get-it v1 to v2

Systematic migration of a codebase from get-it v1 to v2. Work through each step in order, searching the codebase for patterns and transforming them.

Reference: `docs/MIGRATION-v2.md` in the get-it repo for full details.

## Step 1: Update the package

```bash
npm install get-it@2
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
// v1
import getIt from 'get-it'
// or
const getIt = require('get-it')

// v2
import { createRequest } from 'get-it'
```

Note: `getIt` was a default export. `createRequest` is a named export.

### Middleware imports

```ts
// v1
import { promise, base, headers, jsonRequest, jsonResponse, httpErrors, retry, debug, observable, progress, keepAlive, agent } from 'get-it/middleware'

// v2 — only these middleware still exist:
import { retry, debug, urlEncoded } from 'get-it/middleware'
// Everything else is built into createRequest() or removed
```

### Node helpers

```ts
// v1 — no equivalent
// v2
import { nodeFetch } from 'get-it/node'
```

## Step 3: Transform instance creation

Search for `getIt(` calls and transform them:

```ts
// v1
const request = getIt([
  base('https://api.example.com'),
  headers({ Authorization: 'Bearer ...' }),
  jsonRequest(),
  jsonResponse(),
  httpErrors(),
  retry({ maxRetries: 3 }),
  promise(),
])

// v2
const request = createRequest({
  base: 'https://api.example.com',
  headers: { Authorization: 'Bearer ...' },
  middleware: [retry({ maxRetries: 3 })],
})
```

Mapping of v1 middleware to v2 createRequest options:
- `base(url)` → `{ base: url }`
- `headers(obj)` → `{ headers: obj }`
- `httpErrors()` → built-in, on by default. Use `{ httpErrors: false }` to opt out.
- `promise()` → not needed, promises are the default
- `jsonRequest()` → not needed, auto-serializes objects
- `jsonResponse()` → not needed, use `as: 'json'` or `res.json()`
- `retry(opts)` → keep as `middleware: [retry(opts)]`
- `debug(opts)` → keep as `middleware: [debug(opts)]`
- `urlEncoded()` → keep as `middleware: [urlEncoded()]`
- `observable()` → remove, wrap promise with `from()` in consumer
- `progress()` → remove entirely, no replacement
- `keepAlive()` → remove, built into fetch
- `agent(opts)` → use `{ fetch: nodeFetch(opts) }` or remove if default proxy behavior is sufficient

## Step 4: Transform CancelToken to AbortController

Search for `CancelToken` and `cancelToken`:

```ts
// v1
import { promise } from 'get-it/middleware'
const source = promise.CancelToken.source()
request({ url: '/api', cancelToken: source.token })
source.cancel('reason')

// v2
const controller = new AbortController()
request({ url: '/api', signal: controller.signal })
controller.abort()
```

Also search for `Cancel` and `isCancel`:

```ts
// v1
import { promise } from 'get-it/middleware'
if (promise.isCancel(err)) { ... }

// v2
if (err instanceof DOMException && err.name === 'AbortError') { ... }
```

## Step 5: Transform response access

Search for response property access patterns:

### Status code

```ts
// v1
response.statusCode
// v2
response.status
```

### Status message

```ts
// v1
response.statusMessage
// v2
response.statusText
```

### Headers

```ts
// v1
response.headers['content-type']
// v2
response.headers.get('content-type')
```

### Body

```ts
// v1 (with jsonResponse middleware)
response.body  // already parsed

// v2 — choose one:
response.json()                           // parse as JSON (synchronous)
response.text()                           // decode as string (synchronous)
response.body                             // raw Uint8Array

// Or use `as` option:
const res = await request({ url, as: 'json' })
res.body  // parsed JSON
```

## Step 6: Transform stream and rawBody options

```ts
// v1
request({ url, stream: true })
// v2
request({ url, as: 'stream' })

// v1
request({ url, rawBody: true })
// v2 — this is now the default behavior
request({ url })  // body is Uint8Array
```

## Step 7: Transform custom middleware

If the codebase has custom v1 middleware using the hook system (`processOptions`, `onReturn`, `onResponse`, `onRequest`, etc.), these need rewriting.

### Simple request/response transforms

```ts
// v1
const myMiddleware = {
  processOptions: (options) => ({ ...options, headers: { ...options.headers, 'X-Custom': 'value' } }),
  onResponse: (response) => ({ ...response, body: transform(response.body) }),
}

// v2 — TransformMiddleware
const myMiddleware: TransformMiddleware = {
  beforeRequest: (options) => ({ ...options, headers: new Headers({ ...Object.fromEntries(new Headers(options.headers)), 'X-Custom': 'value' }) }),
  afterResponse: (response) => response, // modify as needed
}
```

### Wrapping middleware (retry, error recovery)

```ts
// v2 — WrappingMiddleware (a function, not an object)
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
// v1
const request = getIt([promise()])
request.use(retry())
request.use(debug())

// v2 — pass all middleware at creation time
const request = createRequest({
  middleware: [retry(), debug()],
})
```

There is no `.use()` method in v2.

## Step 9: Update proxy configuration

If the codebase explicitly configures proxies:

```ts
// v1
import { proxy } from 'get-it/middleware'
const request = getIt([proxy({ host: 'proxy', port: 8080 }), promise()])

// v2 — automatic in Node (reads HTTP_PROXY env var)
// For explicit proxy:
import { nodeFetch } from 'get-it/node'
const request = createRequest({
  fetch: nodeFetch({ proxy: 'http://proxy:8080' }),
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
