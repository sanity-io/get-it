import {describe, expect, it} from 'vitest'

import {createBufferedResponse} from '../src/response'

const finalUrl = 'https://example.com/final'

describe('createBufferedResponse', () => {
  it('exposes status, statusText, headers', () => {
    const res = createBufferedResponse(
      200,
      'OK',
      new Headers({'x-test': '1'}),
      new Uint8Array(),
      finalUrl,
      true,
    )
    expect(res.status).toBe(200)
    expect(res.statusText).toBe('OK')
    expect(res.headers.get('x-test')).toBe('1')
    expect(res.url).toBe(finalUrl)
    expect(res.redirected).toBe(true)
  })

  it('body is the raw Uint8Array', () => {
    const bytes = new TextEncoder().encode('hello')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes, finalUrl, false)
    expect(res.body).toEqual(bytes)
  })

  it('.text() decodes body as UTF-8 string', () => {
    const bytes = new TextEncoder().encode('hello world')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes, finalUrl, false)
    expect(res.text()).toBe('hello world')
  })

  it('.json() parses body as JSON', () => {
    const bytes = new TextEncoder().encode('{"name":"espen"}')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes, finalUrl, false)
    expect(res.json()).toEqual({name: 'espen'})
  })

  it('.bytes() returns the same Uint8Array', () => {
    const bytes = new TextEncoder().encode('data')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes, finalUrl, false)
    expect(res.bytes()).toBe(bytes)
  })

  it('.json() and .text() can be called multiple times', () => {
    const bytes = new TextEncoder().encode('"hello"')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes, finalUrl, false)
    expect(res.json()).toBe('hello')
    expect(res.json()).toBe('hello')
    expect(res.text()).toBe('"hello"')
  })

  it('.json() throws on invalid JSON', () => {
    const bytes = new TextEncoder().encode('not json')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes, finalUrl, false)
    expect(() => res.json()).toThrow()
  })

  it('handles empty body', () => {
    const res = createBufferedResponse(
      204,
      'No Content',
      new Headers(),
      new Uint8Array(),
      finalUrl,
      false,
    )
    expect(res.text()).toBe('')
    expect(res.bytes()).toEqual(new Uint8Array())
  })

  it('json() throws on every call for invalid JSON (no stale cache)', () => {
    const bytes = new TextEncoder().encode('not json')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes, finalUrl, false)
    expect(() => res.json()).toThrow()
    expect(() => res.json()).toThrow()
  })

  it('text() returns same reference on repeated calls', () => {
    const bytes = new TextEncoder().encode('hello')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes, finalUrl, false)
    const first = res.text()
    const second = res.text()
    expect(first).toBe(second)
  })
})
