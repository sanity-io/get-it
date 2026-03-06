# Modernization of get-it

## Current get-it

This is our shared request library that we use for things like `@sanity/client`, the CLI tool and a bunch of backend apps. It _has_ some benefits over using straight `fetch`:

- Configurable, automatic retrying
- Request debugging (based on the `debug` module)
- Base URL configuration
- Treat HTTP errors (4xx, 5xx) as request errors
- Default headers
- "Injection" of requests (this one could use work) for mocking
- JSON request: Automatic encoding of body as JSON
- JSON response: Automatic JSON parsing on `content-type: json`
- Keep-alive (node.js)
- Proxy support (explicit and automatic through env vars)
- mtls (cert/key/ca attachment)
- Support for observables
- x-www-form-urlencoded support (automatic body encoding)
- (Best effort) progress tracking (upload and download)
- Custom "middleware" for hooking into and altering the behavior
- Works in (old) browsers, node.js, deno, bun, edge workers… most JS environments.

Things I don't _know_ if fetch in node automatically does:

- Automatically requesting compressed responses, automatic decompression?
- More?

The nice part is that a majority of this functionality is "injectable" through middleware, in a way that was at least _supposed_ to not bloat the bundle size for browsers.

## The problems

- Codebase is old javascript code half-way ported to typescript. Lots of "any" and casts etc.
- We can probably replace a _vast_ amount of the node.js code by just using `fetch`
- Request cancellation uses an old promise proposal, not the modern AbortController
- The middleware implementation means stack traces are hard to read/reason about.
- The bundle size is larger than we want it to be

## The proposal

- A new version where we accept breaking changes
- `fetch()` as underlying requester in both browsers and other environments
- Some same _idea_ of middlewares, without losing the stack trace because of it
- Drop the request injection idea (at least for now)
- Fully written from scratch in typescript, with erasable syntax only
- ESM-only, no CommonJS
- Test suite that runs in real browsers, node.js, deno, bun, jsdom/happy-dom and other environments without redefining the test suite for every environment
- Injectable `fetch` method - define type for a subset of `fetch()` that we need for the module to function. See https://github.com/EventSource/eventsource/?tab=readme-ov-file#specify-fetch-implementation + https://github.com/EventSource/eventsource/blob/main/src/types.ts#L3-L43 for inspiration
- Same repo but let's start from "scratch"? Use existing source code for _inspiration_, not the solution
