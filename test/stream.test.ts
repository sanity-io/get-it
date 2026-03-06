import {environment, getIt} from 'get-it'
import {getUri} from 'get-uri'
import {Readable} from 'node:stream'
import {describe, expect, it} from 'vitest'

import {concat} from '../src/request/node/simpleConcat'
import {baseUrl, baseUrlPrefix, debugRequest, expectRequest, expectRequestBody} from './helpers'

describe.runIf(environment === 'node')('streams', {timeout: 15000}, () => {
  it('should be able to send a stream to a remote endpoint', async () => {
    const body = 'Just some plain text for you to consume'
    const request = getIt([baseUrl, debugRequest])
    const req = request({url: '/echo', body: Readable.from(body)})
    await expectRequestBody(req).resolves.toEqual(body)
  })

  it('should be able to pipe one request stream into the other', () =>
    getUri(`${baseUrlPrefix}/plain-text`).then(async (stream) => {
      const expected = 'Just some plain text for you to consume'
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/echo', body: stream})
      await expectRequestBody(req).resolves.toEqual(expected)
    }))

  it('does not retry failed requests when using streams', async () => {
    const body = 'Just some plain text for you to consume'
    const request = getIt([baseUrl, debugRequest])
    const req = request({url: '/fail?n=3', body: Readable.from(body)})
    await expectRequest(req).rejects.toThrow(Error)
  })

  it('can get a response stream', async () =>
    new Promise((resolve) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/drip', stream: true})
      req.response.subscribe((res: any) => {
        expect(res.body).to.have.property('pipe')
        expect(res.body.pipe).to.be.a('function')
        concat(res.body, (err: any, body: any) => {
          expect(err).to.eq(null)
          expect(body.toString('utf8')).to.eq('chunkchunkchunkchunkchunkchunkchunkchunkchunk')
          resolve(undefined)
        })
      })
    }))

  it('should drain empty response streams to release the socket', async () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/empty', stream: true})
      req.response.subscribe((res: any) => {
        expect(res.body).to.have.property('pipe')
        // Do NOT explicitly consume the stream via concat or 'data' listener.
        // For empty responses, the library should automatically drain the stream
        // so the socket is released. The 'end' event should fire without the
        // consumer needing to read data.
        res.body.once('end', () => {
          resolve(undefined)
        })
      })
      req.error.subscribe(reject)
    }))

  it('should drain 204 No Content response streams to release the socket', async () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/no-content', stream: true})
      req.response.subscribe((res: any) => {
        expect(res.statusCode).to.equal(204)
        res.body.once('end', () => {
          resolve(undefined)
        })
      })
      req.error.subscribe(reject)
    }))

  it('should drain HEAD response streams to release the socket', async () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/plain-text', method: 'HEAD', stream: true})
      req.response.subscribe((res: any) => {
        res.body.once('end', () => {
          resolve(undefined)
        })
      })
      req.error.subscribe(reject)
    }))

  it('should not lose data on non-empty compressed response streams', async () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/gzip', stream: true})
      req.response.subscribe((res: any) => {
        // The drain guard must NOT resume this stream — it has real data.
        // Consuming it via concat proves the body is intact.
        concat(res.body, (err: any, body: any) => {
          if (err) return reject(err)
          const parsed = JSON.parse(body.toString())
          expect(parsed).to.deep.equal(['harder', 'better', 'faster', 'stronger'])
          resolve(undefined)
        })
      })
      req.error.subscribe(reject)
    }))

  it('should drain empty compressed response streams', async () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/gzip-empty', stream: true})
      req.response.subscribe((res: any) => {
        // Empty body with Content-Encoding: gzip goes through the
        // decompress-response transform pipeline. The stream should still
        // end without explicit consumption.
        res.body.once('end', () => {
          resolve(undefined)
        })
      })
      req.error.subscribe(reject)
    }))
})
