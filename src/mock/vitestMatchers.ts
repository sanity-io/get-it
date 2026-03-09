import type {MockFetch, MockMatchOptions, RecordedRequest} from './createMockFetch'
import {deepMatch} from './matchers'
import {matchUrl, parseUrl} from './urlMatch'

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
  const expectedPath = parsed.path
  const expectedQuery = parsed.query

  const requests = received.getRequests()
  const found = requests.some((req) => {
    if (req.method !== method) return false
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
  const expectedPath = parsed.path
  const expectedQuery = parsed.query

  const requests = received.getRequests()
  let count = 0
  for (const req of requests) {
    if (req.method !== method) continue
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

function toHaveHeader(received: unknown, name: string, value: unknown): MatcherResult {
  if (!isRecordedRequest(received)) {
    return {
      pass: false,
      message: () => 'Expected value to be a RecordedRequest',
    }
  }

  const actual = received.headers.get(name)
  const pass = deepMatch(value, actual)

  return {
    pass,
    message: pass
      ? () => `Expected request not to have header "${name}" matching ${String(value)}, but it did`
      : () =>
          `Expected request to have header "${name}" matching ${String(value)}, but got ${actual === null ? '(not set)' : JSON.stringify(actual)}`,
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
}
