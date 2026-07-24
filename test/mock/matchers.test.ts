import {describe, expect, it} from 'vitest'

import {
  anyValue,
  arrayContaining,
  bodyBytes,
  deepMatch,
  isAsymmetricMatcher,
  objectContaining,
  queryContaining,
  stringMatching,
} from '../../src/mock/matchers'

describe('isAsymmetricMatcher', () => {
  it('returns true for objects with an asymmetricMatch function', () => {
    const matcher = {asymmetricMatch: () => true}
    expect(isAsymmetricMatcher(matcher)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isAsymmetricMatcher(null)).toBe(false)
  })

  it('returns false for plain objects without asymmetricMatch', () => {
    expect(isAsymmetricMatcher({a: 1})).toBe(false)
  })

  it('returns false when asymmetricMatch is not a function', () => {
    expect(isAsymmetricMatcher({asymmetricMatch: 'not a function'})).toBe(false)
    expect(isAsymmetricMatcher({asymmetricMatch: 42})).toBe(false)
  })
})

describe('deepMatch', () => {
  it('matches equal primitives', () => {
    expect(deepMatch(1, 1)).toBe(true)
    expect(deepMatch('hello', 'hello')).toBe(true)
    expect(deepMatch(true, true)).toBe(true)
  })

  it('does not match when types differ', () => {
    expect(deepMatch(1, '1')).toBe(false)
    expect(deepMatch(0, false)).toBe(false)
  })

  it('matches null to null', () => {
    expect(deepMatch(null, null)).toBe(true)
  })

  it('does not match arrays of different lengths', () => {
    expect(deepMatch([1, 2], [1, 2, 3])).toBe(false)
    expect(deepMatch([1, 2, 3], [1, 2])).toBe(false)
  })

  it('supports nested asymmetric matchers in arrays', () => {
    expect(deepMatch([stringMatching(/^foo/), 2], ['foobar', 2])).toBe(true)
    expect(deepMatch([stringMatching(/^foo/), 2], ['bar', 2])).toBe(false)
  })

  it('treats Date instances with no own keys as structurally equal (known limitation)', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2025-06-15')
    // Both Date objects have zero own enumerable keys, so deepMatch considers them equal.
    // This is a known limitation: deepMatch compares by own enumerable keys, not by value.
    expect(deepMatch(d1, d2)).toBe(true)
  })
})

describe('anyValue', () => {
  it('matches any value except null and undefined', () => {
    const matcher = anyValue()
    expect(matcher.asymmetricMatch('hello')).toBe(true)
    expect(matcher.asymmetricMatch(42)).toBe(true)
    expect(matcher.asymmetricMatch({a: 1})).toBe(true)
    expect(matcher.asymmetricMatch('')).toBe(true)
    expect(matcher.asymmetricMatch(0)).toBe(true)
    expect(matcher.asymmetricMatch(false)).toBe(true)
  })

  it('does not match null or undefined (expect.anything() semantics)', () => {
    const matcher = anyValue()
    expect(matcher.asymmetricMatch(null)).toBe(false)
    expect(matcher.asymmetricMatch(undefined)).toBe(false)
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

  it('does not coerce number vs string (stays strict)', () => {
    expect(objectContaining({a: 1}).asymmetricMatch({a: '1'})).toBe(false)
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

describe('queryContaining', () => {
  it('coerces number and boolean expected values to strings', () => {
    const matcher = queryContaining({thumbnailWidth: 640, includeDrafts: true})
    expect(matcher.asymmetricMatch({thumbnailWidth: '640', includeDrafts: 'true'})).toBe(true)
  })

  it('matches partially, ignoring extra params', () => {
    const matcher = queryContaining({a: 1})
    expect(matcher.asymmetricMatch({a: '1', b: '2'})).toBe(true)
  })

  it('matches plain string expected values', () => {
    expect(queryContaining({a: 'x'}).asymmetricMatch({a: 'x'})).toBe(true)
  })

  it('rejects when an expected key is missing', () => {
    expect(queryContaining({a: 1}).asymmetricMatch({b: '1'})).toBe(false)
  })

  it('rejects when a value does not match after coercion', () => {
    expect(queryContaining({a: 1}).asymmetricMatch({a: '2'})).toBe(false)
  })

  it('rejects non-record input', () => {
    expect(queryContaining({a: 1}).asymmetricMatch(null)).toBe(false)
    expect(queryContaining({a: 1}).asymmetricMatch('a=1')).toBe(false)
  })

  it('matches an array-valued param (containing)', () => {
    expect(queryContaining({tags: ['a', 'b']}).asymmetricMatch({tags: ['a', 'b', 'c']})).toBe(true)
  })

  it('rejects an array param when a value is missing', () => {
    expect(queryContaining({tags: ['a', 'z']}).asymmetricMatch({tags: ['a', 'b']})).toBe(false)
  })

  it('rejects an array expected against a scalar actual', () => {
    expect(queryContaining({tags: ['a']}).asymmetricMatch({tags: 'a'})).toBe(false)
  })

  it('coerces array element types', () => {
    expect(queryContaining({ids: [1, 2]}).asymmetricMatch({ids: ['1', '2']})).toBe(true)
  })

  it('still matches scalar params (unchanged)', () => {
    expect(queryContaining({limit: 10}).asymmetricMatch({limit: '10'})).toBe(true)
  })
})

describe('bodyBytes', () => {
  it('matches a Uint8Array with equal bytes', () => {
    expect(bodyBytes(new Uint8Array([1, 2, 3])).asymmetricMatch(new Uint8Array([1, 2, 3]))).toBe(
      true,
    )
  })

  it('rejects differing bytes', () => {
    expect(bodyBytes(new Uint8Array([1, 2, 3])).asymmetricMatch(new Uint8Array([1, 9, 3]))).toBe(
      false,
    )
  })

  it('rejects a non-Uint8Array actual', () => {
    expect(bodyBytes(new Uint8Array([1, 2, 3])).asymmetricMatch('123')).toBe(false)
    expect(bodyBytes(new Uint8Array([1, 2, 3])).asymmetricMatch(new ArrayBuffer(3))).toBe(false)
  })

  it('accepts an ArrayBuffer as the expected value', () => {
    const buffer = new Uint8Array([7, 8, 9]).buffer
    expect(bodyBytes(buffer).asymmetricMatch(new Uint8Array([7, 8, 9]))).toBe(true)
  })

  it('has a readable toString', () => {
    expect(String(bodyBytes(new Uint8Array([1, 2, 3])))).toBe('bodyBytes(3 bytes)')
  })
})

describe('deepMatch with Uint8Array', () => {
  it('matches equal byte arrays', () => {
    expect(deepMatch(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
  })

  it('rejects differing byte arrays', () => {
    expect(deepMatch(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3]))).toBe(false)
    expect(deepMatch(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false)
  })

  it('rejects a Uint8Array against a non-Uint8Array', () => {
    expect(deepMatch(new Uint8Array([1]), {0: 1})).toBe(false)
    expect(deepMatch({0: 1}, new Uint8Array([1]))).toBe(false)
  })

  it('matches nested bytes inside an object', () => {
    expect(
      deepMatch(
        {name: 'a', bytes: new Uint8Array([1, 2])},
        {name: 'a', bytes: new Uint8Array([1, 2])},
      ),
    ).toBe(true)
    expect(
      deepMatch(
        {name: 'a', bytes: new Uint8Array([1, 2])},
        {name: 'a', bytes: new Uint8Array([9, 9])},
      ),
    ).toBe(false)
  })
})
