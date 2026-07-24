import {bytesEqual, toBytes} from './bytes'

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
    typeof value.asymmetricMatch === 'function'
  )
}

/**
 * Type guard for non-null objects with string-keyed properties.
 * @internal
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep-compare two values, respecting asymmetric matchers on the `expected` side.
 *
 * Note: This function compares objects by own enumerable keys, so value types like
 * `Date` and `RegExp` that store state internally (not as own enumerable keys) will
 * be compared structurally (by keys) rather than by value — two different `Date`
 * instances with no own enumerable keys will be considered equal. This is acceptable
 * for HTTP request/response matching but is a known limitation.
 *
 * @internal
 */
export function deepMatch(expected: unknown, actual: unknown): boolean {
  if (isAsymmetricMatcher(expected)) {
    return expected.asymmetricMatch(actual)
  }

  if (expected === actual) return true

  if (expected instanceof Uint8Array || actual instanceof Uint8Array) {
    return (
      expected instanceof Uint8Array && actual instanceof Uint8Array && bytesEqual(expected, actual)
    )
  }

  if (typeof expected !== typeof actual) return false
  if (expected === null || actual === null) return false

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false
    if (expected.length !== actual.length) return false
    return expected.every((item, i) => deepMatch(item, actual[i]))
  }

  if (isRecord(expected) && isRecord(actual)) {
    const expectedKeys = Object.keys(expected)
    const actualKeys = Object.keys(actual)
    if (expectedKeys.length !== actualKeys.length) return false
    return expectedKeys.every((key) => key in actual && deepMatch(expected[key], actual[key]))
  }

  return false
}

/**
 * Matches any value except `null` and `undefined`, mirroring the semantics of
 * vitest's `expect.anything()`. In particular, this means a missing header,
 * query parameter or body does not match.
 * @public
 */
export function anyValue(): AsymmetricMatcher {
  return {
    asymmetricMatch(actual: unknown): boolean {
      return actual !== null && actual !== undefined
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
      if (!isRecord(actual)) return false
      return Object.keys(expected).every(
        (key) => key in actual && deepMatch(expected[key], actual[key]),
      )
    },
  }
}

/**
 * Matches a query object that contains at least the specified keys with matching
 * values. Expected values are coerced to strings before comparison, since query
 * parameters are always strings. An array expected value matches a multi-value
 * param (an array actual) that contains each expected value. Extra keys on the
 * actual value are ignored.
 * @public
 */
export function queryContaining(
  expected: Record<string, string | number | boolean | Array<string | number | boolean>>,
): AsymmetricMatcher {
  return {
    asymmetricMatch(actual: unknown): boolean {
      if (!isRecord(actual)) return false
      return Object.keys(expected).every((key) => {
        const expectedValue = expected[key]
        const actualValue = actual[key]
        if (Array.isArray(expectedValue)) {
          if (!Array.isArray(actualValue)) return false
          return expectedValue.every((item) => actualValue.includes(String(item)))
        }
        return actualValue === String(expectedValue)
      })
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

/**
 * Matches a request body against exact bytes. The actual value must be a
 * `Uint8Array` (which is how the mock records binary and streamed bodies) with
 * identical bytes. Accepts a `Uint8Array` or `ArrayBuffer` as the expected value.
 * @public
 */
export function bodyBytes(expected: Uint8Array | ArrayBuffer): AsymmetricMatcher {
  const expectedBytes = toBytes(expected)
  // Assigned to a variable (not returned as a literal) so the extra `toString`
  // member doesn't trip TypeScript's excess-property check against AsymmetricMatcher.
  const matcher = {
    asymmetricMatch(actual: unknown): boolean {
      return actual instanceof Uint8Array && bytesEqual(expectedBytes, actual)
    },
    toString(): string {
      return `bodyBytes(${expectedBytes.byteLength} bytes)`
    },
  }
  return matcher
}
