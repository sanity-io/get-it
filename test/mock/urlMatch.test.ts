import {describe, expect, it} from 'vitest'

import {matchUrl, parseUrl} from '../../src/mock/urlMatch'

describe('parseUrl', () => {
  it('splits path and query from a simple path', () => {
    const result = parseUrl('/api/docs')
    expect(result.origin).toBe('')
    expect(result.path).toBe('/api/docs')
    expect(result.query).toEqual({})
  })

  it('parses query params', () => {
    const result = parseUrl('/api/docs?limit=10&type=post')
    expect(result.origin).toBe('')
    expect(result.path).toBe('/api/docs')
    expect(result.query).toEqual({limit: '10', type: 'post'})
  })

  it('handles full URLs', () => {
    const result = parseUrl('https://api.example.com/api/docs?limit=10')
    expect(result.origin).toBe('https://api.example.com')
    expect(result.path).toBe('/api/docs')
    expect(result.query).toEqual({limit: '10'})
  })

  it('handles full URLs without query', () => {
    const result = parseUrl('https://api.example.com/api/docs')
    expect(result.origin).toBe('https://api.example.com')
    expect(result.path).toBe('/api/docs')
    expect(result.query).toEqual({})
  })

  it('extracts origin with port', () => {
    const result = parseUrl('https://localhost:3000/api/docs')
    expect(result.origin).toBe('https://localhost:3000')
    expect(result.path).toBe('/api/docs')
    expect(result.query).toEqual({})
  })

  it('extracts origin for http URLs', () => {
    const result = parseUrl('http://api.example.com/api/docs')
    expect(result.origin).toBe('http://api.example.com')
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
