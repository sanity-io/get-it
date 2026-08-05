# Contributing to get-it

Thank you for your interest in get-it. We welcome bug reports, bug fixes, documentation, and new features.

## Dependencies and bundle size

get-it runs in browsers and in edge runtimes, so the size of the bundle is important. Two rules follow from this:

- **Do not add a new dependency unless there is no other option.** get-it has one runtime dependency: `undici`, for proxy support in Node.js and Bun. In most cases, the code belongs in this repository and not in a new package.
- **Keep the bundle small.** If a change adds bytes, give the number in the pull request.

To measure the browser entry point, run `pnpm report-size`. It gives the raw size and the gzip size.

If your change needs a new dependency, give the reason in the pull request. For a large change, open an issue first. We can then agree on the approach before you write the code.

## Development

You need Node.js 22.12 or later, and pnpm.

```bash
pnpm install
pnpm test  # unit tests
pnpm check # format, lint, knip, and typecheck
```

`pnpm test:all` runs the tests in every supported runtime: Node.js, Bun, Deno, workerd, Vercel Edge, React Server Components, and happy-dom. CI runs these tests on each pull request, so you do not have to run them all locally.

Before you write code, read the two sections below. They hold the rules for TypeScript and for tests.

## TypeScript: no type assertions

**Never use a type assertion (`as`, `<Type>`, `as any`, `as unknown as X`).** There is no acceptable use in this repository, in production code or in tests.

When a type does not match, one of these is true:

1. The upstream type is wrong. Correct it at the source.
2. You must narrow the type. Use `typeof`, `instanceof`, `in`, a discriminated union, or a type guard.
3. You need a user-defined type guard. Write an `is` predicate function.

```ts
// WRONG: all of these
const value = response as MyType
const data = result as any
const headers = obj as Record<string, string>
const parsed = JSON.parse(raw) as Config

// RIGHT: narrow instead
function isMyType(value: unknown): value is MyType {
  return typeof value === 'object' && value !== null && 'key' in value
}

if (isMyType(response)) {
  // response is MyType here
}
```

If `JSON.parse` returns `unknown` and you need a specific shape, write a type guard for that shape. If a library returns `any`, wrap it with a type guard at the boundary. Use no shortcuts.

## Testing: real code, not mocks

Exercise the real implementation. If you must reach internal behavior, export the function. Do not mock it.

### Module structure

- `index.ts` exports the public API. This is what consumers import.
- You can export an internal helper function from its own module file, if a test needs it directly. You **must** mark that function `@internal` in the JSDoc.
- A test imports the internal function directly and gives it real inputs.

```ts
// src/resolve.ts
/**
 * Resolves a potentially relative URL against a base.
 * @internal
 */
export function resolveUrl(base: string, url: string): string {
  // ...
}

// src/index.ts: public API only
export {createRequester} from './createRequester'
export type {RequestOptions, BufferedResponse} from './types'
// resolveUrl is NOT re-exported here
```

### What "no mocks" means

- **Do not mock a module.** Do not use `vi.mock()` or `jest.mock()`.
- **Do not mock a function on an object.** Do not use `vi.spyOn(obj, 'method').mockImplementation(...)`.
- **Use the injectable `fetch` option.** This option is the designed-in seam. A fake `fetch` in `createRequester({fetch: fakeFetch})` is not a mock. It is the intended use of the API.
- **Use the real HTTP server in the test suite.** Prefer a real HTTP request to an interception of fetch.
- **Exercise small units directly.** If a function needs a test, export it and mark it `@internal`.

```ts
// WRONG
vi.mock('../src/resolve', () => ({
  resolveUrl: vi.fn().mockReturnValue('http://example.com/foo'),
}))

// RIGHT: exercise the real function
import {resolveUrl} from '../src/resolve'
expect(resolveUrl('http://example.com', '/foo')).toBe('http://example.com/foo')
```

### When a fake is acceptable

- A `fetch` function that you give to `createRequester()`. This is dependency injection, not a mock.
- A `log` function that you give to the `debug()` middleware. This is also a designed-in option.
- Fake timers (`vi.useFakeTimers()`) for timeout and delay behavior. Prefer a real short delay when that is practical.

## Pull requests and changesets

get-it uses [changesets](https://github.com/changesets/changesets) for the version numbers and the changelog. In most cases you do not write a changeset. A bot writes one from the title of your pull request.

Give the pull request a conventional-commit title. A CI check enforces this format. The title sets the version bump:

- `feat:` gives a minor release
- `fix:`, `perf:`, or `revert:` gives a patch release
- `feat!:`, or a `BREAKING CHANGE:` line in the body, gives a major release
- All other types (`docs:`, `chore:`, `test:`, `build:`, `ci:`, `refactor:`, `style:`) give no release

The bot writes a changeset only when the pull request changes a file that affects the published package: `src/`, `package.json`, `tsdown.config.ts`, or `tsconfig.dist.json`. A change to the tests or to the documentation does not start a release.

To write your own release note, run `pnpm changeset` and commit the file. The bot then makes no changes to your pull request. You can also edit the changeset that the bot wrote. If you do this, delete the `<!-- auto-generated -->` line at the top of the file. The bot then keeps your text.

## Release

This section is for maintainers.

A merge to `main` starts the Release workflow. The workflow collects the changesets and opens a pull request with the title "chore: version packages". This pull request holds the new version number and the new changelog entries.

To publish, merge that pull request. The workflow then publishes the package to npm.
