import {isAsymmetricMatcher, isRecord} from './matchers'

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
 * Deep-compare two values and return human-readable field-level differences.
 * Respects asymmetric matchers on the `expected` side.
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

  // Both are non-null non-array objects — narrow with type guard
  if (!isRecord(expected) || !isRecord(actual)) {
    return [{path: prefix, expected, actual}]
  }

  const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)])
  const diffs: Diff[] = []

  for (const key of allKeys) {
    const childPath = `${prefix}.${key}`
    const expHas = key in expected
    const actHas = key in actual
    if (!expHas) {
      diffs.push({path: childPath, expected: undefined, actual: actual[key]})
    } else if (!actHas) {
      diffs.push({path: childPath, expected: expected[key], actual: undefined})
    } else {
      diffs.push(...diffValues(childPath, expected[key], actual[key]))
    }
  }

  return diffs
}
