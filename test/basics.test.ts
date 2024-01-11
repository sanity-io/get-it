import {adapter, environment, getIt} from 'get-it'
import {jsonResponse} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {
  baseUrl,
  baseUrlPrefix,
  debugRequest,
  expectRequest,
  expectRequestBody,
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

    it.skipIf(adapter === 'xhr')('should be able to post a Buffer as body', async () => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/echo', body: Buffer.from('Foo bar')})
      await expectRequestBody(req).resolves.toEqual('Foo bar')
    })

    it.runIf(adapter === 'xhr')('[xhr] should throw when trying to post invalid stuff', () => {
      const request = getIt([baseUrl, debugRequest])
      expect(() => {
        request({url: '/echo', method: 'post', body: {}})
      }).toThrowErrorMatchingInlineSnapshot(
        '"The \\"string\\" argument must be of type string or an instance of Buffer or ArrayBuffer. Received an instance of Object"',
      )
    })
    it.runIf(adapter === 'fetch')('[fetch] fetch is more permissive in what `body` can be', () => {
      const request = getIt([baseUrl, debugRequest])
      expect(() => {
        request({url: '/echo', method: 'post', body: {}})
      }).not.toThrow()
    })
    it.runIf(adapter === 'node')('[node] should throw when trying to post invalid stuff', () => {
      const request = getIt([baseUrl, debugRequest])
      expect(() => {
        request({url: '/echo', method: 'post', body: {}})
      }).toThrow(/string, buffer or stream/)
    })

    // @TODO make the test work in happy-dom
    it.skipIf(environment === 'browser')(
      'should be able to get a raw, unparsed body back',
      async () => {
        const request = getIt([baseUrl, debugRequest])
        const req = request({url: '/plain-text', rawBody: true})
        switch (adapter) {
          case 'node':
            // Node.js (buffer)
            return await expectRequestBody(req).resolves.toEqual(
              Buffer.from('Just some plain text for you to consume'),
            )
          case 'xhr':
            return await expectRequestBody(req).resolves.toBeTypeOf('string')
          case 'fetch':
            // Browser (ArrayBuffer)
            return await expectRequestBody(req).resolves.toMatchInlineSnapshot('ArrayBuffer []')
        }
      },
    )

    it.skipIf(environment === 'browser')(
      'should request compressed responses by default',
      async () => {
        const request = getIt([baseUrl, jsonResponse()])
        const req = request({url: '/debug'})

        const body = await promiseRequest(req).then((res) => res.body)
        expect(body).toHaveProperty('headers')
        expect(body.headers).toHaveProperty('accept-encoding')
        expect(body.headers['accept-encoding']).toMatch(/br|gzip|deflate/i)
      },
    )

    it.skipIf(environment === 'browser')('should decompress compressed responses', async () => {
      const request = getIt([baseUrl, jsonResponse(), debugRequest])
      const req = request({url: '/gzip'})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('body')
      expect(res.body).toEqual(['harder', 'better', 'faster', 'stronger'])
    })

    it.runIf(adapter === 'node')(
      'should not request compressed responses for HEAD requests',
      async () => {
        const request = getIt([baseUrl, jsonResponse()])
        const req = request({url: '/maybeCompress', method: 'HEAD'})

        const res = await promiseRequest(req)
        expect(res).toHaveProperty('headers')
        expect(res.headers).not.toHaveProperty('content-encoding')
      },
    )

    it.runIf(adapter === 'node')('should decompress brotli-encoded responses', async () => {
      const request = getIt([baseUrl, jsonResponse(), debugRequest])
      const req = request({url: '/maybeCompress'})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('body')
      expect(res.body).toEqual(['smaller', 'better', 'faster', 'stronger'])
    })

    it.runIf(adapter === 'node')('should be able to disable compression', async () => {
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

    it('should be able to send PUT-requests with raw bodies', async () => {
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
      const req = request({url: 'https://www.sanity.io/robots.txt'})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('body')
      expect(res.body).toContain('User-Agent: *')
    })

    it('should handle cross-origin requests without issues', async () => {
      const request = getIt()
      const req = request({url: `http://sanity.io/robots.txt?cb=${Date.now()}`})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('body')
      expect(res.body).toMatch('User-Agent: *')
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
  {timeout: 15000},
)
