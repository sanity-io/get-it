import {environment, getIt} from 'get-it'
import {jsonRequest, jsonResponse, keepAlive, promise} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {httpRequester as nodeRequest} from '../src/request/node-request'
import {baseUrl, expectRequestBody, promiseRequest} from './helpers'

describe.runIf(typeof fetch !== 'undefined' && environment === 'node')(
  'fetch',
  () => {
    it('can return a regular response', async () => {
      const request = getIt([baseUrl, keepAlive(), promise()], nodeRequest)
      const expected = await request({url: '/plain-text', fetch: false})
      const actual = await request({url: '/plain-text', fetch: true})
      expect(actual).toEqual(expected)
    })

    it.skipIf(process.versions.node.split('.')[0] === '20')('can turn off keep-alive', async () => {
      const request = getIt([baseUrl, promise()], nodeRequest)
      const expected = await request({url: '/plain-text', fetch: false})
      const actual = await request({
        url: '/plain-text',
        fetch: {headers: {connection: 'close'}},
      })
      expect(actual).toEqual(expected)
      expect(actual.headers).toHaveProperty('connection', 'close')
    })

    it('should allow sending cache options', async () => {
      const request = getIt([baseUrl, keepAlive(), promise()], nodeRequest)
      const expected = await request({url: '/plain-text', fetch: false})
      const actual = await request({url: '/plain-text', fetch: {cache: 'no-store'}})
      expect(actual).toEqual(expected)
    })

    it('should be able to post a Buffer as body', async () => {
      const request = getIt([baseUrl], nodeRequest)
      const req = request({url: '/echo', fetch: true, body: Buffer.from('Foo bar')})
      await expectRequestBody(req).resolves.toEqual('Foo bar')
    })

    it.skipIf(typeof FormData === 'undefined' || typeof Blob === 'undefined')(
      'should be able to post a File as body',
      async () => {
        const request = getIt([baseUrl], nodeRequest)
        const formData = new FormData()
        const file = new Blob(['Foo bar'], {type: 'text/plain'})
        formData.set('cody', file)
        const req = request({url: '/echo', fetch: true, body: formData})
        await expectRequestBody(req).resolves.toContain('Foo bar')
      }
    )

    it('should be able to post a string as body', async () => {
      const request = getIt([baseUrl], nodeRequest)
      const req = request({url: '/echo', fetch: true, body: 'Does this work?'})
      await expectRequestBody(req).resolves.toEqual('Does this work?')
    })

    it('should be able to use JSON request middleware', async () => {
      const request = getIt([baseUrl, jsonRequest()], nodeRequest)
      const req = request({url: '/echo', fetch: true, body: {foo: 'bar'}})
      await expectRequestBody(req).resolves.toEqual('{"foo":"bar"}')
    })

    it('should be able to set http headers', async () => {
      const request = getIt([baseUrl, jsonResponse()], nodeRequest)
      const req = request({url: '/debug', fetch: {headers: {'X-My-Awesome-Header': 'forsure'}}})

      const body = await promiseRequest(req).then((res) => res.body)
      expect(body).toHaveProperty('headers')
      expect(body.headers).toHaveProperty('x-my-awesome-header', 'forsure')
    })

    it('should return the response headers', async () => {
      const request = getIt([baseUrl], nodeRequest)
      const req = request({url: '/headers', fetch: true})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('headers')
      expect(res.headers).toMatchObject({
        'x-custom-header': 'supercustom',
        'content-type': 'text/markdown',
      })
    })

    it('should be able to abort requests', () =>
      new Promise((resolve, reject) => {
        const request = getIt([baseUrl], nodeRequest)
        const req = request({url: '/delay', fetch: true})

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

    it.skipIf(typeof ReadableStream === 'undefined')(
      'should be able to get a ReadableStream back',
      async () => {
        const request = getIt([baseUrl, promise()], nodeRequest)
        const res = await request({url: '/plain-text', rawBody: true, fetch: true})
        expect(res.body).toBeInstanceOf(ReadableStream)
      }
    )

    it('should emit errors on error channel', async () => {
      expect.assertions(2)
      await new Promise((resolve, reject) => {
        const request = getIt([baseUrl], nodeRequest)
        const req = request({url: '/permafail', fetch: true})
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
