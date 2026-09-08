---
'get-it': patch
---

fall back to a small `AbortSignal.any()` ponyfill on Safari 17.0–17.3, which has no `AbortSignal.any()`, so requests with both a timeout and a caller `signal` no longer throw there; the ponyfill is exported as `get-it/any-signal`
