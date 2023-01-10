import './helpers/server'

import {describe, expect, it} from 'vitest'

import {getIt} from '../src/index'
import {jsonResponse} from '../src/middleware'
import {
  baseUrl,
  baseUrlPrefix,
  debugRequest,
  expectRequest,
  expectRequestBody,
  isEdge,
  isNode,
  promiseRequest,
} from './helpers'

describe(
  'basics',
  () => {
    it('should return same instance when calling use()', () => {
      const request = getIt([baseUrl])
      return expect(request).to.equal(request.use(jsonResponse()))
    })

    it('should throw when requesting with invalid URL', () => {
      const request = getIt()
      return expect(() => request({url: 'heisann'})).to.throw(/valid URL/)
    })

    it('should be able to request a basic, plain-text file', async () => {
      const body = 'Just some plain text for you to consume'
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/plain-text'})

      await expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('should transform string to url option', async () => {
      const body = 'Just some plain text for you to consume'
      const request = getIt([baseUrl, debugRequest])
      const req = request('/plain-text')

      await expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it.runIf(isNode)('should be able to post a Buffer as body in node', async () => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/echo', body: Buffer.from('Foo bar')})
      await expectRequestBody(req).resolves.toEqual('Foo bar')
    })

    it.runIf(isNode)('should throw when trying to post invalid stuff', () => {
      const request = getIt([baseUrl, debugRequest])
      expect(() => {
        request({url: '/echo', method: 'post', body: {}})
      }).toThrow(/string, buffer or stream/)
    })

    it.skipIf(isEdge)(
      'should be able to get a raw, unparsed body back',
      isNode
        ? () => {
            // Node.js (buffer)
            const request = getIt([baseUrl, debugRequest])
            const req = request({url: '/plain-text', rawBody: true})
            return promiseRequest(req).then((res) => {
              expect(
                res.body.equals(Buffer.from('Just some plain text for you to consume'))
              ).toEqual(true)
            })
          }
        : async () => {
            // Browser (ArrayBuffer)
            const request = getIt([baseUrl, debugRequest])
            const req = request({url: '/plain-text', rawBody: true})
            await expectRequestBody(req).resolves.toBeInstanceOf(ArrayBuffer)
          }
    )

    it('should request compressed responses by default', async () => {
      const request = getIt([baseUrl, jsonResponse()])
      const req = request({url: '/debug'})

      const body = await promiseRequest(req).then((res) => res.body)
      expect(body).toHaveProperty('headers')
      expect(body.headers).toMatchObject({'accept-encoding': 'br, gzip, deflate'})
    })

    it('should decompress compressed responses', async () => {
      const request = getIt([baseUrl, jsonResponse(), debugRequest])
      const req = request({url: '/gzip'})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('body')
      expect(res.body).toEqual(['harder', 'better', 'faster', 'stronger'])
    })

    it('should not request compressed responses for HEAD requests', async () => {
      const request = getIt([baseUrl, jsonResponse()])
      const req = request({url: '/maybeCompress', method: 'HEAD'})

      const res = await promiseRequest(req)
      expect(res).toHaveProperty('headers')
      expect(res.headers).not.toHaveProperty('content-encoding')
    })

    it('should decompress brotli-encoded responses', async () => {
      const request = getIt([baseUrl, jsonResponse(), debugRequest])
      const req = request({url: '/maybeCompress'})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('body')
      expect(res.body).toEqual(['smaller', 'better', 'faster', 'stronger'])
    })

    it('should be able to disable compression', async () => {
      const request = getIt([baseUrl, jsonResponse(), debugRequest])
      const req = request({url: '/maybeCompress', compress: false})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('body')
      expect(res.body).toEqual(['larger', 'worse', 'slower', 'weaker'])
    })

    it('should not return a body on HEAD-requests', async () => {
      const request = getIt([baseUrl, jsonResponse()])
      const req = request({url: '/gzip', method: 'HEAD'})
      await expectRequest(req).resolves.toMatchObject({
        statusCode: 200,
        method: 'HEAD',
      })
    })

    it.skipIf(isEdge)('should be able to send PUT-requests with raw bodies', async () => {
      const request = getIt([baseUrl, jsonResponse(), debugRequest])
      const req = request({url: '/debug', method: 'PUT', body: 'just a plain body'})
      await expectRequestBody(req).resolves.toMatchObject({
        method: 'PUT',
        body: 'just a plain body',
      })
    })

    // IE9 fails on cross-origin requests from http to https
    it('should handle https without issues', async () => {
      const request = getIt()
      const req = request({url: 'https://httpbin.org/robots.txt'})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('body')
      expect(res.body).toContain('/deny')
    })

    it('should handle cross-origin requests without issues', async () => {
      const request = getIt()
      const req = request({url: `http://httpbin.org/robots.txt?cb=${Date.now()}`})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('body')
      expect(res.body).toMatch('/deny')
    })

    it('should not allow base middleware to add prefix on absolute urls', async () => {
      const request = getIt([baseUrl, jsonResponse()])
      const req = request({url: `${baseUrlPrefix}/debug`})
      await expectRequestBody(req).resolves.toHaveProperty('url', '/req-test/debug')
    })

    it('should be able to clone a requester, keeping the same middleware', () =>
      new Promise<void>((resolve) => {
        let i = 0
        const onRequest = () => i++
        const base = getIt([baseUrl, {onRequest}])
        const cloned = base.clone()

        base('/plain-text')
        cloned('/plain-text')

        setTimeout(() => {
          expect(i).to.equal(2, 'two requests should have been initiated')
          resolve()
        }, 15)
      }))
  },
  {timeout: 15000}
)
