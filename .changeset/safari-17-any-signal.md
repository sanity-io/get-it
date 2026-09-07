---
'get-it': patch
---

combine the timeout signal and a caller's `signal` through `any-signal` instead of `AbortSignal.any()`, so request cancellation works on Safari 17.0–17.3, which have no `AbortSignal.any()`
