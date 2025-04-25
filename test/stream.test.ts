import {environment, getIt} from 'get-it'
import {getUri} from 'get-uri'
import {Readable} from 'stream'
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
})
