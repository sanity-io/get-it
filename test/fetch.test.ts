import {adapter, getIt} from 'get-it'
import {jsonRequest, jsonResponse} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import browserRequest from '../src/request/browser-request'
import {baseUrl, expectRequest, expectRequestBody, isHappyDomBug, promiseRequest} from './helpers'

describe.skipIf(typeof fetch === 'undefined' && typeof XMLHttpRequest === 'undefined')(
  'fetch',
  () => {
    it('can use browser request with fetch polyfill', () => {
      getIt([baseUrl], browserRequest)
    })

    it('should be able to read plain text response', async () => {
      const body = 'Just some plain text for you to consume'
      const request = getIt([baseUrl], browserRequest)
      const req = request('/plain-text')
      await expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it.skipIf(adapter === 'fetch')('should be able to post a Buffer as body', async () => {
      const request = getIt([baseUrl], browserRequest)
      const req = request({url: '/echo', body: Buffer.from('Foo bar')})
      await expectRequestBody(req).resolves.toEqual('Foo bar')
    })

    it.skipIf(adapter === 'fetch')('should be able to post a string as body', async () => {
      const request = getIt([baseUrl], browserRequest)
      const req = request({url: '/echo', body: 'Does this work?'})
      await expectRequestBody(req).resolves.toEqual('Does this work?')
    })

    it.skipIf(adapter === 'fetch')('should be able to use JSON request middleware', async () => {
      const request = getIt([baseUrl, jsonRequest()], browserRequest)
      const req = request({url: '/echo', body: {foo: 'bar'}})
      await expectRequestBody(req).resolves.toEqual('{"foo":"bar"}')
    })

    it('should be able to set http headers', async () => {
      const request = getIt([baseUrl, jsonResponse()], browserRequest)
      const req = request({url: '/debug', headers: {'X-My-Awesome-Header': 'forsure'}})

      const body = await promiseRequest(req).then((res) => res.body)
      expect(body).toHaveProperty('headers')
      expect(body.headers).toHaveProperty('x-my-awesome-header', 'forsure')
    })

    it('should return the response headers', async () => {
      const request = getIt([baseUrl], browserRequest)
      const req = request({url: '/headers'})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('headers')
      expect(res.headers).toMatchObject({
        'x-custom-header': 'supercustom',
        'content-type': 'text/markdown',
      })
    })

    it('should be able to abort requests', () =>
      new Promise((resolve, reject) => {
        const request = getIt([baseUrl], browserRequest)
        const req = request({url: '/delay'})

        req.error.subscribe((err: any) =>
          reject(
            new Error(`error channel should not be called when aborting, got:\n\n${err.message}`, {
              cause: err,
            })
          )
        )
        req.response.subscribe(() =>
          reject(new Error('response channel should not be called when aborting'))
        )

        setTimeout(() => req.abort.publish(), 15)
        setTimeout(() => resolve(undefined), 250)
      }))

    it.skipIf(typeof ArrayBuffer === 'undefined' || isHappyDomBug)(
      'should be able to get arraybuffer back',
      async () => {
        const request = getIt([baseUrl], browserRequest)
        const req = request({url: '/plain-text', rawBody: true})
        await expectRequestBody(req).resolves.toBeInstanceOf(ArrayBuffer)
      }
    )

    it.skipIf(isHappyDomBug)('should emit errors on error channel', async () => {
      expect.assertions(2)
      await new Promise((resolve, reject) => {
        const request = getIt([baseUrl], browserRequest)
        const req = request({url: '/permafail'})
        req.response.subscribe(() => {
          reject(new Error('Response channel called when error channel should have been triggered'))
        })
        req.error.subscribe((err: any) => {
          try {
            expect(err).to.be.an.instanceOf(Error)
            expect(err.message).to.have.length.lessThan(600)
            resolve(undefined)
            // eslint-disable-next-line no-shadow
          } catch (err: any) {
            reject(err)
          }
        })
      })
    })
  },
  {timeout: 15000}
)
