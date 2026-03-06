import {createRequest} from 'get-it'
import {describe, expect, it} from 'vitest'

const baseUrl = 'http://localhost:9980/req-test'

describe('createRequest - basics', () => {
  const request = createRequest()

  it('makes a GET request and returns a buffered response', async () => {
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
    expect(res.text()).toBe('Just some plain text for you to consume')
  })

  it('accepts a URL string', async () => {
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.status).toBe(200)
  })

  it('accepts an options object with url', async () => {
    const res = await request({url: `${baseUrl}/plain-text`})
    expect(res.status).toBe(200)
  })

  it('.json() parses JSON responses', async () => {
    const res = await request(`${baseUrl}/json`)
    expect(res.json()).toEqual({foo: 'bar'})
  })

  it('.bytes() returns raw Uint8Array', async () => {
    const res = await request(`${baseUrl}/plain-text`)
    expect(res.bytes()).toBeInstanceOf(Uint8Array)
  })

  it('sends POST with string body', async () => {
    const res = await request({
      url: `${baseUrl}/echo`,
      method: 'POST',
      body: 'hello',
    })
    expect(res.text()).toBe('hello')
  })

  it('exposes response headers', async () => {
    const res = await request(`${baseUrl}/headers`)
    expect(res.headers.get('x-custom-header')).toBe('supercustom')
  })

  it('returns status and statusText', async () => {
    const res = await request(`${baseUrl}/status?code=201`)
    expect(res.status).toBe(201)
  })
})
