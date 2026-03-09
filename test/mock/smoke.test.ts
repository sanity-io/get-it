import {createRequester} from 'get-it'
import {createMockFetch, MockFetchError, objectContaining} from 'get-it/mock'
import {describe, expect, it} from 'vitest'

describe('get-it/mock smoke test', () => {
  it('works end-to-end via public import', async () => {
    const mock = createMockFetch()
    const request = createRequester({fetch: mock.fetch, base: 'https://api.example.com'})

    mock
      .on('POST', '/api/docs', {body: objectContaining({_type: 'post'})})
      .respond({status: 201, body: {id: 'abc'}})

    const res = await request({
      url: '/api/docs',
      body: {_type: 'post', title: 'Hello'},
      as: 'json',
    })

    expect(res.body).toEqual({id: 'abc'})
    expect(mock.getRequests()).toHaveLength(1)
    mock.assertAllConsumed()
  })

  it('MockFetchError is importable and instanceof works', async () => {
    const mock = createMockFetch()
    const request = createRequester({
      fetch: mock.fetch,
      base: 'https://api.example.com',
    })

    try {
      await request({url: '/api/nothing'})
      expect.unreachable('should have thrown')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(MockFetchError)
    }
  })
})
