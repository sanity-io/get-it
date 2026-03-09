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
function isRecord(value: unknown): value is Record<string, unknown> {
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
      if (!isRecord(actual)) return false
      return Object.keys(expected).every(
        (key) => key in actual && deepMatch(expected[key], actual[key]),
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
