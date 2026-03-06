import {createBufferedResponse} from 'get-it'
import {describe, expect, it} from 'vitest'

describe('createBufferedResponse', () => {
  it('exposes status, statusText, headers', () => {
    const res = createBufferedResponse(200, 'OK', new Headers({'x-test': '1'}), new Uint8Array())
    expect(res.status).toBe(200)
    expect(res.statusText).toBe('OK')
    expect(res.headers.get('x-test')).toBe('1')
  })

  it('body is the raw Uint8Array', () => {
    const bytes = new TextEncoder().encode('hello')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.body).toEqual(bytes)
  })

  it('.text() decodes body as UTF-8 string', () => {
    const bytes = new TextEncoder().encode('hello world')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.text()).toBe('hello world')
  })

  it('.json() parses body as JSON', () => {
    const bytes = new TextEncoder().encode('{"name":"espen"}')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.json()).toEqual({name: 'espen'})
  })

  it('.bytes() returns the same Uint8Array', () => {
    const bytes = new TextEncoder().encode('data')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.bytes()).toBe(bytes)
  })

  it('.json() and .text() can be called multiple times', () => {
    const bytes = new TextEncoder().encode('"hello"')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(res.json()).toBe('hello')
    expect(res.json()).toBe('hello')
    expect(res.text()).toBe('"hello"')
  })

  it('.json() throws on invalid JSON', () => {
    const bytes = new TextEncoder().encode('not json')
    const res = createBufferedResponse(200, 'OK', new Headers(), bytes)
    expect(() => res.json()).toThrow()
  })

  it('handles empty body', () => {
    const res = createBufferedResponse(204, 'No Content', new Headers(), new Uint8Array())
    expect(res.text()).toBe('')
    expect(res.bytes()).toEqual(new Uint8Array())
  })
})
