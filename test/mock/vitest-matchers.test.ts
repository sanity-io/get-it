import {createRequester} from 'get-it'
import {describe, expect, it} from 'vitest'

import {createMockFetch} from '../../src/mock/createMockFetch'
import {objectContaining} from '../../src/mock/matchers'

import '../../src/_exports/vitest'

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
      it('matches exact header value', async () => {
        const mock = createMockFetch()
        mock.on('POST', '/api/docs').respond({status: 201, body: {id: '1'}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', method: 'POST', body: {title: 'Hello'}, as: 'json'})

        const requests = mock.getRequests()
        expect(requests[0]).toHaveHeader('content-type', 'application/json')
      })

      it('matches header with asymmetric matcher', async () => {
        const mock = createMockFetch()
        mock.on('POST', '/api/docs').respond({status: 201, body: {id: '1'}})

        const request = createRequester({
          base: 'https://api.example.com',
          fetch: mock.fetch,
          httpErrors: false,
        })

        await request({url: '/api/docs', method: 'POST', body: {title: 'Hello'}, as: 'json'})

        const requests = mock.getRequests()
        expect(requests[0]).toHaveHeader('content-type', expect.stringContaining('json'))
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
