## TypeScript: Type Safety is Non-Negotiable

**NEVER use type assertions (`as`, `<Type>`, `as any`, `as unknown as X`).** There are zero acceptable uses in this codebase — not in production code, not in tests, not "just this once."

When a type doesn't match, it means one of these:
1. The upstream type is wrong — fix it at the source.
2. You need to narrow — use `typeof`, `instanceof`, `in`, discriminated unions, or a type guard.
3. You need a user-defined type guard — write an `is` predicate function.

```ts
// WRONG — every single one of these
const value = response as MyType
const data = result as any
const headers = obj as Record<string, string>
const parsed = JSON.parse(raw) as Config

// RIGHT — narrow instead
function isMyType(value: unknown): value is MyType {
  return typeof value === 'object' && value !== null && 'key' in value
}

if (isMyType(response)) {
  // response is MyType here
}
```

If `JSON.parse` returns `unknown` and you need a specific shape, write a type guard that validates the shape. If a library returns `any`, wrap it with a guard at the boundary. No shortcuts.

## Testing: Real Code, Not Mocks

**Prefer testing real implementations over mocking.** If you need to test internal behavior, export the function — don't mock it.

### Module structure

- `index.ts` exports the public API — what consumers import.
- Internal helper functions that tests need to exercise directly CAN be exported from their own module files, but **MUST** be marked `@internal` in JSDoc.
- Tests import internal functions directly and test them with real inputs/outputs.

```ts
// src/resolve.ts
/**
 * Resolves a potentially relative URL against a base.
 * @internal
 */
export function resolveUrl(base: string, url: string): string {
  // ...
}

// src/index.ts — public API only
export { createRequest } from './request'
export type { RequestOptions, BufferedResponse } from './types'
// resolveUrl is NOT re-exported here
```

### What "no mocks" means in practice

- **Don't mock modules** — no `vi.mock()`, no `jest.mock()`.
- **Don't mock functions on objects** — no `vi.spyOn(obj, 'method').mockImplementation(...)`.
- **Do use the injectable `fetch` option** — this is the designed-in seam. Providing a fake `fetch` to `createRequest({ fetch: fakeFetch })` is not mocking, it's using the API as intended.
- **Do use the real test HTTP server** — it's there for a reason. Prefer real HTTP requests over intercepting fetch.
- **Do test small units directly** — if a function is worth testing, it's worth exporting (with `@internal`).

```ts
// WRONG
vi.mock('../src/resolve', () => ({
  resolveUrl: vi.fn().mockReturnValue('http://example.com/foo'),
}))

// RIGHT — test the real function
import { resolveUrl } from '../src/resolve'
expect(resolveUrl('http://example.com', '/foo')).toBe('http://example.com/foo')
```

### When faking is acceptable

- Providing a `fetch` function to `createRequest()` — that's dependency injection, not mocking.
- Providing a `log` function to `debug()` middleware — same idea, it's a designed-in option.
- Fake timers (`vi.useFakeTimers()`) for testing timeout/delay behavior — but prefer real short delays when practical.
