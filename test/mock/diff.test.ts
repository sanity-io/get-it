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
