# Mock Fetch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `get-it/mock` and `get-it/vitest` exports that provide a mock fetch factory with request matching, recording, diff-based errors, and vitest custom matchers.

**Architecture:** A `createMockFetch()` factory returns a `FetchFunction` that acts as a request router. Handlers are registered with `.on()`, matched strictly by default (method, URL path, query params, body), with escape hatches via `objectContaining`/`anyValue`/`stringMatching`/`arrayContaining`. Matchers use the `asymmetricMatch` protocol for vitest compatibility. Unmatched requests throw with a diff against the closest mock. A separate `get-it/vitest` export adds custom matchers to vitest's `expect`.

**Tech Stack:** TypeScript, vitest, no external dependencies.

---

### Task 1: Asymmetric matchers

The matching primitives are the foundation everything else builds on. They implement the `asymmetricMatch(value): boolean` protocol so they work both standalone and as vitest asymmetric matchers.

**Files:**
- Create: `src/mock/matchers.ts`
- Test: `test/mock/matchers.test.ts`

**Step 1: Write the failing tests**

Create `test/mock/matchers.test.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {anyValue, arrayContaining, objectContaining, stringMatching} from '../../src/mock/matchers'

describe('anyValue', () => {
  it('matches any value', () => {
    const matcher = anyValue()
    expect(matcher.asymmetricMatch('hello')).toBe(true)
    expect(matcher.asymmetricMatch(42)).toBe(true)
    expect(matcher.asymmetricMatch(null)).toBe(true)
    expect(matcher.asymmetricMatch(undefined)).toBe(true)
    expect(matcher.asymmetricMatch({a: 1})).toBe(true)
  })
})

describe('objectContaining', () => {
  it('matches when all expected keys are present with equal values', () => {
    const matcher = objectContaining({a: 1, b: 'hello'})
    expect(matcher.asymmetricMatch({a: 1, b: 'hello', c: true})).toBe(true)
  })

  it('does not match when a key is missing', () => {
    const matcher = objectContaining({a: 1, b: 'hello'})
    expect(matcher.asymmetricMatch({a: 1})).toBe(false)
  })

  it('does not match when a value differs', () => {
    const matcher = objectContaining({a: 1})
    expect(matcher.asymmetricMatch({a: 2})).toBe(false)
  })

  it('does not match non-objects', () => {
    const matcher = objectContaining({a: 1})
    expect(matcher.asymmetricMatch('string')).toBe(false)
    expect(matcher.asymmetricMatch(null)).toBe(false)
  })

  it('supports nested asymmetric matchers', () => {
    const matcher = objectContaining({name: stringMatching(/^hello/i)})
    expect(matcher.asymmetricMatch({name: 'Hello World', age: 5})).toBe(true)
    expect(matcher.asymmetricMatch({name: 'Goodbye'})).toBe(false)
  })

  it('deep-compares nested objects', () => {
    const matcher = objectContaining({nested: {a: 1}})
    expect(matcher.asymmetricMatch({nested: {a: 1}, extra: true})).toBe(true)
    expect(matcher.asymmetricMatch({nested: {a: 2}})).toBe(false)
  })
})

describe('stringMatching', () => {
  it('matches with a regex', () => {
    const matcher = stringMatching(/^hello/i)
    expect(matcher.asymmetricMatch('Hello World')).toBe(true)
    expect(matcher.asymmetricMatch('Goodbye')).toBe(false)
  })

  it('matches with a string (substring match)', () => {
    const matcher = stringMatching('hello')
    expect(matcher.asymmetricMatch('say hello world')).toBe(true)
    expect(matcher.asymmetricMatch('goodbye')).toBe(false)
  })

  it('does not match non-strings', () => {
    const matcher = stringMatching('hello')
    expect(matcher.asymmetricMatch(42)).toBe(false)
  })
})

describe('arrayContaining', () => {
  it('matches when all expected items are present', () => {
    const matcher = arrayContaining([1, 2])
    expect(matcher.asymmetricMatch([1, 2, 3])).toBe(true)
  })

  it('does not match when an item is missing', () => {
    const matcher = arrayContaining([1, 4])
    expect(matcher.asymmetricMatch([1, 2, 3])).toBe(false)
  })

  it('supports asymmetric matchers inside the array', () => {
    const matcher = arrayContaining([stringMatching(/^foo/)])
    expect(matcher.asymmetricMatch(['foobar', 'baz'])).toBe(true)
    expect(matcher.asymmetricMatch(['baz', 'qux'])).toBe(false)
  })

  it('does not match non-arrays', () => {
    const matcher = arrayContaining([1])
    expect(matcher.asymmetricMatch('not an array')).toBe(false)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run test/mock/matchers.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the matchers**

Create `src/mock/matchers.ts`:

```ts
/**
 * Protocol interface for asymmetric matching, compatible with vitest/Jest.
 * @public
 */
export interface AsymmetricMatcher {
  asymmetricMatch(value: unknown): boolean
}

/**
 * Check if a value implements the asymmetric matcher protocol.
 * @internal
 */
export function isAsymmetricMatcher(value: unknown): value is AsymmetricMatcher {
  return (
    typeof value === 'object' &&
    value !== null &&
    'asymmetricMatch' in value &&
    typeof (value as AsymmetricMatcher).asymmetricMatch === 'function'
  )
}

/**
 * Deep-compare two values, respecting asymmetric matchers on the `expected` side.
 * @internal
 */
export function deepMatch(expected: unknown, actual: unknown): boolean {
  if (isAsymmetricMatcher(expected)) {
    return expected.asymmetricMatch(actual)
  }

  if (expected === actual) return true

  if (typeof expected !== typeof actual) return false
  if (expected === null || actual === null) return false

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false
    if (expected.length !== actual.length) return false
    return expected.every((item, i) => deepMatch(item, actual[i]))
  }

  if (typeof expected === 'object') {
    const expectedObj = expected as Record<string, unknown>
    const actualObj = actual as Record<string, unknown>
    const expectedKeys = Object.keys(expectedObj)
    const actualKeys = Object.keys(actualObj)
    if (expectedKeys.length !== actualKeys.length) return false
    return expectedKeys.every((key) => key in actualObj && deepMatch(expectedObj[key], actualObj[key]))
  }

  return false
}

/**
 * Matches any value.
 * @public
 */
export function anyValue(): AsymmetricMatcher {
  return {
    asymmetricMatch(): boolean {
      return true
    },
  }
}

/**
 * Matches an object that contains at least the specified keys with matching values.
 * Extra keys on the actual value are ignored.
 * @public
 */
export function objectContaining(expected: Record<string, unknown>): AsymmetricMatcher {
  return {
    asymmetricMatch(actual: unknown): boolean {
      if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) return false
      const actualObj = actual as Record<string, unknown>
      return Object.keys(expected).every(
        (key) => key in actualObj && deepMatch(expected[key], actualObj[key]),
      )
    },
  }
}

/**
 * Matches a string against a regex or substring.
 * @public
 */
export function stringMatching(pattern: RegExp | string): AsymmetricMatcher {
  return {
    asymmetricMatch(actual: unknown): boolean {
      if (typeof actual !== 'string') return false
      if (typeof pattern === 'string') return actual.includes(pattern)
      return pattern.test(actual)
    },
  }
}

/**
 * Matches an array that contains at least the specified items (in any order).
 * @public
 */
export function arrayContaining(expected: unknown[]): AsymmetricMatcher {
  return {
    asymmetricMatch(actual: unknown): boolean {
      if (!Array.isArray(actual)) return false
      return expected.every((expectedItem) =>
        actual.some((actualItem) => deepMatch(expectedItem, actualItem)),
      )
    },
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run test/mock/matchers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mock/matchers.ts test/mock/matchers.test.ts
git commit -m "feat(mock): add asymmetric matchers with vitest-compatible protocol"
```

---

### Task 2: Deep diff utility for error messages

The diff utility compares expected vs actual values and returns human-readable field-level differences. Used by the unmatched-request error messages.

**Files:**
- Create: `src/mock/diff.ts`
- Test: `test/mock/diff.test.ts`

**Step 1: Write the failing tests**

Create `test/mock/diff.test.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {diffValues} from '../../src/mock/diff'

describe('diffValues', () => {
  it('returns empty array for identical values', () => {
    expect(diffValues('prefix', {a: 1, b: 'hello'}, {a: 1, b: 'hello'})).toEqual([])
  })

  it('reports changed values', () => {
    const diffs = diffValues('body', {a: 1}, {a: 2})
    expect(diffs).toEqual([{path: 'body.a', expected: 1, actual: 2}])
  })

  it('reports missing keys', () => {
    const diffs = diffValues('body', {a: 1, b: 2}, {a: 1})
    expect(diffs).toEqual([{path: 'body.b', expected: 2, actual: undefined}])
  })

  it('reports unexpected keys', () => {
    const diffs = diffValues('body', {a: 1}, {a: 1, b: 2})
    expect(diffs).toEqual([{path: 'body.b', expected: undefined, actual: 2}])
  })

  it('handles nested objects', () => {
    const diffs = diffValues('body', {nested: {a: 1}}, {nested: {a: 2}})
    expect(diffs).toEqual([{path: 'body.nested.a', expected: 1, actual: 2}])
  })

  it('handles arrays of different lengths', () => {
    const diffs = diffValues('body', {arr: [1, 2]}, {arr: [1, 2, 3]})
    expect(diffs.length).toBeGreaterThan(0)
  })

  it('handles type mismatches', () => {
    const diffs = diffValues('body', {a: 'string'}, {a: 42})
    expect(diffs).toEqual([{path: 'body.a', expected: 'string', actual: 42}])
  })

  it('handles comparing primitives at root', () => {
    const diffs = diffValues('query.limit', '10', '20')
    expect(diffs).toEqual([{path: 'query.limit', expected: '10', actual: '20'}])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run test/mock/diff.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the diff utility**

Create `src/mock/diff.ts`:

```ts
import {isAsymmetricMatcher} from './matchers'

/**
 * A single field-level difference between expected and actual values.
 * @internal
 */
export interface Diff {
  path: string
  expected: unknown
  actual: unknown
}

/**
 * Compare expected and actual values, producing field-level diffs.
 * Respects asymmetric matchers — if expected is a matcher that passes, no diff is reported.
 * @internal
 */
export function diffValues(prefix: string, expected: unknown, actual: unknown): Diff[] {
  if (isAsymmetricMatcher(expected)) {
    if (expected.asymmetricMatch(actual)) return []
    return [{path: prefix, expected, actual}]
  }

  if (expected === actual) return []

  if (
    typeof expected !== 'object' ||
    typeof actual !== 'object' ||
    expected === null ||
    actual === null
  ) {
    return [{path: prefix, expected, actual}]
  }

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      return [{path: prefix, expected, actual}]
    }
    const diffs: Diff[] = []
    const maxLen = Math.max(expected.length, actual.length)
    for (let i = 0; i < maxLen; i++) {
      if (i >= expected.length) {
        diffs.push({path: `${prefix}[${i}]`, expected: undefined, actual: actual[i]})
      } else if (i >= actual.length) {
        diffs.push({path: `${prefix}[${i}]`, expected: expected[i], actual: undefined})
      } else {
        diffs.push(...diffValues(`${prefix}[${i}]`, expected[i], actual[i]))
      }
    }
    return diffs
  }

  const expectedObj = expected as Record<string, unknown>
  const actualObj = actual as Record<string, unknown>
  const allKeys = new Set([...Object.keys(expectedObj), ...Object.keys(actualObj)])
  const diffs: Diff[] = []

  for (const key of allKeys) {
    const childPath = `${prefix}.${key}`
    if (!(key in expectedObj)) {
      diffs.push({path: childPath, expected: undefined, actual: actualObj[key]})
    } else if (!(key in actualObj)) {
      diffs.push({path: childPath, expected: expectedObj[key], actual: undefined})
    } else {
      diffs.push(...diffValues(childPath, expectedObj[key], actualObj[key]))
    }
  }

  return diffs
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run test/mock/diff.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mock/diff.ts test/mock/diff.test.ts
git commit -m "feat(mock): add deep diff utility for error messages"
```

---

### Task 3: URL matching and parsing utilities

Handles exact URL matching, glob patterns, and function predicates. Also parses URLs to separate path from query params.

**Files:**
- Create: `src/mock/urlMatch.ts`
- Test: `test/mock/urlMatch.test.ts`

**Step 1: Write the failing tests**

Create `test/mock/urlMatch.test.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {parseUrl, matchUrl} from '../../src/mock/urlMatch'

describe('parseUrl', () => {
  it('splits path and query from a simple path', () => {
    const result = parseUrl('/api/docs')
    expect(result.path).toBe('/api/docs')
    expect(result.query).toEqual({})
  })

  it('parses query params', () => {
    const result = parseUrl('/api/docs?limit=10&type=post')
    expect(result.path).toBe('/api/docs')
    expect(result.query).toEqual({limit: '10', type: 'post'})
  })

  it('handles full URLs', () => {
    const result = parseUrl('https://api.example.com/api/docs?limit=10')
    expect(result.path).toBe('/api/docs')
    expect(result.query).toEqual({limit: '10'})
  })

  it('handles full URLs without query', () => {
    const result = parseUrl('https://api.example.com/api/docs')
    expect(result.path).toBe('/api/docs')
    expect(result.query).toEqual({})
  })
})

describe('matchUrl', () => {
  it('matches exact paths', () => {
    expect(matchUrl('/api/docs', '/api/docs')).toBe(true)
    expect(matchUrl('/api/docs', '/api/other')).toBe(false)
  })

  it('matches glob patterns with *', () => {
    expect(matchUrl('/api/docs/*/revisions', '/api/docs/abc/revisions')).toBe(true)
    expect(matchUrl('/api/docs/*/revisions', '/api/docs/abc/other')).toBe(false)
  })

  it('matches glob patterns with **', () => {
    expect(matchUrl('/api/**', '/api/docs/abc/revisions')).toBe(true)
    expect(matchUrl('/api/**', '/other/path')).toBe(false)
  })

  it('matches with function predicate', () => {
    const pred = (url: string) => url.startsWith('/api/')
    expect(matchUrl(pred, '/api/docs')).toBe(true)
    expect(matchUrl(pred, '/other/path')).toBe(false)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run test/mock/urlMatch.test.ts`
Expected: FAIL — module not found

**Step 3: Implement URL matching**

Create `src/mock/urlMatch.ts`:

```ts
/**
 * Parsed URL with path separated from query parameters.
 * @internal
 */
export interface ParsedUrl {
  path: string
  query: Record<string, string>
}

/**
 * Parse a URL (relative or absolute) into path and query params.
 * @internal
 */
export function parseUrl(url: string): ParsedUrl {
  let path: string
  let search: string

  if (/^https?:\/\//.test(url)) {
    const parsed = new URL(url)
    path = parsed.pathname
    search = parsed.search
  } else {
    const qIndex = url.indexOf('?')
    if (qIndex === -1) {
      path = url
      search = ''
    } else {
      path = url.slice(0, qIndex)
      search = url.slice(qIndex)
    }
  }

  const query: Record<string, string> = {}
  if (search) {
    const params = new URLSearchParams(search)
    params.forEach((value, key) => {
      query[key] = value
    })
  }

  return {path, query}
}

/**
 * Convert a glob pattern to a regex.
 * Supports `*` (single segment) and `**` (multiple segments).
 * @internal
 */
function globToRegex(pattern: string): RegExp {
  let regex = ''
  let i = 0
  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      regex += '.*'
      i += 2
    } else if (pattern[i] === '*') {
      regex += '[^/]*'
      i += 1
    } else {
      regex += escapeRegex(pattern[i])
      i += 1
    }
  }
  return new RegExp(`^${regex}$`)
}

function escapeRegex(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isGlob(pattern: string): boolean {
  return pattern.includes('*')
}

/**
 * Match a URL path against a pattern (exact, glob, or function predicate).
 * @internal
 */
export function matchUrl(
  pattern: string | ((url: string) => boolean),
  actualPath: string,
): boolean {
  if (typeof pattern === 'function') {
    return pattern(actualPath)
  }

  if (isGlob(pattern)) {
    return globToRegex(pattern).test(actualPath)
  }

  return pattern === actualPath
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run test/mock/urlMatch.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mock/urlMatch.ts test/mock/urlMatch.test.ts
git commit -m "feat(mock): add URL parsing and matching utilities"
```

---

### Task 4: MockFetchError with closest-mock diff

The error thrown when no mock matches a request. Scores all registered mocks to find the closest one and shows a diff.

**Files:**
- Create: `src/mock/errors.ts`
- Test: `test/mock/errors.test.ts`

**Step 1: Write the failing tests**

Create `test/mock/errors.test.ts`:

```ts
import {describe, expect, it} from 'vitest'
import {MockFetchError, formatMockList} from '../../src/mock/errors'

describe('MockFetchError', () => {
  it('is an instance of Error', () => {
    const error = new MockFetchError('POST', '/api/docs', {limit: '10'}, undefined, [], [])
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('MockFetchError')
  })

  it('includes the method and URL in the message', () => {
    const error = new MockFetchError('POST', '/api/docs', {}, undefined, [], [])
    expect(error.message).toContain('POST')
    expect(error.message).toContain('/api/docs')
  })

  it('includes query params in the message when present', () => {
    const error = new MockFetchError('GET', '/api/docs', {limit: '10'}, undefined, [], [])
    expect(error.message).toContain('limit=10')
  })

  it('shows closest mock and diffs', () => {
    const diffs = [{path: 'query.limit', expected: '20', actual: '10'}]
    const closestDescription = 'GET /api/docs?limit=20'
    const mockList = [{description: 'GET /api/docs?limit=20', responsesRemaining: 1}]
    const error = new MockFetchError(
      'GET',
      '/api/docs',
      {limit: '10'},
      undefined,
      diffs,
      mockList,
      closestDescription,
    )
    expect(error.message).toContain('Closest mock')
    expect(error.message).toContain('query.limit')
    expect(error.message).toContain('expected "20"')
    expect(error.message).toContain('received "10"')
  })

  it('shows exhausted mocks', () => {
    const mockList = [{description: 'GET /api/docs', responsesRemaining: 0}]
    const error = new MockFetchError('GET', '/api/docs', {}, undefined, [], mockList)
    expect(error.message).toContain('exhausted')
  })
})

describe('formatMockList', () => {
  it('formats mock descriptions with response counts', () => {
    const result = formatMockList([
      {description: 'GET /api/docs', responsesRemaining: 2},
      {description: 'POST /api/docs', responsesRemaining: 0},
    ])
    expect(result).toContain('2 responses remaining')
    expect(result).toContain('exhausted')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run test/mock/errors.test.ts`
Expected: FAIL — module not found

**Step 3: Implement MockFetchError**

Create `src/mock/errors.ts`:

```ts
import type {Diff} from './diff'

/**
 * Description of a registered mock for error output.
 * @internal
 */
export interface MockDescription {
  description: string
  responsesRemaining: number
}

/**
 * Format a list of registered mocks for error output.
 * @internal
 */
export function formatMockList(mocks: MockDescription[]): string {
  if (mocks.length === 0) return '  (none registered)'
  return mocks
    .map((m, i) => {
      const count =
        m.responsesRemaining === 0
          ? 'exhausted'
          : `${m.responsesRemaining} response${m.responsesRemaining === 1 ? '' : 's'} remaining`
      return `  ${i + 1}. ${m.description} (${count})`
    })
    .join('\n')
}

function formatDiffs(diffs: Diff[]): string {
  if (diffs.length === 0) return ''
  return diffs
    .map((d) => {
      if (d.expected === undefined) {
        return `    ${d.path}: unexpected field with value ${JSON.stringify(d.actual)}`
      }
      if (d.actual === undefined) {
        return `    ${d.path}: expected ${JSON.stringify(d.expected)}, but field was missing`
      }
      return `    ${d.path}: expected ${JSON.stringify(d.expected)}, received ${JSON.stringify(d.actual)}`
    })
    .join('\n')
}

function formatQueryString(query: Record<string, string>): string {
  const entries = Object.entries(query)
  if (entries.length === 0) return ''
  return '?' + new URLSearchParams(query).toString()
}

/**
 * Error thrown when no registered mock matches an incoming request.
 * Includes the closest mock, field-level diffs, and a list of all registered mocks.
 *
 * @public
 */
export class MockFetchError extends Error {
  declare method: string
  declare url: string
  declare query: Record<string, string>
  declare body: unknown

  constructor(
    method: string,
    url: string,
    query: Record<string, string>,
    body: unknown,
    diffs: Diff[],
    allMocks: MockDescription[],
    closestDescription?: string,
  ) {
    const qs = formatQueryString(query)
    let message = `No mock matched ${method} ${url}${qs}`

    if (closestDescription) {
      message += `\n\n  Closest mock:\n    ${closestDescription}`
      const diffStr = formatDiffs(diffs)
      if (diffStr) {
        message += `\n\n  Differences:\n${diffStr}`
      }
    }

    message += `\n\n  All registered mocks:\n${formatMockList(allMocks)}`

    super(message)
    this.name = 'MockFetchError'
    this.method = method
    this.url = url
    this.query = query
    this.body = body
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run test/mock/errors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mock/errors.ts test/mock/errors.test.ts
git commit -m "feat(mock): add MockFetchError with closest-mock diffing"
```

---

### Task 5: Core createMockFetch — handler registration and fetch function

This is the main task. Implements `createMockFetch()` with `.on()`, `.onAny()`, request recording, response matching, and the actual `FetchFunction`.

**Context:** The mock's `.fetch` property is a `FetchFunction` as defined in `src/types.ts`: `(input: string, init?: FetchInit) => Promise<FetchResponse>`. The `input` is the fully-resolved URL (with query params already appended by `createRequester`). The `init` contains `method`, `headers` (as `Headers`), `body` (already JSON-stringified for objects), `signal`, etc.

The mock needs to:
1. Parse the incoming URL to separate path from query
2. Deserialize the body if content-type is JSON
3. Find the first matching handler with remaining responses
4. Record the request
5. Return a `FetchResponse`-compatible object, or throw `MockFetchError`

**Files:**
- Create: `src/mock/createMockFetch.ts`
- Test: `test/mock/createMockFetch.test.ts`

**Step 1: Write the failing tests**

Create `test/mock/createMockFetch.test.ts`:

```ts
import {createRequester} from 'get-it'
import {describe, expect, it} from 'vitest'
import {createMockFetch} from '../../src/mock/createMockFetch'
import {objectContaining, anyValue, stringMatching, arrayContaining} from '../../src/mock/matchers'
import {MockFetchError} from '../../src/mock/errors'

describe('createMockFetch', () => {
  describe('basic matching', () => {
    it('matches a simple GET request', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: {results: []}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({url: '/api/docs', as: 'json'})

      expect(res.body).toEqual({results: []})
    })

    it('matches POST with body', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/api/docs', {body: {title: 'Hello'}}).respond({status: 201, body: {id: 'abc'}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({url: '/api/docs', body: {title: 'Hello'}, as: 'json'})

      expect(res.body).toEqual({id: 'abc'})
    })

    it('matches with query params specified as option', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/api/docs', {query: {limit: '10'}})
        .respond({status: 200, body: {results: []}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({url: '/api/docs', query: {limit: 10}, as: 'json'})

      expect(res.body).toEqual({results: []})
    })

    it('matches with query params in URL pattern', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs?limit=10').respond({status: 200, body: {results: []}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({url: '/api/docs', query: {limit: 10}, as: 'json'})

      expect(res.body).toEqual({results: []})
    })

    it('is strict on query params by default', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/api/docs', {query: {limit: '10'}})
        .respond({status: 200, body: {results: []}})

      const request = createRequester({
        fetch: mock.fetch,
        base: 'https://api.example.com',
        httpErrors: false,
      })

      await expect(
        request({url: '/api/docs', query: {limit: 10, offset: 0}}),
      ).rejects.toBeInstanceOf(MockFetchError)
    })

    it('is strict on body by default', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/api/docs', {body: {title: 'Hello'}})
        .respond({status: 201, body: {id: 'abc'}})

      const request = createRequester({
        fetch: mock.fetch,
        base: 'https://api.example.com',
        httpErrors: false,
      })

      await expect(
        request({url: '/api/docs', body: {title: 'Hello', extra: true}}),
      ).rejects.toBeInstanceOf(MockFetchError)
    })
  })

  describe('loose matching', () => {
    it('matches with objectContaining on body', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/api/docs', {body: objectContaining({_type: 'post'})})
        .respond({status: 201, body: {id: 'abc'}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({
        url: '/api/docs',
        body: {_type: 'post', title: 'Hello', extra: true},
        as: 'json',
      })

      expect(res.body).toEqual({id: 'abc'})
    })

    it('matches with objectContaining on query', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/api/docs', {query: objectContaining({limit: '10'})})
        .respond({status: 200, body: []})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({url: '/api/docs', query: {limit: 10, offset: 0}, as: 'json'})

      expect(res.body).toEqual([])
    })

    it('matches with anyValue', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/api/docs', {body: {_type: 'post', createdAt: anyValue()}})
        .respond({status: 201, body: {id: 'abc'}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({
        url: '/api/docs',
        body: {_type: 'post', createdAt: '2026-01-01'},
        as: 'json',
      })

      expect(res.body).toEqual({id: 'abc'})
    })

    it('matches with stringMatching', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/api/docs', {body: objectContaining({title: stringMatching(/^Hello/)})})
        .respond({status: 201, body: {id: 'abc'}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({
        url: '/api/docs',
        body: {title: 'Hello World', _type: 'post'},
        as: 'json',
      })

      expect(res.body).toEqual({id: 'abc'})
    })

    it('matches with arrayContaining', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/api/docs', {body: objectContaining({tags: arrayContaining(['featured'])})})
        .respond({status: 201, body: {id: 'abc'}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({
        url: '/api/docs',
        body: {tags: ['featured', 'blog'], _type: 'post'},
        as: 'json',
      })

      expect(res.body).toEqual({id: 'abc'})
    })
  })

  describe('URL patterns', () => {
    it('matches glob patterns', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs/*/revisions').respond({status: 200, body: []})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({url: '/api/docs/abc123/revisions', as: 'json'})

      expect(res.body).toEqual([])
    })

    it('matches function predicates', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', (url) => url.startsWith('/api/'))
        .respond({status: 200, body: 'ok'})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({url: '/api/anything'})

      expect(res.text()).toBe('ok')
    })
  })

  describe('one-shot responses', () => {
    it('consumes responses in order', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/api/docs')
        .respond({status: 500, body: 'error'})
        .respond({status: 200, body: {results: []}})

      const request = createRequester({
        fetch: mock.fetch,
        base: 'https://api.example.com',
        httpErrors: false,
      })

      const res1 = await request({url: '/api/docs'})
      expect(res1.status).toBe(500)

      const res2 = await request({url: '/api/docs', as: 'json'})
      expect(res2.body).toEqual({results: []})
    })

    it('throws when all responses are consumed', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: 'ok'})

      const request = createRequester({
        fetch: mock.fetch,
        base: 'https://api.example.com',
        httpErrors: false,
      })

      await request({url: '/api/docs'})
      await expect(request({url: '/api/docs'})).rejects.toBeInstanceOf(MockFetchError)
    })
  })

  describe('respondPersist', () => {
    it('responds to repeated requests', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/health').respondPersist({status: 200, body: 'ok'})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})

      const res1 = await request({url: '/api/health'})
      const res2 = await request({url: '/api/health'})
      const res3 = await request({url: '/api/health'})

      expect(res1.text()).toBe('ok')
      expect(res2.text()).toBe('ok')
      expect(res3.text()).toBe('ok')
    })
  })

  describe('onAny', () => {
    it('matches any HTTP method', async () => {
      const mock = createMockFetch()
      mock.onAny('/api/docs').respondPersist({status: 200, body: 'ok'})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})

      const get = await request({url: '/api/docs'})
      const post = await request({url: '/api/docs', method: 'POST'})
      const del = await request({url: '/api/docs', method: 'DELETE'})

      expect(get.text()).toBe('ok')
      expect(post.text()).toBe('ok')
      expect(del.text()).toBe('ok')
    })
  })

  describe('request recording', () => {
    it('records all requests', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/api/docs').respondPersist({status: 200, body: 'ok'})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      await request({url: '/api/docs', body: {title: 'Hello'}, method: 'POST'})

      expect(mock.requests).toHaveLength(1)
      expect(mock.requests[0].method).toBe('POST')
      expect(mock.requests[0].url).toBe('/api/docs')
      expect(mock.requests[0].body).toEqual({title: 'Hello'})
    })

    it('records query params separately', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs', {query: {limit: '10'}}).respond({status: 200, body: 'ok'})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      await request({url: '/api/docs', query: {limit: 10}})

      expect(mock.requests[0].query).toEqual({limit: '10'})
      expect(mock.requests[0].url).toBe('/api/docs')
    })
  })

  describe('assertAllConsumed', () => {
    it('passes when all mocks are consumed', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: 'ok'})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      await request({url: '/api/docs'})

      expect(() => mock.assertAllConsumed()).not.toThrow()
    })

    it('throws when mocks remain unconsumed', () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: 'ok'})

      expect(() => mock.assertAllConsumed()).toThrow(/unconsumed/)
    })
  })

  describe('clear', () => {
    it('removes all handlers and recorded requests', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: 'ok'})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      await request({url: '/api/docs'})

      mock.clear()
      expect(mock.requests).toHaveLength(0)
      await expect(request({url: '/api/docs'})).rejects.toBeInstanceOf(MockFetchError)
    })
  })

  describe('unmatched request errors', () => {
    it('throws MockFetchError with details', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/api/docs', {query: {limit: '20'}})
        .respond({status: 200, body: 'ok'})

      const request = createRequester({
        fetch: mock.fetch,
        base: 'https://api.example.com',
        httpErrors: false,
      })

      try {
        await request({url: '/api/docs', query: {limit: 10}})
        expect.unreachable('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.message).toContain('No mock matched')
        expect(err.message).toContain('/api/docs')
        expect(err.message).toContain('Closest mock')
        expect(err.message).toContain('query.limit')
      }
    })

    it('shows exhausted mocks in error', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: 'ok'})

      const request = createRequester({
        fetch: mock.fetch,
        base: 'https://api.example.com',
        httpErrors: false,
      })

      await request({url: '/api/docs'})

      try {
        await request({url: '/api/docs'})
        expect.unreachable('should have thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.message).toContain('exhausted')
      }
    })
  })

  describe('response headers', () => {
    it('sets content-type for JSON body responses', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: {results: []}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({url: '/api/docs'})

      expect(res.headers.get('content-type')).toBe('application/json')
    })

    it('includes custom response headers', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/api/docs')
        .respond({status: 200, body: 'ok', headers: {'x-request-id': 'abc'}})

      const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
      const res = await request({url: '/api/docs'})

      expect(res.headers.get('x-request-id')).toBe('abc')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run test/mock/createMockFetch.test.ts`
Expected: FAIL — module not found

**Step 3: Implement createMockFetch**

Create `src/mock/createMockFetch.ts`:

```ts
import type {AsymmetricMatcher} from './matchers'
import type {FetchFunction, FetchInit, FetchResponse} from '../types'
import {deepMatch} from './matchers'
import {diffValues, type Diff} from './diff'
import {parseUrl, matchUrl} from './urlMatch'
import {MockFetchError, type MockDescription} from './errors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A recorded request that passed through the mock fetch.
 * @public
 */
export interface RecordedRequest {
  /** URL path without query string. */
  url: string
  /** Full URL including query string. */
  fullUrl: string
  /** HTTP method (GET, POST, etc.). */
  method: string
  /** Request headers. */
  headers: Headers
  /** Parsed query parameters. */
  query: Record<string, string>
  /** Parsed body (JSON-deserialized if content-type is JSON, raw string otherwise). */
  body: unknown
}

/**
 * Shape of a mock response definition.
 * @public
 */
export interface MockResponseDefinition {
  /** HTTP status code. */
  status: number
  /** Response body. POJOs/arrays are JSON-serialized automatically. */
  body?: unknown
  /** Response headers. */
  headers?: Record<string, string>
  /** HTTP status text. Defaults based on status code. */
  statusText?: string
}

/**
 * Match options for request body and query params.
 * @public
 */
export interface MockMatchOptions {
  /** Expected query parameters. Strict by default; use objectContaining() for subset. */
  query?: Record<string, string> | AsymmetricMatcher
  /** Expected request body. Strict deep-equal by default; use objectContaining() for subset. */
  body?: unknown
}

/**
 * Chainable handler returned by mock.on().
 * @public
 */
export interface MockHandler {
  /** Queue a one-shot response. Returns this for chaining. */
  respond(definition: MockResponseDefinition): MockHandler
  /** Set a persistent response (never consumed). Returns this for chaining. */
  respondPersist(definition: MockResponseDefinition): MockHandler
}

/**
 * The mock fetch instance returned by createMockFetch().
 * @public
 */
export interface MockFetch {
  /** The FetchFunction to inject into createRequester. */
  fetch: FetchFunction
  /** Register a handler for a specific HTTP method and URL pattern. */
  on(
    method: string,
    url: string | ((url: string) => boolean),
    options?: MockMatchOptions,
  ): MockHandler
  /** Register a handler that matches any HTTP method. */
  onAny(url: string | ((url: string) => boolean), options?: MockMatchOptions): MockHandler
  /** All recorded requests. */
  requests: RecordedRequest[]
  /** Throws if any registered one-shot responses were never consumed. */
  assertAllConsumed(): void
  /** Remove all handlers and recorded requests. */
  clear(): void
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface QueuedResponse {
  definition: MockResponseDefinition
  persistent: boolean
  consumed: boolean
}

interface RegisteredHandler {
  method: string | null // null = any method
  urlPattern: string | ((url: string) => boolean)
  urlPath: string | null // extracted path for exact/glob patterns (null for function predicates)
  matchOptions: MockMatchOptions
  responses: QueuedResponse[]
  /** Query params extracted from the URL pattern itself (e.g. '/api/docs?limit=10'). */
  patternQuery: Record<string, string>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
}

function parseRequestBody(body: string | null, headers: Headers): unknown {
  if (body === null) return undefined
  const ct = headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    try {
      return JSON.parse(body) as unknown
    } catch {
      return body
    }
  }
  return body
}

function buildFetchResponse(definition: MockResponseDefinition): FetchResponse {
  const status = definition.status
  const statusText = definition.statusText ?? STATUS_TEXT[status] ?? ''
  const headers = new Headers(definition.headers)

  let bodyStr: string
  if (definition.body === undefined || definition.body === null) {
    bodyStr = ''
  } else if (typeof definition.body === 'string') {
    bodyStr = definition.body
  } else {
    bodyStr = JSON.stringify(definition.body)
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
  }

  const bodyBytes = new TextEncoder().encode(bodyStr)

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bodyBytes)
        controller.close()
      },
    }),
    text: () => Promise.resolve(bodyStr),
    arrayBuffer: () => Promise.resolve(bodyBytes.buffer as ArrayBuffer),
  }
}

function describeHandler(handler: RegisteredHandler): string {
  const method = handler.method ?? '*'
  const url =
    typeof handler.urlPattern === 'function' ? '(predicate)' : handler.urlPattern
  const parts = [method, url]

  if (handler.matchOptions.body !== undefined) {
    parts.push(`{body: ${JSON.stringify(handler.matchOptions.body)}}`)
  }

  return parts.join(' ')
}

function responsesRemaining(handler: RegisteredHandler): number {
  let count = 0
  for (const r of handler.responses) {
    if (r.persistent) return Infinity
    if (!r.consumed) count++
  }
  return count
}

/** Score how well a handler matches an incoming request (higher = closer match). */
function scoreMatch(
  handler: RegisteredHandler,
  method: string,
  path: string,
  query: Record<string, string>,
  body: unknown,
): number {
  let score = 0

  // Method match
  if (handler.method === null || handler.method === method) score += 1

  // URL match
  if (handler.urlPath !== null && matchUrl(handler.urlPattern, path)) score += 2
  else if (typeof handler.urlPattern === 'function' && matchUrl(handler.urlPattern, path))
    score += 2

  // Query match — merge pattern query with options query
  const expectedQuery = {...handler.patternQuery, ...(handler.matchOptions.query ?? {})}
  if (Object.keys(expectedQuery).length > 0 || Object.keys(query).length > 0) {
    if (deepMatch(expectedQuery, query)) score += 2
    else score += 1 // partial credit for having query expectations
  }

  // Body match
  if (handler.matchOptions.body !== undefined) {
    if (deepMatch(handler.matchOptions.body, body)) score += 2
    else score += 1 // partial credit for having body expectations
  }

  return score
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a mock fetch instance for testing.
 *
 * @returns A MockFetch object with a `.fetch` function to inject into createRequester.
 *
 * @public
 */
export function createMockFetch(): MockFetch {
  const handlers: RegisteredHandler[] = []
  const requests: RecordedRequest[] = []

  function registerHandler(
    method: string | null,
    url: string | ((url: string) => boolean),
    options?: MockMatchOptions,
  ): MockHandler {
    let urlPath: string | null = null
    let patternQuery: Record<string, string> = {}

    if (typeof url === 'string') {
      const parsed = parseUrl(url)
      urlPath = parsed.path
      patternQuery = parsed.query
      // Rewrite urlPattern to just the path for matching
      url = parsed.path
    }

    const handler: RegisteredHandler = {
      method,
      urlPattern: url,
      urlPath,
      matchOptions: options ?? {},
      responses: [],
      patternQuery,
    }

    handlers.push(handler)

    const mockHandler: MockHandler = {
      respond(definition: MockResponseDefinition): MockHandler {
        handler.responses.push({definition, persistent: false, consumed: false})
        return mockHandler
      },
      respondPersist(definition: MockResponseDefinition): MockHandler {
        handler.responses.push({definition, persistent: true, consumed: false})
        return mockHandler
      },
    }

    return mockHandler
  }

  function findMatch(
    method: string,
    path: string,
    query: Record<string, string>,
    body: unknown,
  ): {handler: RegisteredHandler; response: QueuedResponse} | null {
    for (const handler of handlers) {
      // Check method
      if (handler.method !== null && handler.method !== method) continue

      // Check URL
      if (!matchUrl(handler.urlPattern, path)) continue

      // Check query — merge pattern query into match options
      const expectedQuery: unknown = Object.keys(handler.patternQuery).length > 0
        ? {...handler.patternQuery, ...(typeof handler.matchOptions.query === 'object' && handler.matchOptions.query !== null && !('asymmetricMatch' in handler.matchOptions.query) ? handler.matchOptions.query : {})}
        : handler.matchOptions.query

      if (expectedQuery !== undefined) {
        if (!deepMatch(expectedQuery, query)) continue
      } else if (Object.keys(handler.patternQuery).length > 0) {
        if (!deepMatch(handler.patternQuery, query)) continue
      }

      // Check body
      if (handler.matchOptions.body !== undefined) {
        if (!deepMatch(handler.matchOptions.body, body)) continue
      }

      // Find next available response
      for (const response of handler.responses) {
        if (response.persistent || !response.consumed) {
          return {handler, response}
        }
      }
      // Handler matched but all responses consumed — continue looking
    }

    return null
  }

  function buildError(
    method: string,
    path: string,
    query: Record<string, string>,
    body: unknown,
  ): MockFetchError {
    // Score all handlers to find closest match
    let bestScore = -1
    let bestHandler: RegisteredHandler | null = null

    for (const handler of handlers) {
      const score = scoreMatch(handler, method, path, query, body)
      if (score > bestScore) {
        bestScore = score
        bestHandler = handler
      }
    }

    // Build diffs against closest handler
    const diffs: Diff[] = []
    let closestDescription: string | undefined

    if (bestHandler) {
      closestDescription = describeHandler(bestHandler)

      // Diff query
      const expectedQuery = {...bestHandler.patternQuery, ...(typeof bestHandler.matchOptions.query === 'object' && bestHandler.matchOptions.query !== null && !('asymmetricMatch' in bestHandler.matchOptions.query) ? bestHandler.matchOptions.query : {})}
      if (Object.keys(expectedQuery).length > 0 || Object.keys(query).length > 0) {
        diffs.push(...diffValues('query', expectedQuery, query))
      }

      // Diff body
      if (bestHandler.matchOptions.body !== undefined && body !== undefined) {
        diffs.push(...diffValues('body', bestHandler.matchOptions.body, body))
      }
    }

    const allMocks: MockDescription[] = handlers.map((h) => ({
      description: describeHandler(h),
      responsesRemaining: responsesRemaining(h),
    }))

    return new MockFetchError(method, path, query, body, diffs, allMocks, closestDescription)
  }

  const fetchFn: FetchFunction = async (input: string, init?: FetchInit): Promise<FetchResponse> => {
    const {path, query} = parseUrl(input)
    const method = init?.method ?? 'GET'

    // Extract headers
    const headers = init?.headers instanceof Headers
      ? init.headers
      : new Headers(init?.headers ?? undefined)

    // Read and parse body
    let rawBody: string | null = null
    if (init?.body !== undefined && init.body !== null) {
      if (typeof init.body === 'string') {
        rawBody = init.body
      } else {
        rawBody = new TextDecoder().decode(
          init.body instanceof ArrayBuffer
            ? new Uint8Array(init.body)
            : init.body instanceof Uint8Array
              ? init.body
              : null ?? undefined,
        )
      }
    }
    const parsedBody = parseRequestBody(rawBody, headers)

    // Record the request
    requests.push({
      url: path,
      fullUrl: input,
      method,
      headers,
      query,
      body: parsedBody,
    })

    // Find matching handler
    const match = findMatch(method, path, query, parsedBody)

    if (!match) {
      throw buildError(method, path, query, parsedBody)
    }

    // Mark one-shot response as consumed
    if (!match.response.persistent) {
      match.response.consumed = true
    }

    return buildFetchResponse(match.response.definition)
  }

  return {
    fetch: fetchFn,
    on(method, url, options?) {
      return registerHandler(method, url, options)
    },
    onAny(url, options?) {
      return registerHandler(null, url, options)
    },
    requests,
    assertAllConsumed() {
      const unconsumed: string[] = []
      for (const handler of handlers) {
        for (const response of handler.responses) {
          if (!response.persistent && !response.consumed) {
            unconsumed.push(describeHandler(handler))
            break
          }
        }
      }
      if (unconsumed.length > 0) {
        throw new Error(
          `${unconsumed.length} mock(s) have unconsumed responses:\n${unconsumed.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}`,
        )
      }
    },
    clear() {
      handlers.length = 0
      requests.length = 0
    },
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run test/mock/createMockFetch.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mock/createMockFetch.ts test/mock/createMockFetch.test.ts
git commit -m "feat(mock): add createMockFetch with handler registration, matching, and recording"
```

---

### Task 6: Export barrel and package.json wiring for `get-it/mock`

Wire up the new `get-it/mock` export so consumers can import from it.

**Files:**
- Create: `src/_exports/mock.ts`
- Modify: `package.json` — add `"./mock"` export
- Modify: `tsconfig.settings.json` — add path alias
- Modify: `vitest.config.ts` — add test alias

**Step 1: Create the export barrel**

Create `src/_exports/mock.ts`:

```ts
export {createMockFetch} from '../mock/createMockFetch'
export type {
  MockFetch,
  MockHandler,
  MockMatchOptions,
  MockResponseDefinition,
  RecordedRequest,
} from '../mock/createMockFetch'
export {MockFetchError} from '../mock/errors'
export {anyValue, arrayContaining, objectContaining, stringMatching} from '../mock/matchers'
export type {AsymmetricMatcher} from '../mock/matchers'
```

**Step 2: Add `./mock` to package.json exports**

Add this entry to `"exports"` in `package.json`, after the `"./node"` entry:

```json
"./mock": {
  "source": "./src/_exports/mock.ts",
  "import": "./dist/mock.js",
  "default": "./dist/mock.js"
}
```

Also add to `"publishConfig"."exports"`:

```json
"./mock": {
  "import": "./dist/mock.js",
  "default": "./dist/mock.js"
}
```

**Step 3: Add path alias to tsconfig.settings.json**

Add to `"paths"`:

```json
"get-it/mock": ["./src/_exports/mock.ts"]
```

**Step 4: Add test alias to vitest.config.ts**

Add to the `alias` object:

```ts
'get-it/mock': new URL('./src/_exports/mock.ts', import.meta.url).pathname,
```

**Step 5: Write a smoke test using the public import path**

Create `test/mock/smoke.test.ts`:

```ts
import {createRequester} from 'get-it'
import {createMockFetch, objectContaining, MockFetchError} from 'get-it/mock'
import {describe, expect, it} from 'vitest'

describe('get-it/mock smoke test', () => {
  it('works end-to-end via public import', async () => {
    const mock = createMockFetch()
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})

    mock.on('POST', '/api/docs', {body: objectContaining({_type: 'post'})})
      .respond({status: 201, body: {id: 'abc'}})

    const res = await request({
      url: '/api/docs',
      body: {_type: 'post', title: 'Hello'},
      as: 'json',
    })

    expect(res.body).toEqual({id: 'abc'})
    expect(mock.requests).toHaveLength(1)
    mock.assertAllConsumed()
  })

  it('MockFetchError is importable and instanceof works', async () => {
    const mock = createMockFetch()
    const request = createRequester({
      fetch: mock.fetch,
      base: 'https://api.example.com',
      httpErrors: false,
    })

    try {
      await request({url: '/api/nothing'})
      expect.unreachable('should have thrown')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(MockFetchError)
    }
  })
})
```

**Step 6: Run tests to verify everything passes**

Run: `npx vitest run test/mock/`
Expected: PASS (all mock tests)

**Step 7: Commit**

```bash
git add src/_exports/mock.ts test/mock/smoke.test.ts package.json tsconfig.settings.json vitest.config.ts
git commit -m "feat(mock): wire up get-it/mock export with barrel, aliases, and smoke test"
```

---

### Task 7: Vitest custom matchers (`get-it/vitest`)

Add custom vitest matchers for ergonomic assertions on `MockFetch` and `RecordedRequest` objects.

**Files:**
- Create: `src/mock/vitestMatchers.ts`
- Create: `src/_exports/vitest.ts`
- Test: `test/mock/vitest-matchers.test.ts`
- Modify: `package.json` — add `"./vitest"` export
- Modify: `tsconfig.settings.json` — add path alias
- Modify: `vitest.config.ts` — add test alias

**Step 1: Write the failing tests**

Create `test/mock/vitest-matchers.test.ts`:

```ts
import {createRequester} from 'get-it'
import {createMockFetch, objectContaining} from 'get-it/mock'
import {beforeEach, describe, expect, it} from 'vitest'
import '../../src/_exports/vitest'

import type {MockFetch} from 'get-it/mock'

let mock: MockFetch

beforeEach(() => {
  mock = createMockFetch()
})

describe('vitest matchers on MockFetch', () => {
  it('toHaveReceivedRequest passes when request was made', async () => {
    mock.on('POST', '/api/docs').respond({status: 201, body: {id: 'abc'}})
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
    await request({url: '/api/docs', body: {title: 'Hello'}, as: 'json'})

    expect(mock).toHaveReceivedRequest('POST', '/api/docs')
  })

  it('toHaveReceivedRequest fails when request was not made', () => {
    expect(() => {
      expect(mock).toHaveReceivedRequest('GET', '/api/docs')
    }).toThrow()
  })

  it('toHaveReceivedRequest with body match', async () => {
    mock.on('POST', '/api/docs').respond({status: 201, body: {id: 'abc'}})
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
    await request({url: '/api/docs', body: {_type: 'post', title: 'Hello'}, as: 'json'})

    expect(mock).toHaveReceivedRequest('POST', '/api/docs', {
      body: objectContaining({_type: 'post'}),
    })
  })

  it('toHaveReceivedRequestTimes', async () => {
    mock.on('GET', '/api/docs').respondPersist({status: 200, body: []})
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
    await request({url: '/api/docs', as: 'json'})
    await request({url: '/api/docs', as: 'json'})

    expect(mock).toHaveReceivedRequestTimes('GET', '/api/docs', 2)
  })

  it('toHaveConsumedAllMocks', async () => {
    mock.on('GET', '/api/docs').respond({status: 200, body: []})
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
    await request({url: '/api/docs', as: 'json'})

    expect(mock).toHaveConsumedAllMocks()
  })

  it('toHaveConsumedAllMocks fails when mocks remain', () => {
    mock.on('GET', '/api/docs').respond({status: 200, body: []})

    expect(() => {
      expect(mock).toHaveConsumedAllMocks()
    }).toThrow()
  })
})

describe('vitest matchers on RecordedRequest', () => {
  it('toHaveHeader', async () => {
    mock.on('GET', '/api/docs').respond({status: 200, body: []})
    const request = createRequester({
      fetch: mock.fetch,
      base: 'https://api.example.com',
      headers: {authorization: 'Bearer token123'},
    })
    await request({url: '/api/docs', as: 'json'})

    expect(mock.requests[0]).toHaveHeader('authorization', 'Bearer token123')
  })

  it('toHaveHeader with asymmetric matcher', async () => {
    mock.on('GET', '/api/docs').respond({status: 200, body: []})
    const request = createRequester({
      fetch: mock.fetch,
      base: 'https://api.example.com',
      headers: {'content-type': 'application/json; charset=utf-8'},
    })
    await request({url: '/api/docs', as: 'json'})

    expect(mock.requests[0]).toHaveHeader('content-type', expect.stringContaining('json'))
  })

  it('toHaveBody', async () => {
    mock.on('POST', '/api/docs').respond({status: 201, body: {id: 'abc'}})
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
    await request({url: '/api/docs', body: {title: 'Hello'}, as: 'json'})

    expect(mock.requests[0]).toHaveBody({title: 'Hello'})
  })

  it('toHaveBody with objectContaining', async () => {
    mock.on('POST', '/api/docs').respond({status: 201, body: {id: 'abc'}})
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
    await request({url: '/api/docs', body: {title: 'Hello', _type: 'post'}, as: 'json'})

    expect(mock.requests[0]).toHaveBody(objectContaining({title: 'Hello'}))
  })

  it('toHaveQuery', async () => {
    mock.on('GET', '/api/docs', {query: {limit: '10'}}).respond({status: 200, body: []})
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
    await request({url: '/api/docs', query: {limit: 10}, as: 'json'})

    expect(mock.requests[0]).toHaveQuery({limit: '10'})
  })

  it('toHaveMethod', async () => {
    mock.on('DELETE', '/api/docs/123').respond({status: 204})
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
    await request({url: '/api/docs/123', method: 'DELETE'})

    expect(mock.requests[0]).toHaveMethod('DELETE')
  })

  it('toHaveUrl', async () => {
    mock.on('GET', '/api/docs').respond({status: 200, body: []})
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})
    await request({url: '/api/docs', as: 'json'})

    expect(mock.requests[0]).toHaveUrl('/api/docs')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run test/mock/vitest-matchers.test.ts`
Expected: FAIL — module not found

**Step 3: Implement vitest matchers**

Create `src/mock/vitestMatchers.ts`:

```ts
import type {MockFetch, MockMatchOptions, RecordedRequest} from './createMockFetch'
import {deepMatch} from './matchers'
import {parseUrl, matchUrl} from './urlMatch'

/**
 * Type guard for MockFetch objects.
 * @internal
 */
function isMockFetch(value: unknown): value is MockFetch {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetch' in value &&
    'requests' in value &&
    'on' in value &&
    'assertAllConsumed' in value
  )
}

/**
 * Type guard for RecordedRequest objects.
 * @internal
 */
function isRecordedRequest(value: unknown): value is RecordedRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    'fullUrl' in value &&
    'method' in value &&
    'headers' in value &&
    'query' in value
  )
}

function filterRequests(
  requests: RecordedRequest[],
  method: string,
  url: string,
  options?: MockMatchOptions,
): RecordedRequest[] {
  const {path, query: urlQuery} = parseUrl(url)

  return requests.filter((req) => {
    if (req.method !== method) return false
    if (!matchUrl(path, req.url)) return false

    // Check query from URL + options
    const expectedQuery = {...urlQuery, ...(typeof options?.query === 'object' && options.query !== null && !('asymmetricMatch' in options.query) ? options.query : {})}
    if (options?.query && 'asymmetricMatch' in options.query) {
      if (!deepMatch(options.query, req.query)) return false
    } else if (Object.keys(expectedQuery).length > 0) {
      if (!deepMatch(expectedQuery, req.query)) return false
    }

    // Check body
    if (options?.body !== undefined) {
      if (!deepMatch(options.body, req.body)) return false
    }

    return true
  })
}

/**
 * Custom vitest matchers for get-it mock testing.
 * @internal
 */
export const mockMatchers = {
  toHaveReceivedRequest(
    received: unknown,
    method: string,
    url: string,
    options?: MockMatchOptions,
  ) {
    if (!isMockFetch(received)) {
      return {
        pass: false,
        message: () => 'Expected a MockFetch object',
      }
    }

    const matching = filterRequests(received.requests, method, url, options)
    const pass = matching.length > 0

    return {
      pass,
      message: () => {
        if (pass) {
          return `Expected mock not to have received ${method} ${url}, but it was called ${matching.length} time(s)`
        }
        const total = received.requests.length
        if (total === 0) {
          return `Expected mock to have received ${method} ${url}, but no requests were made`
        }
        const summary = received.requests
          .map((r) => `  - ${r.method} ${r.url}`)
          .join('\n')
        return `Expected mock to have received ${method} ${url}, but it was not found among ${total} request(s):\n${summary}`
      },
    }
  },

  toHaveReceivedRequestTimes(
    received: unknown,
    method: string,
    url: string,
    times: number,
  ) {
    if (!isMockFetch(received)) {
      return {
        pass: false,
        message: () => 'Expected a MockFetch object',
      }
    }

    const matching = filterRequests(received.requests, method, url)
    const pass = matching.length === times

    return {
      pass,
      message: () =>
        `Expected ${method} ${url} to have been called ${times} time(s), but was called ${matching.length} time(s)`,
    }
  },

  toHaveConsumedAllMocks(received: unknown) {
    if (!isMockFetch(received)) {
      return {
        pass: false,
        message: () => 'Expected a MockFetch object',
      }
    }

    try {
      received.assertAllConsumed()
      return {
        pass: true,
        message: () => 'Expected mock to have unconsumed responses, but all were consumed',
      }
    } catch (err: unknown) {
      return {
        pass: false,
        message: () => (err instanceof Error ? err.message : String(err)),
      }
    }
  },

  toHaveHeader(received: unknown, name: string, value: unknown) {
    if (!isRecordedRequest(received)) {
      return {
        pass: false,
        message: () => 'Expected a RecordedRequest object',
      }
    }

    const actual = received.headers.get(name)
    const pass = deepMatch(value, actual)

    return {
      pass,
      message: () => {
        if (pass) {
          return `Expected request not to have header "${name}" with value ${JSON.stringify(value)}`
        }
        if (actual === null) {
          return `Expected request to have header "${name}", but it was not set`
        }
        return `Expected header "${name}" to be ${JSON.stringify(value)}, received ${JSON.stringify(actual)}`
      },
    }
  },

  toHaveBody(received: unknown, expected: unknown) {
    if (!isRecordedRequest(received)) {
      return {
        pass: false,
        message: () => 'Expected a RecordedRequest object',
      }
    }

    const pass = deepMatch(expected, received.body)

    return {
      pass,
      message: () => {
        if (pass) {
          return `Expected request body not to match ${JSON.stringify(expected)}`
        }
        return `Expected request body to match:\n  Expected: ${JSON.stringify(expected)}\n  Received: ${JSON.stringify(received.body)}`
      },
    }
  },

  toHaveQuery(received: unknown, expected: unknown) {
    if (!isRecordedRequest(received)) {
      return {
        pass: false,
        message: () => 'Expected a RecordedRequest object',
      }
    }

    const pass = deepMatch(expected, received.query)

    return {
      pass,
      message: () => {
        if (pass) {
          return `Expected request query not to match ${JSON.stringify(expected)}`
        }
        return `Expected request query to match:\n  Expected: ${JSON.stringify(expected)}\n  Received: ${JSON.stringify(received.query)}`
      },
    }
  },

  toHaveMethod(received: unknown, expected: string) {
    if (!isRecordedRequest(received)) {
      return {
        pass: false,
        message: () => 'Expected a RecordedRequest object',
      }
    }

    const pass = received.method === expected

    return {
      pass,
      message: () =>
        `Expected request method to be "${expected}", received "${received.method}"`,
    }
  },

  toHaveUrl(received: unknown, expected: string) {
    if (!isRecordedRequest(received)) {
      return {
        pass: false,
        message: () => 'Expected a RecordedRequest object',
      }
    }

    const pass = received.url === expected

    return {
      pass,
      message: () =>
        `Expected request URL to be "${expected}", received "${received.url}"`,
    }
  },
}
```

**Step 4: Create the vitest entry point**

Create `src/_exports/vitest.ts`:

```ts
import {expect} from 'vitest'
import {mockMatchers} from '../mock/vitestMatchers'

expect.extend(mockMatchers)

// Augment vitest's Assertion interface
declare module 'vitest' {
  interface Assertion<T> {
    /** Assert a request was received matching the method, URL, and optional match options. */
    toHaveReceivedRequest(
      method: string,
      url: string,
      options?: import('../mock/createMockFetch').MockMatchOptions,
    ): void
    /** Assert a request was received exactly N times. */
    toHaveReceivedRequestTimes(method: string, url: string, times: number): void
    /** Assert all registered mock responses were consumed. */
    toHaveConsumedAllMocks(): void
    /** Assert the recorded request has a specific header. */
    toHaveHeader(name: string, value: unknown): void
    /** Assert the recorded request has a matching body. */
    toHaveBody(expected: unknown): void
    /** Assert the recorded request has matching query parameters. */
    toHaveQuery(expected: unknown): void
    /** Assert the recorded request used a specific HTTP method. */
    toHaveMethod(expected: string): void
    /** Assert the recorded request was to a specific URL path. */
    toHaveUrl(expected: string): void
  }
}
```

**Step 5: Wire up package.json, tsconfig, and vitest aliases**

Add to `"exports"` in `package.json` after `"./mock"`:

```json
"./vitest": {
  "source": "./src/_exports/vitest.ts",
  "import": "./dist/vitest.js",
  "default": "./dist/vitest.js"
}
```

Also add to `"publishConfig"."exports"`:

```json
"./vitest": {
  "import": "./dist/vitest.js",
  "default": "./dist/vitest.js"
}
```

Add to `tsconfig.settings.json` paths:

```json
"get-it/vitest": ["./src/_exports/vitest.ts"]
```

Add to `vitest.config.ts` alias:

```ts
'get-it/vitest': new URL('./src/_exports/vitest.ts', import.meta.url).pathname,
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run test/mock/vitest-matchers.test.ts`
Expected: PASS

**Step 7: Run all mock tests together**

Run: `npx vitest run test/mock/`
Expected: PASS (all tests)

**Step 8: Commit**

```bash
git add src/mock/vitestMatchers.ts src/_exports/vitest.ts test/mock/vitest-matchers.test.ts package.json tsconfig.settings.json vitest.config.ts
git commit -m "feat(mock): add get-it/vitest custom matchers"
```

---

### Task 8: Build verification and full test run

Verify the build works and all existing tests still pass.

**Files:**
- No new files — verification only.

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing + new mock tests)

**Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: No type errors

**Step 3: Build the package**

Run: `pnpm run build`
Expected: Build succeeds, `dist/mock.js` and `dist/vitest.js` are generated

**Step 4: Verify dist files exist**

Run: `ls dist/mock.* dist/vitest.*`
Expected: `dist/mock.js`, `dist/mock.d.ts`, `dist/vitest.js`, `dist/vitest.d.ts`

**Step 5: Run lint**

Run: `pnpm run lint`
Expected: No lint errors (fix any that appear)

**Step 6: Commit any fixes**

If lint or type errors required changes, commit them:

```bash
git add -A
git commit -m "fix: resolve lint/type issues in mock exports"
```
