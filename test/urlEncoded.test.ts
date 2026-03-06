import {createRequest} from 'get-it'
import {urlEncoded} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

const baseUrl = 'http://localhost:9980/req-test'

describe('urlEncoded middleware', () => {
  it('encodes object body as x-www-form-urlencoded', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [urlEncoded()],
    })
    const res = await request({url: '/urlencoded', method: 'POST', body: {foo: 'bar', baz: 'qux'}})
    expect(res.json()).toEqual({foo: 'bar', baz: 'qux'})
  })

  it('sets content-type header', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [urlEncoded()],
    })
    const res = await request({url: '/debug', method: 'POST', body: {foo: 'bar'}})
    expect(res.json()).toHaveProperty(
      'headers.content-type',
      expect.stringContaining('application/x-www-form-urlencoded'),
    )
  })

  it('does not encode string bodies', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [urlEncoded()],
    })
    const res = await request({url: '/echo', method: 'POST', body: 'raw string'})
    expect(res.text()).toBe('raw string')
  })

  it('does not encode array bodies', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [urlEncoded()],
    })
    const res = await request({url: '/debug', method: 'POST', body: ['a', 'b']})
    expect(res.json()).toHaveProperty('headers.content-type', 'application/json')
  })

  it('does not override existing content-type', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [urlEncoded()],
    })
    const res = await request({
      url: '/debug',
      method: 'POST',
      body: {foo: 'bar'},
      headers: {'content-type': 'application/json'},
    })
    expect(res.json()).toHaveProperty('headers.content-type', 'application/json')
  })

  it('skips undefined values', async () => {
    const request = createRequest({
      base: baseUrl,
      middleware: [urlEncoded()],
    })
    const res = await request({
      url: '/urlencoded',
      method: 'POST',
      body: {foo: 'bar', skip: undefined},
    })
    const body = res.json()
    expect(body).toHaveProperty('foo', 'bar')
    expect(body).not.toHaveProperty('skip')
  })
})
