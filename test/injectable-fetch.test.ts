import {createRequest} from 'get-it'
import {describe, expect, it} from 'vitest'

describe('injectable fetch', () => {
  it('uses injected fetch at instance level', async () => {
    let calledWith: string | undefined
    const fakeFetch = async (input: string) => {
      calledWith = input
      return new Response('mocked', {status: 200})
    }
    const request = createRequest({fetch: fakeFetch})
    const res = await request('https://example.com/test')
    expect(calledWith).toBe('https://example.com/test')
    expect(res.text()).toBe('mocked')
  })

  it('uses per-request fetch override', async () => {
    let instanceCalled = false
    let requestCalled = false
    const instanceFetch = async () => {
      instanceCalled = true
      return new Response('instance')
    }
    const requestFetch = async () => {
      requestCalled = true
      return new Response('request')
    }
    const request = createRequest({fetch: instanceFetch})
    const res = await request({url: 'https://example.com', fetch: requestFetch})
    expect(instanceCalled).toBe(false)
    expect(requestCalled).toBe(true)
    expect(res.text()).toBe('request')
  })

  it('falls back to globalThis.fetch', async () => {
    const request = createRequest({base: 'http://localhost:9980/req-test'})
    const res = await request('/plain-text')
    expect(res.status).toBe(200)
  })
})
