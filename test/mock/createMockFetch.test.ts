import {createRequester} from 'get-it'
import {retry} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {createMockFetch} from '../../src/mock/createMockFetch'
import {MockFetchError} from '../../src/mock/errors'
import {
  anyValue,
  arrayContaining,
  bodyBytes,
  objectContaining,
  queryContaining,
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

      const res = await request({
        url: '/api/docs',
        method: 'POST',
        body: {title: 'Hello'},
        as: 'json',
      })
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

    it('does not serialize asymmetric query matcher internals in error output', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs', {query: queryContaining({limit: 20})}).respond({
        status: 200,
        body: {items: []},
      })

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      try {
        await request({url: '/api/docs', as: 'json'})
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.message).not.toContain('asymmetricMatch')
        expect(err.message).toContain('<asymmetric query matcher>')
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

  describe('full URL matching', () => {
    it('matches when handler uses full URL', async () => {
      const mock = createMockFetch()
      mock.on('GET', 'https://api.example.com/api/docs').respond({status: 200, body: {items: []}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      const res = await request({url: 'https://api.example.com/api/docs', as: 'json'})
      expect(res.body).toEqual({items: []})
    })

    it('does not match different origins', async () => {
      const mock = createMockFetch()
      mock.on('GET', 'https://api.example.com/api/docs').respond({status: 200, body: {items: []}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      try {
        await request({url: 'https://other.example.com/api/docs', as: 'json'})
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.message).toContain('No mock matched')
      }
    })

    it('error message includes origin in diff', async () => {
      const mock = createMockFetch()
      mock.on('GET', 'https://api.example.com/api/docs').respond({status: 200, body: {items: []}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      try {
        await request({url: 'https://other.example.com/api/docs', as: 'json'})
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.message).toContain('origin')
        expect(err.message).toContain('https://api.example.com')
      }
    })
  })

  describe('scope', () => {
    it('scoped handlers only match their origin', async () => {
      const mock = createMockFetch()
      const api = mock.scope('https://api.example.com')
      api.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      // Should match the scoped origin
      const res = await request({url: 'https://api.example.com/api/docs', as: 'json'})
      expect(res.body).toEqual({items: []})

      // Should NOT match a different origin
      try {
        await request({url: 'https://other.example.com/api/docs', as: 'json'})
        expect.fail('Expected MockFetchError to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof MockFetchError)) throw err
        expect(err.message).toContain('No mock matched')
      }
    })

    it('unscoped handlers match any origin', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/api/docs').respondPersist({status: 200, body: {items: []}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      // Should match any origin
      const res1 = await request({url: 'https://api.example.com/api/docs', as: 'json'})
      expect(res1.body).toEqual({items: []})

      const res2 = await request({url: 'https://other.example.com/api/docs', as: 'json'})
      expect(res2.body).toEqual({items: []})
    })

    it('scope.getRequests() only returns requests to that origin', async () => {
      const mock = createMockFetch()
      const api = mock.scope('https://api.example.com')
      api.on('GET', '/api/docs').respond({status: 200, body: {items: []}})
      mock.on('GET', '/api/docs').respond({status: 200, body: {other: true}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      await request({url: 'https://api.example.com/api/docs', as: 'json'})
      await request({url: 'https://other.example.com/api/docs', as: 'json'})

      const scopedRequests = api.getRequests()
      expect(scopedRequests).toHaveLength(1)
      expect(scopedRequests[0].url).toBe('/api/docs')
      expect(scopedRequests[0].fullUrl).toBe('https://api.example.com/api/docs')
    })

    it('mock.getRequests() returns all requests including scoped', async () => {
      const mock = createMockFetch()
      const api = mock.scope('https://api.example.com')
      api.on('GET', '/api/docs').respond({status: 200, body: {items: []}})
      mock.on('GET', '/api/docs').respond({status: 200, body: {other: true}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      await request({url: 'https://api.example.com/api/docs', as: 'json'})
      await request({url: 'https://other.example.com/api/docs', as: 'json'})

      expect(mock.getRequests()).toHaveLength(2)
    })

    it('scope.assertAllConsumed() only checks scoped handlers', async () => {
      const mock = createMockFetch()
      const api = mock.scope('https://api.example.com')
      api.on('GET', '/api/docs').respond({status: 200, body: {items: []}})
      mock.on('GET', '/other').respond({status: 200, body: {other: true}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      // Consume only the scoped handler
      await request({url: 'https://api.example.com/api/docs', as: 'json'})

      // Scoped assertAllConsumed should pass (scoped handler is consumed)
      api.assertAllConsumed()

      // Root assertAllConsumed should fail (unscoped handler is not consumed)
      try {
        mock.assertAllConsumed()
        expect.fail('Expected error to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof Error)) throw err
        expect(err.message).toContain('unconsumed')
      }
    })

    it('multiple scopes work independently', async () => {
      const mock = createMockFetch()
      const api = mock.scope('https://abc123.api.sanity.io')
      const cdn = mock.scope('https://abc123.apicdn.sanity.io')

      api.on('POST', '/v1/data/mutate/prod').respond({status: 200, body: {transactionId: 'tx1'}})
      cdn.on('GET', '/v1/data/query/prod').respond({status: 200, body: {result: []}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      const mutateRes = await request({
        url: 'https://abc123.api.sanity.io/v1/data/mutate/prod',
        method: 'POST',
        body: {mutations: []},
        as: 'json',
      })
      expect(mutateRes.body).toEqual({transactionId: 'tx1'})

      const queryRes = await request({
        url: 'https://abc123.apicdn.sanity.io/v1/data/query/prod',
        as: 'json',
      })
      expect(queryRes.body).toEqual({result: []})

      // Each scope only sees its own requests
      expect(api.getRequests()).toHaveLength(1)
      expect(api.getRequests()[0].url).toBe('/v1/data/mutate/prod')
      expect(cdn.getRequests()).toHaveLength(1)
      expect(cdn.getRequests()[0].url).toBe('/v1/data/query/prod')

      // Root sees all
      expect(mock.getRequests()).toHaveLength(2)
    })

    it('scope works with query params and body matching', async () => {
      const mock = createMockFetch()
      const api = mock.scope('https://api.example.com')
      api
        .on('POST', '/api/docs', {query: {draft: 'true'}, body: {title: 'Hello'}})
        .respond({status: 201, body: {id: '1'}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      const res = await request({
        url: 'https://api.example.com/api/docs',
        method: 'POST',
        query: {draft: 'true'},
        body: {title: 'Hello'},
        as: 'json',
      })
      expect(res.body).toEqual({id: '1'})
    })

    it('scope.onAny() matches any method for that origin', async () => {
      const mock = createMockFetch()
      const api = mock.scope('https://api.example.com')
      api.onAny('/api/docs').respondPersist({status: 200, body: {ok: true}})

      const request = createRequester({fetch: mock.fetch, httpErrors: false})

      const getRes = await request({
        url: 'https://api.example.com/api/docs',
        method: 'GET',
        as: 'json',
      })
      expect(getRes.body).toEqual({ok: true})

      const postRes = await request({
        url: 'https://api.example.com/api/docs',
        method: 'POST',
        body: {x: 1},
        as: 'json',
      })
      expect(postRes.body).toEqual({ok: true})
    })

    it('throws when scope() is called with a relative URL', () => {
      const mock = createMockFetch()
      try {
        mock.scope('/api')
        expect.fail('Expected error to be thrown')
      } catch (err: unknown) {
        if (!(err instanceof Error)) throw err
        expect(err.message).toContain('scope() requires a full URL with origin')
      }
    })
  })

  describe('respondWithError', () => {
    it('rejects with the provided error instance, preserving name/message/cause', async () => {
      const mock = createMockFetch()
      const cause = {code: 'ECONNRESET'}
      const boom = new TypeError('fetch failed', {cause})
      mock.on('GET', '/x').respondWithError(boom)

      let error: unknown
      try {
        await mock.fetch('https://api.example.com/x')
      } catch (err: unknown) {
        error = err
      }

      expect(error).toBeInstanceOf(TypeError)
      expect(error).toBe(boom)
      if (!(error instanceof Error)) throw new Error('expected an Error')
      expect(error.name).toBe('TypeError')
      expect(error.message).toBe('fetch failed')
      expect(error.cause).toBe(cause)
    })

    it('invokes a factory once per consumption, yielding fresh instances', async () => {
      const mock = createMockFetch()
      let calls = 0
      mock.onAny('/x').respondWithErrorPersist(() => new TypeError(`attempt ${++calls}`))

      let first: unknown
      let second: unknown
      try {
        await mock.fetch('https://h/x')
      } catch (err: unknown) {
        first = err
      }
      try {
        await mock.fetch('https://h/x')
      } catch (err: unknown) {
        second = err
      }

      if (!(first instanceof Error) || !(second instanceof Error)) {
        throw new Error('expected two Errors')
      }
      expect(first).not.toBe(second)
      expect(first.message).toBe('attempt 1')
      expect(second.message).toBe('attempt 2')
    })

    it('records the request even when it rejects', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/x').respondWithError(new TypeError('boom'))

      let threw = false
      try {
        await mock.fetch('https://h/x', {method: 'POST'})
      } catch {
        threw = true
      }

      expect(threw).toBe(true)
      const requests = mock.getRequests()
      expect(requests).toHaveLength(1)
      expect(requests[0].method).toBe('POST')
    })

    it('respondWithErrorPersist rejects on every matching request', async () => {
      const mock = createMockFetch()
      mock.onAny('/x').respondWithErrorPersist(new TypeError('down'))

      for (let i = 0; i < 3; i++) {
        let error: unknown
        try {
          await mock.fetch('https://h/x')
        } catch (err: unknown) {
          error = err
        }
        expect(error).toBeInstanceOf(TypeError)
      }
    })

    it('assertAllConsumed throws while an error response is unconsumed', () => {
      const mock = createMockFetch()
      mock.on('GET', '/x').respondWithError(new TypeError('boom'))
      expect(() => mock.assertAllConsumed()).toThrow(/unconsumed/)
    })

    it('assertAllConsumed passes once the error response is consumed', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/x').respondWithError(new TypeError('boom'))
      try {
        await mock.fetch('https://h/x')
      } catch {
        // expected rejection
      }
      expect(() => mock.assertAllConsumed()).not.toThrow()
    })

    it('respondWithErrorPersist leaves nothing unconsumed', async () => {
      const mock = createMockFetch()
      mock.onAny('/x').respondWithErrorPersist(new TypeError('down'))
      try {
        await mock.fetch('https://h/x')
      } catch {
        // expected rejection
      }
      expect(() => mock.assertAllConsumed()).not.toThrow()
    })

    it('queues an error then a success in order (retry-recovery shape)', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/x')
        .respondWithError(new TypeError('transient'))
        .respond({status: 200, body: {ok: true}})

      let error: unknown
      try {
        await mock.fetch('https://h/x')
      } catch (err: unknown) {
        error = err
      }
      expect(error).toBeInstanceOf(TypeError)

      const res = await mock.fetch('https://h/x')
      expect(res.status).toBe(200)
      mock.assertAllConsumed()
    })

    it('rejects through scope()', async () => {
      const mock = createMockFetch()
      mock
        .scope('https://api.example.com')
        .on('GET', '/x')
        .respondWithError(new TypeError('scoped boom'))

      let error: unknown
      try {
        await mock.fetch('https://api.example.com/x')
      } catch (err: unknown) {
        error = err
      }
      expect(error).toBeInstanceOf(TypeError)
    })
  })

  describe('respondWithError + retry middleware', () => {
    it('retries a mocked network error, then succeeds', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/flaky')
        .respondWithError(new TypeError('fetch failed', {cause: {code: 'ECONNRESET'}}))
        .respond({status: 200, body: {ok: true}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
        middleware: [retry({retryDelay: () => 0})],
      })

      const res = await request({url: '/flaky', as: 'json'})

      expect(res.body).toEqual({ok: true})
      expect(mock.getRequests()).toHaveLength(2)
      mock.assertAllConsumed()
    })

    it('exhausts retries and rejects with the network error', async () => {
      const mock = createMockFetch()
      mock
        .onAny('/permafail')
        .respondWithErrorPersist(new TypeError('fetch failed', {cause: {code: 'ECONNRESET'}}))

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
        middleware: [retry({maxRetries: 2, retryDelay: () => 0})],
      })

      let error: unknown
      try {
        await request({url: '/permafail'})
      } catch (err: unknown) {
        error = err
      }

      expect(error).toBeInstanceOf(TypeError)
      // initial attempt + 2 retries
      expect(mock.getRequests()).toHaveLength(3)
    })
  })

  describe('delay', () => {
    it('resolves the response after the configured delay', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/slow').respond({status: 200, body: {ok: true}, delay: 50})

      const start = Date.now()
      const res = await mock.fetch('https://api.example.com/slow', {method: 'GET'})
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(45)
      expect(res.status).toBe(200)
      expect(await res.text()).toBe(JSON.stringify({ok: true}))
    })

    it('resolves immediately when delay is 0 or omitted', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/zero').respond({status: 200, body: {a: 1}, delay: 0})
      mock.on('GET', '/none').respond({status: 200, body: {b: 2}})

      const start = Date.now()
      await mock.fetch('https://api.example.com/zero', {method: 'GET'})
      await mock.fetch('https://api.example.com/none', {method: 'GET'})
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(40)
    })

    it('rejects with the signal reason when aborted during the delay', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/slow').respond({status: 200, body: {ok: true}, delay: 1000})

      const controller = new AbortController()
      const promise = mock.fetch('https://api.example.com/slow', {
        method: 'GET',
        signal: controller.signal,
      })
      controller.abort()

      let error: unknown
      try {
        await promise
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(DOMException)
      if (!(error instanceof DOMException)) throw new Error('expected a DOMException')
      expect(error.name).toBe('AbortError')
    })

    it('propagates a custom abort reason', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/slow').respond({status: 200, body: {ok: true}, delay: 1000})

      const reason = new Error('boom')
      const controller = new AbortController()
      const promise = mock.fetch('https://api.example.com/slow', {
        method: 'GET',
        signal: controller.signal,
      })
      controller.abort(reason)

      let error: unknown
      try {
        await promise
      } catch (err) {
        error = err
      }
      expect(error).toBe(reason)
    })

    it('rejects immediately when the signal is already aborted', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/slow').respond({status: 200, body: {ok: true}, delay: 1000})

      const reason = new Error('already gone')
      const controller = new AbortController()
      controller.abort(reason)

      const start = Date.now()
      let error: unknown
      try {
        await mock.fetch('https://api.example.com/slow', {
          method: 'GET',
          signal: controller.signal,
        })
      } catch (err) {
        error = err
      }
      expect(Date.now() - start).toBeLessThan(40)
      expect(error).toBe(reason)
    })

    it('surfaces a timeout error when the get-it timeout is shorter than the delay', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/slow').respondPersist({status: 200, body: {ok: true}, delay: 1000})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const start = Date.now()
      let error: unknown
      try {
        await request({url: '/slow', timeout: 50, as: 'json'})
      } catch (err) {
        error = err
      }
      const elapsed = Date.now() - start

      // Should reject well before the 1000ms delay completes
      expect(elapsed).toBeLessThan(500)

      // AbortSignal.timeout() produces a DOMException with name 'TimeoutError'
      expect(error).toBeInstanceOf(Error)
      if (!(error instanceof Error)) throw error
      expect(error.name).toBe('TimeoutError')
    })
  })

  describe('query coercion', () => {
    it('matches numeric and boolean query option values against string request query', async () => {
      const mock = createMockFetch()
      mock
        .on('GET', '/playback-info', {query: {thumbnailWidth: 640, includeDrafts: true}})
        .respond({
          status: 200,
          body: {ok: true},
        })

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({
        url: '/playback-info',
        query: {thumbnailWidth: '640', includeDrafts: 'true'},
        as: 'json',
      })
      expect(res.body).toEqual({ok: true})
    })

    it('merges a URL-pattern query with a plain-record query option without throwing', async () => {
      const mock = createMockFetch()
      mock.on('GET', '/x?a=1', {query: {b: 2}}).respond({status: 200, body: {ok: true}})

      const request = createRequester({
        base: 'https://api.example.com',
        fetch: mock.fetch,
        httpErrors: false,
      })

      const res = await request({url: '/x', query: {a: '1', b: '2'}, as: 'json'})
      expect(res.body).toEqual({ok: true})
    })

    it('throws when combining a URL-pattern query with an asymmetric query matcher', () => {
      const mock = createMockFetch()
      let error: unknown
      try {
        mock.on('GET', '/x?a=1', {query: queryContaining({b: 2})})
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(Error)
      expect(error instanceof Error ? error.message : '').toContain(
        'Cannot combine a query string in the URL pattern',
      )
    })
  })

  describe('binary request bodies', () => {
    it('records and matches a Uint8Array body', async () => {
      const mock = createMockFetch()
      const bytes = new Uint8Array([1, 2, 3, 4])
      mock.on('POST', '/upload', {body: bytes}).respond({status: 201})

      const res = await mock.fetch('https://api.example.com/upload', {
        method: 'POST',
        body: new Uint8Array([1, 2, 3, 4]),
      })

      expect(res.status).toBe(201)
      expect(mock.getRequests()[0].body).toEqual(new Uint8Array([1, 2, 3, 4]))
    })

    it('records and matches an ArrayBuffer body', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload', {body: new Uint8Array([9, 8, 7]).buffer}).respond({status: 201})

      const res = await mock.fetch('https://api.example.com/upload', {
        method: 'POST',
        body: new Uint8Array([9, 8, 7]).buffer,
      })

      expect(res.status).toBe(201)
      expect(mock.getRequests()[0].body).toEqual(new Uint8Array([9, 8, 7]))
    })

    it('records and matches a ReadableStream body', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload', {body: new Uint8Array([1, 2, 3, 4, 5])}).respond({status: 201})

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.enqueue(new Uint8Array([4, 5]))
          controller.close()
        },
      })

      const res = await mock.fetch('https://api.example.com/upload', {method: 'POST', body: stream})

      expect(res.status).toBe(201)
      expect(mock.getRequests()[0].body).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
    })

    // `Buffer` is Node-only; skip where it is undefined (browser/edge/worker).
    it.skipIf(typeof Buffer === 'undefined')('records and matches a Buffer body', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload', {body: new Uint8Array([10, 20])}).respond({status: 201})

      const res = await mock.fetch('https://api.example.com/upload', {
        method: 'POST',
        body: Buffer.from([10, 20]),
      })

      expect(res.status).toBe(201)
      expect(mock.getRequests()[0].body).toEqual(new Uint8Array([10, 20]))
    })

    it('matches with the bodyBytes matcher', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/upload', {body: bodyBytes(new Uint8Array([1, 2, 3]))})
        .respond({status: 201})

      const res = await mock.fetch('https://api.example.com/upload', {
        method: 'POST',
        body: new Uint8Array([1, 2, 3]),
      })

      expect(res.status).toBe(201)
    })

    it('records a stable snapshot that later mutation cannot change', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload').respond({status: 201})

      const source = new Uint8Array([1, 2, 3])
      await mock.fetch('https://api.example.com/upload', {method: 'POST', body: source})
      source[0] = 99

      expect(mock.getRequests()[0].body).toEqual(new Uint8Array([1, 2, 3]))
    })

    it('renders a readable error when binary bodies differ', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload', {body: new Uint8Array([1, 2, 3])}).respond({status: 201})

      let error: unknown
      try {
        await mock.fetch('https://api.example.com/upload', {
          method: 'POST',
          body: new Uint8Array([9, 9, 9, 9]),
        })
      } catch (err) {
        error = err
      }

      expect(error).toBeInstanceOf(Error)
      if (!(error instanceof Error)) throw new Error('expected an error')
      expect(error.message).toContain(
        'body: expected Uint8Array(3 bytes), received Uint8Array(4 bytes)',
      )
    })

    it('renders a readable error when an ArrayBuffer body differs', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload', {body: new Uint8Array([1, 2, 3]).buffer}).respond({status: 201})

      let error: unknown
      try {
        await mock.fetch('https://api.example.com/upload', {
          method: 'POST',
          body: new Uint8Array([9, 9, 9, 9]),
        })
      } catch (err) {
        error = err
      }

      expect(error).toBeInstanceOf(Error)
      if (!(error instanceof Error)) throw new Error('expected an error')
      expect(error.message).toContain(
        'body: expected ArrayBuffer(3 bytes), received Uint8Array(4 bytes)',
      )
    })

    it('records an empty ReadableStream body as an empty Uint8Array', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload').respond({status: 201})

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      })

      const res = await mock.fetch('https://api.example.com/upload', {method: 'POST', body: stream})

      expect(res.status).toBe(201)
      expect(mock.getRequests()[0].body).toEqual(new Uint8Array(0))
    })
  })

  describe('Blob and File bodies', () => {
    it('records a Blob body as bytes and matches with bodyBytes', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/upload', {body: bodyBytes(new Uint8Array([1, 2, 3]))})
        .respond({status: 201})

      const res = await mock.fetch('https://api.example.com/upload', {
        method: 'POST',
        body: new Blob([new Uint8Array([1, 2, 3])]),
      })

      expect(res.status).toBe(201)
      expect(mock.getRequests()[0].body).toEqual(new Uint8Array([1, 2, 3]))
    })

    it('synthesizes content-type from blob.type, assertable via headers', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload', {headers: {'content-type': 'image/png'}}).respond({status: 201})

      const res = await mock.fetch('https://api.example.com/upload', {
        method: 'POST',
        body: new Blob([new Uint8Array([1])], {type: 'image/png'}),
      })

      expect(res.status).toBe(201)
      expect(mock.getRequests()[0].headers.get('content-type')).toBe('image/png')
    })

    it('does not synthesize content-type for a typeless Blob', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload').respond({status: 201})

      await mock.fetch('https://api.example.com/upload', {
        method: 'POST',
        body: new Blob([new Uint8Array([1])]),
      })

      expect(mock.getRequests()[0].headers.get('content-type')).toBe(null)
    })

    it('records a File body as bytes (name not recorded)', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload').respond({status: 201})

      await mock.fetch('https://api.example.com/upload', {
        method: 'POST',
        body: new File([new Uint8Array([7, 8])], 'a.bin', {type: 'application/octet-stream'}),
      })

      expect(mock.getRequests()[0].body).toEqual(new Uint8Array([7, 8]))
    })

    it('does not override an explicit content-type', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/upload').respond({status: 201})

      await mock.fetch('https://api.example.com/upload', {
        method: 'POST',
        headers: {'content-type': 'application/custom'},
        body: new Blob([new Uint8Array([1])], {type: 'image/png'}),
      })

      expect(mock.getRequests()[0].headers.get('content-type')).toBe('application/custom')
    })
  })

  describe('headers matching', () => {
    it('matches a header by plain record, case-insensitively', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/x', {headers: {'Content-Type': 'text/plain'}}).respond({status: 200})

      const res = await mock.fetch('https://api.example.com/x', {
        method: 'POST',
        headers: {'content-type': 'text/plain'},
        body: 'hi',
      })

      expect(res.status).toBe(200)
    })

    it('matches with objectContaining + stringMatching', async () => {
      const mock = createMockFetch()
      mock
        .on('POST', '/x', {headers: objectContaining({'content-type': stringMatching(/^text\//)})})
        .respond({status: 200})

      const res = await mock.fetch('https://api.example.com/x', {
        method: 'POST',
        headers: {'content-type': 'text/plain'},
        body: 'hi',
      })

      expect(res.status).toBe(200)
    })

    it('ignores unlisted headers (containing)', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/x', {headers: {'x-a': '1'}}).respond({status: 200})

      const res = await mock.fetch('https://api.example.com/x', {
        method: 'POST',
        headers: {'x-a': '1', 'x-b': '2'},
        body: 'hi',
      })

      expect(res.status).toBe(200)
    })

    it('reports a headers diff on mismatch', async () => {
      const mock = createMockFetch()
      mock.on('POST', '/x', {headers: {'x-a': '1'}}).respond({status: 200})

      let error: unknown
      try {
        await mock.fetch('https://api.example.com/x', {
          method: 'POST',
          headers: {'x-a': '2'},
          body: 'hi',
        })
      } catch (err) {
        error = err
      }

      expect(error).toBeInstanceOf(Error)
      if (!(error instanceof Error)) throw new Error('expected an error')
      expect(error.message).toContain('headers.x-a: expected "1", received "2"')
    })
  })
})
