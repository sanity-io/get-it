import {createRequester} from 'get-it'
import {describe, expect, it} from 'vitest'

import {createMockFetch} from '../../src/mock/createMockFetch'
import {MockFetchError} from '../../src/mock/errors'
import {
  anyValue,
  arrayContaining,
  objectContaining,
  stringMatching,
} from '../../src/mock/matchers'

describe('createMockFetch', () => {
  describe('basic matching', () => {
    it('matches a simple GET request', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs', as: 'json'})
      expect(res.body).toEqual({items: []})
    })

    it('matches POST with JSON body', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/api/docs', {body: {title: 'Hello'}}).respond({
        status: 201,
        body: {id: '1', title: 'Hello'},
      })

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs', method: 'POST', body: {title: 'Hello'}, as: 'json'})
      expect(res.body).toEqual({id: '1', title: 'Hello'})
    })

    it('matches with query params specified as option', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs', {query: {limit: '10'}}).respond({
        status: 200,
        body: {items: []},
      })

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs', query: {limit: '10'}, as: 'json'})
      expect(res.body).toEqual({items: []})
    })

    it('matches with query params in URL pattern', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs?limit=10').respond({
        status: 200,
        body: {items: []},
      })

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs', query: {limit: '10'}, as: 'json'})
      expect(res.body).toEqual({items: []})
    })

    it('is strict on query params by default', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs', {query: {limit: '10'}}).respond({
        status: 200,
        body: {items: []},
      })

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      try {
        await request({url: '/api/docs', query: {limit: 10, offset: 0}, as: 'json'})
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.method).toBe('GET')
      }
    })

    it('is strict on body by default', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/api/docs', {body: {title: 'Hello'}}).respond({
        status: 201,
        body: {id: '1'},
      })

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      try {
        await request({
          url: '/api/docs',
          method: 'POST',
          body: {title: 'Hello', extra: true},
          as: 'json',
        })
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.method).toBe('POST')
      }
    })
  })

  describe('loose matching', () => {
    it('matches with objectContaining on body', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/api/docs', {body: objectContaining({title: 'Hello'})})
        .respond({status: 201, body: {id: '1'}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({
        url: '/api/docs',
        method: 'POST',
        body: {title: 'Hello', extra: true},
        as: 'json',
      })
      expect(res.body).toEqual({id: '1'})
    })

    it('matches with objectContaining on query', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/api/docs', {query: objectContaining({limit: '10'})})
        .respond({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({
        url: '/api/docs',
        query: {limit: '10', offset: '0'},
        as: 'json',
      })
      expect(res.body).toEqual({items: []})
    })

    it('matches with anyValue', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/api/docs', {body: objectContaining({title: anyValue()})})
        .respond({status: 201, body: {id: '1'}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({
        url: '/api/docs',
        method: 'POST',
        body: {title: 42},
        as: 'json',
      })
      expect(res.body).toEqual({id: '1'})
    })

    it('matches with stringMatching', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/api/docs', {body: objectContaining({title: stringMatching(/^Hello/)})})
        .respond({status: 201, body: {id: '1'}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({
        url: '/api/docs',
        method: 'POST',
        body: {title: 'Hello World'},
        as: 'json',
      })
      expect(res.body).toEqual({id: '1'})
    })

    it('matches with arrayContaining', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/api/docs', {body: objectContaining({tags: arrayContaining(['a', 'b'])})})
        .respond({status: 201, body: {id: '1'}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({
        url: '/api/docs',
        method: 'POST',
        body: {tags: ['a', 'b', 'c']},
        as: 'json',
      })
      expect(res.body).toEqual({id: '1'})
    })
  })

  describe('URL patterns', () => {
    it('matches glob patterns', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs/*/revisions').respond({status: 200, body: {revisions: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs/abc123/revisions', as: 'json'})
      expect(res.body).toEqual({revisions: []})
    })

    it('matches function predicates', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', (url) => url.startsWith('/api/docs/'))
        .respond({status: 200, body: {found: true}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs/anything', as: 'json'})
      expect(res.body).toEqual({found: true})
    })
  })

  describe('one-shot responses', () => {
    it('consumes responses in order', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/api/docs')
        .respond({status: 500, body: {error: 'fail'}})
        .respond({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res1 = await request({url: '/api/docs', as: 'json'})
      expect(res1.status).toBe(500)

      const res2 = await request({url: '/api/docs', as: 'json'})
      expect(res2.status).toBe(200)
    })

    it('throws when all responses are consumed', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      // Consume the only response
      await request({url: '/api/docs', as: 'json'})

      try {
        await request({url: '/api/docs', as: 'json'})
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.message).toContain('No mock matched')
      }
    })
  })

  describe('respondPersist', () => {
    it('responds to repeated requests', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respondPersist({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      for (let i = 0; i < 3; i++) {
        const res = await request({url: '/api/docs', as: 'json'})
        expect(res.status).toBe(200)
        expect(res.body).toEqual({items: []})
      }
    })
  })

  describe('onAny', () => {
    it('matches any HTTP method', async () => {
      const mock = createMockFetch()
      mock.onAny('/api/docs').respondPersist({status: 200, body: {ok: true}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const getRes = await request({url: '/api/docs', method: 'GET', as: 'json'})
      expect(getRes.body).toEqual({ok: true})

      const postRes = await request({url: '/api/docs', method: 'POST', body: {x: 1}, as: 'json'})
      expect(postRes.body).toEqual({ok: true})

      const deleteRes = await request({url: '/api/docs', method: 'DELETE', as: 'json'})
      expect(deleteRes.body).toEqual({ok: true})
    })
  })

  describe('request recording', () => {
    it('records all requests', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respondPersist({status: 200, body: {items: []}})
      mock.on('POST', '/api/docs').respondPersist({status: 201, body: {id: '1'}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      await request({url: '/api/docs', as: 'json'})
      await request({url: '/api/docs', method: 'POST', body: {title: 'Hello'}, as: 'json'})

      const requests = mock.getRequests()
      expect(requests).toHaveLength(2)
      expect(requests[0].method).toBe('GET')
      expect(requests[0].url).toBe('/api/docs')
      expect(requests[0].fullUrl).toBe('https://api.example.com/api/docs')
      expect(requests[0].headers).toBeInstanceOf(Headers)
      expect(requests[1].method).toBe('POST')
      expect(requests[1].url).toBe('/api/docs')
      expect(requests[1].fullUrl).toBe('https://api.example.com/api/docs')
      expect(requests[1].headers).toBeInstanceOf(Headers)
      expect(requests[1].headers.get('content-type')).toBe('application/json')
      expect(requests[1].body).toEqual({title: 'Hello'})
    })

    it('records query params separately', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respondPersist({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      await request({url: '/api/docs', query: {limit: '10', offset: '0'}, as: 'json'})

      const requests = mock.getRequests()
      expect(requests).toHaveLength(1)
      expect(requests[0].url).toBe('/api/docs')
      expect(requests[0].fullUrl).toBe('https://api.example.com/api/docs?limit=10&offset=0')
      expect(requests[0].headers).toBeInstanceOf(Headers)
      expect(requests[0].query).toEqual({limit: '10', offset: '0'})
    })
  })

  describe('assertAllConsumed', () => {
    it('passes when all mocks are consumed', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      await request({url: '/api/docs', as: 'json'})

      // Should not throw
      mock.assertAllConsumed()
    })

    it('throws when mocks remain unconsumed', () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})
      mock.on('POST', '/api/docs').respond({status: 201, body: {id: '1'}})

      try {
        mock.assertAllConsumed()
        expect.fail('Expected error to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof Error)) throw err
        expect(err.message).toContain('unconsumed')
      }
    })
  })

  describe('clear', () => {
    it('removes all handlers and recorded requests', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respondPersist({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      await request({url: '/api/docs', as: 'json'})
      expect(mock.getRequests()).toHaveLength(1)

      mock.clear()

      expect(mock.getRequests()).toHaveLength(0)

      // After clear, the old handler should be gone
      try {
        await request({url: '/api/docs', as: 'json'})
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.message).toContain('No mock matched')
      }
    })
  })

  describe('unmatched request errors', () => {
    it('throws MockFetchError with details', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs', {query: {limit: '20'}}).respond({
        status: 200,
        body: {items: []},
      })

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      try {
        await request({url: '/api/docs', query: {limit: '10'}, as: 'json'})
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.method).toBe('GET')
        expect(err.url).toBe('/api/docs')
        expect(err.message).toContain('Closest mock')
        expect(err.message).toContain('Differences')
      }
    })

    it('shows exhausted mocks in error', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      // Consume the response
      await request({url: '/api/docs', as: 'json'})

      try {
        await request({url: '/api/docs', as: 'json'})
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.message).toContain('exhausted')
      }
    })
  })

  describe('response headers', () => {
    it('sets content-type for JSON body responses', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs'})
      expect(res.headers.get('content-type')).toBe('application/json')
    })

    it('uses custom statusText when provided', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 200, statusText: 'All Good', body: {items: []}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs'})
      expect(res.statusText).toBe('All Good')
    })

    it('falls back to auto-derived statusText', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({status: 404, body: null})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs'})
      expect(res.statusText).toBe('Not Found')
    })

    it('includes custom response headers', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respond({
        status: 200,
        body: {items: []},
        headers: {'x-request-id': 'abc123'},
      })

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/api/docs'})
      expect(res.headers.get('x-request-id')).toBe('abc123')
      expect(res.headers.get('content-type')).toBe('application/json')
    })
  })
})
