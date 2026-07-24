---
'get-it': minor
---

Header presence/absence assertions and name matchers for `toHaveHeader`, stricter `anyValue()`

- `toHaveHeader(name, value)` no longer matches when the header is missing, regardless of the value matcher. Previously a missing header (`null`) was fed into the value matcher, so `toHaveHeader('x-foo', anyValue())` passed even when the header was absent.
- The `value` argument is now optional: `expect(req).toHaveHeader('x-foo')` asserts the header is present with any value, and `expect(req).not.toHaveHeader('x-foo')` asserts absence.
- The `name` argument now accepts an asymmetric matcher (get-it's or vitest's), tested against lowercased header names: `toHaveHeader(stringMatching(/^x-sanity-/), 'yes')` matches any header whose name and value both match, and `toHaveHeader(anyValue(), 'abc123')` matches any header with that value.
- `anyValue()` now matches any value except `null` and `undefined`, mirroring vitest's `expect.anything()`. Tests that used `anyValue()` to match a `null` or `undefined` body or query value need to assert that explicitly instead.
