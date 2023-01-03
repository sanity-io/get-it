import './helpers/server'

import bufferFrom from 'buffer-from'
import fetch from 'node-fetch'
import {afterEach, beforeEach, expect, it} from 'vitest'

import {getIt} from '../src/index'
import {jsonRequest, jsonResponse} from '../src/middleware'
import browserRequest from '../src/request/browser-request'
import {baseUrl, describeNode, expectRequest, expectRequestBody, promiseRequest} from './helpers'

const originalFetch = global.fetch

describeNode(
  'fetch',
  () => {
    beforeEach(() => {
      global.fetch = fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('can use browser request with fetch polyfill', () => {
      getIt([baseUrl], browserRequest)
    })

    it('should be able to read plain text response', async () => {
      const body = 'Just some plain text for you to consume'
      const request = getIt([baseUrl], browserRequest)
      const req = request('/plain-text')
      await expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('should be able to post a Buffer as body', async () => {
      const request = getIt([baseUrl], browserRequest)
      const req = request({url: '/echo', body: bufferFrom('Foo bar')})
      await expectRequestBody(req).resolves.toEqual('Foo bar')
    })

    it('should be able to post a string as body', async () => {
      const request = getIt([baseUrl], browserRequest)
      const req = request({url: '/echo', body: 'Does this work?'})
      await expectRequestBody(req).resolves.toEqual('Does this work?')
    })

    it('should be able to use JSON request middleware', async () => {
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

        req.error.subscribe((err) =>
          reject(
            new Error(`error channel should not be called when aborting, got:\n\n${err.message}`)
          )
        )
        req.response.subscribe(() =>
          reject(new Error('response channel should not be called when aborting'))
        )

        setTimeout(() => req.abort.publish(), 15)
        setTimeout(() => resolve(undefined), 250)
      }))

    it('should be able to get arraybuffer back', async () => {
      const request = getIt([baseUrl], browserRequest)
      const req = request({url: '/plain-text', rawBody: true})
      await expectRequestBody(req).resolves.toBeInstanceOf(ArrayBuffer)
    })

    it('should emit errors on error channel', () =>
      new Promise((resolve) => {
        const request = getIt([baseUrl], browserRequest)
        const req = request({url: '/permafail'})
        req.response.subscribe(() => {
          throw new Error('Response channel called when error channel should have been triggered')
        })
        req.error.subscribe((err) => {
          expect(err).to.be.an.instanceOf(Error)
          expect(err.message).to.have.length.lessThan(600)
          resolve(undefined)
        })
      }))
  },
  {timeout: 15000}
)
