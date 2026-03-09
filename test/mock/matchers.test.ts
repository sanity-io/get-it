import {describe, expect, it} from 'vitest'

import {
  anyValue,
  arrayContaining,
  objectContaining,
  stringMatching,
} from '../../src/mock/matchers'

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
