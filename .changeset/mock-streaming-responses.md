---
'get-it': minor
---

`get-it/mock` can now stream response bodies: `streamBody()` declares chunked delivery with `streamDelay()` pauses, `streamStall()` for bodies that never complete, and `streamError()` for mid-download connection cuts. The handle records consumer cancellations (`cancelCount`, `lastCancelReason`), assertable via the new `toHaveBeenCancelled()` matcher in `get-it/vitest`. Aborting the request signal errors the body with the abort reason, matching real fetch behavior.
