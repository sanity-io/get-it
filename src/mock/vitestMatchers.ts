import type {MockFetch, MockMatchOptions, RecordedRequest} from './createMockFetch'
import {type AsymmetricMatcher, deepMatch, isAsymmetricMatcher} from './matchers'
import {matchUrl, parseUrl} from './urlMatch'
import {StreamBody} from './streamBody'

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Check if a value is a MockFetch instance by duck-typing its shape.
 * @internal
 */
function isMockFetch(value: unknown): value is MockFetch {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetch' in value &&
    'on' in value &&
    'getRequests' in value &&
    'assertAllConsumed' in value
  )
}

/**
 * Check if a value is a RecordedRequest by duck-typing its shape.
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

// ---------------------------------------------------------------------------
// Matcher result helper
// ---------------------------------------------------------------------------

interface MatcherResult {
  pass: boolean
  message: () => string
}

function requestOriginMatches(expectedOrigin: string, request: RecordedRequest): boolean {
  if (expectedOrigin === '') return true
  return parseUrl(request.fullUrl).origin === expectedOrigin
}

// ---------------------------------------------------------------------------
// MockFetch matchers
// ---------------------------------------------------------------------------

function toHaveReceivedRequest(
  received: unknown,
  method: string,
  url: string,
  options?: MockMatchOptions,
): MatcherResult {
  if (!isMockFetch(received)) {
    return {
      pass: false,
      message: () => 'Expected value to be a MockFetch instance',
    }
  }

  const parsed = parseUrl(url)
  const expectedOrigin = parsed.origin
  const expectedPath = parsed.path
  const expectedQuery = parsed.query

  const requests = received.getRequests()
  const found = requests.some((req) => {
    if (req.method !== method) return false
    if (!requestOriginMatches(expectedOrigin, req)) return false
    if (!matchUrl(expectedPath, req.url)) return false
    if (Object.keys(expectedQuery).length > 0 && !deepMatch(expectedQuery, req.query)) return false
    if (options?.query !== undefined && !deepMatch(options.query, req.query)) return false
    if (options?.body !== undefined && !deepMatch(options.body, req.body)) return false
    return true
  })

  return {
    pass: found,
    message: found
      ? () => `Expected MockFetch not to have received ${method} ${url}, but it did`
      : () => {
          const recorded = requests.map((r) => `  ${r.method} ${r.url}`).join('\n')
          return `Expected MockFetch to have received ${method} ${url}, but it was not found.\nRecorded requests:\n${recorded || '  (none)'}`
        },
  }
}

function toHaveReceivedRequestTimes(
  received: unknown,
  method: string,
  url: string,
  times: number,
): MatcherResult {
  if (!isMockFetch(received)) {
    return {
      pass: false,
      message: () => 'Expected value to be a MockFetch instance',
    }
  }

  const parsed = parseUrl(url)
  const expectedOrigin = parsed.origin
  const expectedPath = parsed.path
  const expectedQuery = parsed.query

  const requests = received.getRequests()
  let count = 0
  for (const req of requests) {
    if (req.method !== method) continue
    if (!requestOriginMatches(expectedOrigin, req)) continue
    if (!matchUrl(expectedPath, req.url)) continue
    if (Object.keys(expectedQuery).length > 0 && !deepMatch(expectedQuery, req.query)) continue
    count++
  }

  return {
    pass: count === times,
    message:
      count === times
        ? () =>
            `Expected MockFetch not to have received ${method} ${url} ${times} time(s), but it did`
        : () =>
            `Expected MockFetch to have received ${method} ${url} ${times} time(s), but it was received ${count} time(s)`,
  }
}

function toHaveConsumedAllMocks(received: unknown): MatcherResult {
  if (!isMockFetch(received)) {
    return {
      pass: false,
      message: () => 'Expected value to be a MockFetch instance',
    }
  }

  try {
    received.assertAllConsumed()
    return {
      pass: true,
      message: () => 'Expected MockFetch to have unconsumed mocks, but all were consumed',
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return {
      pass: false,
      message: () => errorMessage,
    }
  }
}

// ---------------------------------------------------------------------------
// RecordedRequest matchers
// ---------------------------------------------------------------------------

function toHaveHeader(
  received: unknown,
  name: string | AsymmetricMatcher,
  value?: unknown,
): MatcherResult {
  if (!isRecordedRequest(received)) {
    return {
      pass: false,
      message: () => 'Expected value to be a RecordedRequest',
    }
  }

  // Omitting `value` asserts presence only. Header values can never be
  // `undefined`, so an explicit `undefined` is treated the same way.
  const checkValue = value !== undefined

  if (typeof name === 'string') {
    const actual = received.headers.get(name)
    const pass = actual !== null && (!checkValue || deepMatch(value, actual))

    return {
      pass,
      message: pass
        ? () =>
            checkValue
              ? `Expected request not to have header "${name}" matching ${String(value)}, but it did`
              : `Expected request not to have header "${name}", but it was set to ${JSON.stringify(actual)}`
        : () =>
            checkValue
              ? `Expected request to have header "${name}" matching ${String(value)}, but got ${actual === null ? '(not set)' : JSON.stringify(actual)}`
              : `Expected request to have header "${name}", but it was not set`,
    }
  }

  if (!isAsymmetricMatcher(name)) {
    return {
      pass: false,
      message: () => 'Expected header name to be a string or an asymmetric matcher',
    }
  }

  // Asymmetric name matchers are tested against lowercased header names.
  // Lowercased explicitly rather than relying on `Headers` normalization,
  // since some implementations (e.g. happy-dom) preserve the original casing
  // in iteration despite the fetch spec requiring lowercase.
  const matched: string[] = []
  received.headers.forEach((headerValue, headerName) => {
    const lowerName = headerName.toLowerCase()
    if (name.asymmetricMatch(lowerName) && (!checkValue || deepMatch(value, headerValue))) {
      matched.push(lowerName)
    }
  })
  const pass = matched.length > 0
  const description = checkValue
    ? `a header with name matching ${String(name)} and value matching ${String(value)}`
    : `a header with name matching ${String(name)}`

  return {
    pass,
    message: pass
      ? () => `Expected request not to have ${description}, but found: ${matched.join(', ')}`
      : () => `Expected request to have ${description}, but no header matched`,
  }
}

function toHaveBody(received: unknown, expected: unknown): MatcherResult {
  if (!isRecordedRequest(received)) {
    return {
      pass: false,
      message: () => 'Expected value to be a RecordedRequest',
    }
  }

  const pass = deepMatch(expected, received.body)

  return {
    pass,
    message: pass
      ? () => `Expected request body not to match, but it did`
      : () =>
          `Expected request body to match ${JSON.stringify(expected)}, but got ${JSON.stringify(received.body)}`,
  }
}

function toHaveQuery(received: unknown, expected: unknown): MatcherResult {
  if (!isRecordedRequest(received)) {
    return {
      pass: false,
      message: () => 'Expected value to be a RecordedRequest',
    }
  }

  const pass = deepMatch(expected, received.query)

  return {
    pass,
    message: pass
      ? () => `Expected request query not to match, but it did`
      : () =>
          `Expected request query to match ${JSON.stringify(expected)}, but got ${JSON.stringify(received.query)}`,
  }
}

function toHaveMethod(received: unknown, expected: string): MatcherResult {
  if (!isRecordedRequest(received)) {
    return {
      pass: false,
      message: () => 'Expected value to be a RecordedRequest',
    }
  }

  const pass = received.method === expected

  return {
    pass,
    message: pass
      ? () => `Expected request method not to be "${expected}", but it was`
      : () => `Expected request method to be "${expected}", but got "${received.method}"`,
  }
}

function toHaveUrl(received: unknown, expected: string): MatcherResult {
  if (!isRecordedRequest(received)) {
    return {
      pass: false,
      message: () => 'Expected value to be a RecordedRequest',
    }
  }

  const pass = received.url === expected

  return {
    pass,
    message: pass
      ? () => `Expected request URL not to be "${expected}", but it was`
      : () => `Expected request URL to be "${expected}", but got "${received.url}"`,
  }
}

// ---------------------------------------------------------------------------
// StreamBody matchers
// ---------------------------------------------------------------------------

function toHaveBeenCancelled(received: unknown): MatcherResult {
  if (!(received instanceof StreamBody)) {
    return {
      pass: false,
      message: () => 'Expected value to be a streamBody() instance',
    }
  }

  const pass = received.cancelCount > 0

  return {
    pass,
    message: pass
      ? () =>
          `Expected stream body not to have been cancelled, but it was cancelled ${received.cancelCount} time(s) (last reason: ${String(received.lastCancelReason)})`
      : () => 'Expected stream body to have been cancelled, but it never was',
  }
}

// ---------------------------------------------------------------------------
// Exported matcher map
// ---------------------------------------------------------------------------

/**
 * Custom vitest matchers for MockFetch and RecordedRequest assertions.
 * @public
 */
export const mockMatchers = {
  toHaveReceivedRequest,
  toHaveReceivedRequestTimes,
  toHaveConsumedAllMocks,
  toHaveHeader,
  toHaveBody,
  toHaveQuery,
  toHaveMethod,
  toHaveUrl,
  toHaveBeenCancelled,
}
