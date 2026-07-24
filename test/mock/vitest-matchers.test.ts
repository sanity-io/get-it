import '../../src/_exports/vitest'

import {createRequester} from 'get-it'
import {describe, expect, it} from 'vitest'

import {createMockFetch, type RecordedRequest} from '../../src/mock/createMockFetch'
import {anyValue, objectContaining, stringMatching} from '../../src/mock/matchers'

describe('vitest custom matchers', () => {
  describe('MockFetch matchers', () => {
    describe('toHaveReceivedRequest', () => {
      it('passes when request was made', async () => {
        const mock = createMockFetch()
        mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', as: 'json'})

        expect(mock).toHaveReceivedRequest('GET', '/api/docs')
      })

      it('fails when request was not made', () => {
        const mock = createMockFetch()
        mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

        expect(() => {
          expect(mock).toHaveReceivedRequest('GET', '/api/docs')
        }).toThrow('Expected MockFetch to have received GET /api/docs')
      })

      it('matches with body using objectContaining', async () => {
        const mock = createMockFetch()
        mock
          .on('POST', '/api/docs', {body: objectContaining({title: 'Hello'})})
          .respond({status: 201, body: {id: '1'}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({
          url: '/api/docs',
          method: 'POST',
          body: {title: 'Hello', extra: true},
          as: 'json',
        })

        expect(mock).toHaveReceivedRequest('POST', '/api/docs', {
          body: objectContaining({title: 'Hello'}),
        })
      })

      it('does not match full expected URLs with a different origin', async () => {
        const mock = createMockFetch()
        mock.on('GET', 'https://wrong.example/api/docs').respond({status: 200, body: {}})

        const request = createRequester({
          base: 'https://wrong.example',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', as: 'json'})

        expect(() => {
          expect(mock).toHaveReceivedRequest('GET', 'https://right.example/api/docs')
        }).toThrow('Expected MockFetch to have received GET https://right.example/api/docs')
      })
    })

    describe('toHaveReceivedRequestTimes', () => {
      it('checks request count', async () => {
        const mock = createMockFetch()
        mock.on('GET', '/api/docs').respondPersist({status: 200, body: {items: []}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', as: 'json'})
        await request({url: '/api/docs', as: 'json'})
        await request({url: '/api/docs', as: 'json'})

        expect(mock).toHaveReceivedRequestTimes('GET', '/api/docs', 3)
      })

      it('fails when count does not match', async () => {
        const mock = createMockFetch()
        mock.on('GET', '/api/docs').respondPersist({status: 200, body: {items: []}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', as: 'json'})

        expect(() => {
          expect(mock).toHaveReceivedRequestTimes('GET', '/api/docs', 2)
        }).toThrow('received 1 time(s)')
      })

      it('does not count full expected URLs with a different origin', async () => {
        const mock = createMockFetch()
        mock.on('GET', 'https://wrong.example/api/docs').respond({status: 200, body: {}})

        const request = createRequester({
          base: 'https://wrong.example',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', as: 'json'})

        expect(mock).toHaveReceivedRequestTimes('GET', 'https://right.example/api/docs', 0)
      })
    })

    describe('toHaveConsumedAllMocks', () => {
      it('passes when all consumed', async () => {
        const mock = createMockFetch()
        mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', as: 'json'})

        expect(mock).toHaveConsumedAllMocks()
      })

      it('fails when mocks remain', () => {
        const mock = createMockFetch()
        mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

        expect(() => {
          expect(mock).toHaveConsumedAllMocks()
        }).toThrow('unconsumed')
      })
    })
  })

  describe('RecordedRequest matchers', () => {
    describe('toHaveHeader', () => {
      async function recordRequest(headers?: Record<string, string>): Promise<RecordedRequest> {
        const mock = createMockFetch()
        mock.on('POST', '/api/docs').respond({status: 201, body: {id: '1'}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({
          url: '/api/docs',
          method: 'POST',
          body: {title: 'Hello'},
          headers,
          as: 'json',
        })

        const [recorded] = mock.getRequests()
        if (!recorded) throw new Error('No request was recorded')
        return recorded
      }

      it('matches exact header value', async () => {
        const recorded = await recordRequest()
        expect(recorded).toHaveHeader('content-type', 'application/json')
      })

      it('matches header with asymmetric matcher', async () => {
        const recorded = await recordRequest()
        expect(recorded).toHaveHeader('content-type', expect.stringContaining('json'))
      })

      it('does not match a missing header, even with anyValue()', async () => {
        const recorded = await recordRequest()
        expect(recorded).not.toHaveHeader('x-missing', anyValue())
        expect(() => {
          expect(recorded).toHaveHeader('x-missing', anyValue())
        }).toThrow('not set')
      })

      it('does not match a missing header with expect.anything()', async () => {
        const recorded = await recordRequest()
        expect(recorded).not.toHaveHeader('x-missing', expect.anything())
      })

      it('asserts header presence when called without a value', async () => {
        const recorded = await recordRequest({'x-custom-token': 'abc123'})
        expect(recorded).toHaveHeader('x-custom-token')
        expect(recorded).toHaveHeader('X-Custom-Token')
      })

      it('asserts header absence via .not without a value', async () => {
        const recorded = await recordRequest()
        expect(recorded).not.toHaveHeader('x-missing')
        expect(() => {
          expect(recorded).toHaveHeader('x-missing')
        }).toThrow('not set')
      })

      it('fails the negated presence check when the header exists', async () => {
        const recorded = await recordRequest({'x-custom-token': 'abc123'})
        expect(() => {
          expect(recorded).not.toHaveHeader('x-custom-token')
        }).toThrow('abc123')
      })

      it('matches header name with an asymmetric matcher', async () => {
        const recorded = await recordRequest({'x-custom-token': 'abc123'})
        expect(recorded).toHaveHeader(stringMatching(/^x-custom-/), 'abc123')
        expect(recorded).toHaveHeader(expect.stringContaining('custom'), 'abc123')
      })

      it('matches any header name for a given value with anyValue()', async () => {
        const recorded = await recordRequest({'x-custom-token': 'abc123'})
        expect(recorded).toHaveHeader(anyValue(), 'abc123')
        expect(recorded).not.toHaveHeader(anyValue(), 'value-no-header-has')
      })

      it('matches name matcher without a value (presence of any matching header)', async () => {
        const recorded = await recordRequest({'x-custom-token': 'abc123'})
        expect(recorded).toHaveHeader(stringMatching(/^x-custom-/))
        expect(recorded).not.toHaveHeader(stringMatching(/^x-nothing-/))
      })

      it('requires both name matcher and value to match the same header', async () => {
        const recorded = await recordRequest({'x-custom-token': 'abc123'})
        expect(recorded).not.toHaveHeader(stringMatching(/^x-custom-/), 'application/json')
      })

      it('matches asymmetric header names against lowercased names', async () => {
        const recorded = await recordRequest({'X-Custom-Token': 'abc123'})
        expect(recorded).toHaveHeader(stringMatching(/^x-custom-token$/), 'abc123')
        expect(recorded).not.toHaveHeader(stringMatching(/^X-Custom-Token$/), 'abc123')
      })
    })

    describe('toHaveBody', () => {
      it('matches exact body', async () => {
        const mock = createMockFetch()
        mock.on('POST', '/api/docs').respond({status: 201, body: {id: '1'}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', method: 'POST', body: {title: 'Hello'}, as: 'json'})

        const requests = mock.getRequests()
        expect(requests[0]).toHaveBody({title: 'Hello'})
      })

      it('matches body with objectContaining', async () => {
        const mock = createMockFetch()
        mock.on('POST', '/api/docs').respond({status: 201, body: {id: '1'}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({
          url: '/api/docs',
          method: 'POST',
          body: {title: 'Hello', extra: true},
          as: 'json',
        })

        const requests = mock.getRequests()
        expect(requests[0]).toHaveBody(objectContaining({title: 'Hello'}))
      })
    })

    describe('toHaveQuery', () => {
      it('matches exact query', async () => {
        const mock = createMockFetch()
        mock.on('GET', '/api/docs').respondPersist({status: 200, body: {items: []}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', query: {limit: '10', offset: '0'}, as: 'json'})

        const requests = mock.getRequests()
        expect(requests[0]).toHaveQuery({limit: '10', offset: '0'})
      })
    })

    describe('toHaveMethod', () => {
      it('matches method string', async () => {
        const mock = createMockFetch()
        mock.on('DELETE', '/api/docs/123').respond({status: 204})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs/123', method: 'DELETE'})

        const requests = mock.getRequests()
        expect(requests[0]).toHaveMethod('DELETE')
      })
    })

    describe('toHaveUrl', () => {
      it('matches URL path', async () => {
        const mock = createMockFetch()
        mock.on('GET', '/api/docs').respond({status: 200, body: {items: []}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', as: 'json'})

        const requests = mock.getRequests()
        expect(requests[0]).toHaveUrl('/api/docs')
      })
    })
  })
})
