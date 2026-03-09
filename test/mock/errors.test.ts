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
