---
'get-it': minor
---

Add structured timeout support: `timeout` now also accepts `{total?, headers?}` alongside the existing `number | false` forms. `headers` limits time-to-response-headers per fetch attempt and throws the new exported `TimeoutError` (`code: 'ETIMEDOUT'`), which the default `retry()` middleware retries on GET/HEAD. Streaming callers can combine `{headers: 15_000, total: false}` with `retry()` instead of hand-rolling timeout middleware.
