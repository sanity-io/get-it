import {environment, getIt} from 'get-it'
import {describe, expect, it} from 'vitest'

import {concat} from '../src/request/node/simpleConcat'
import {baseUrl, debugRequest, promiseRequest} from './helpers'

const expectedEmoji = '🎉🚀🌍🎸💡🔥✨🎯🐧🌈'

function expectByteSequence(buf: Buffer) {
  expect(buf).toHaveLength(256)
  for (let i = 0; i < 256; i++) {
    expect(buf[i]).toBe(i)
  }
}

describe.runIf(environment === 'node')('binary and unicode handling', {timeout: 15000}, () => {
  it('should preserve binary data with rawBody', async () => {
    const request = getIt([baseUrl, debugRequest])
    const res = await promiseRequest(request({url: '/binary', rawBody: true}))
    expectByteSequence(Buffer.from(res.body))
  })

  it('should preserve binary data through gzip decompression with rawBody', async () => {
    const request = getIt([baseUrl, debugRequest])
    const res = await promiseRequest(request({url: '/binary-gzip', rawBody: true}))
    expectByteSequence(Buffer.from(res.body))
  })

  it('should preserve binary data in stream mode', () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/binary', stream: true})
      req.response.subscribe((res: any) => {
        concat(res.body, (err: any, data: any) => {
          if (err) return reject(err)
          expectByteSequence(data)
          resolve(undefined)
        })
      })
      req.error.subscribe(reject)
    }))

  it('should preserve binary data in stream mode through gzip', () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/binary-gzip', stream: true})
      req.response.subscribe((res: any) => {
        concat(res.body, (err: any, data: any) => {
          if (err) return reject(err)
          expectByteSequence(data)
          resolve(undefined)
        })
      })
      req.error.subscribe(reject)
    }))

  it('should handle multi-byte UTF-8 split across chunks', async () => {
    const request = getIt([baseUrl, debugRequest])
    const res = await promiseRequest(request({url: '/unicode-chunked'}))
    expect(res.body).toBe(expectedEmoji)
  })

  it('should handle multi-byte UTF-8 split across chunks in stream mode', () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/unicode-chunked', stream: true})
      req.response.subscribe((res: any) => {
        concat(res.body, (err: any, data: any) => {
          if (err) return reject(err)
          expect(data.toString('utf8')).toBe(expectedEmoji)
          resolve(undefined)
        })
      })
      req.error.subscribe(reject)
    }))

  it('should handle multi-byte UTF-8 through gzip decompression', async () => {
    const request = getIt([baseUrl, debugRequest])
    const res = await promiseRequest(request({url: '/unicode-gzip'}))
    expect(res.body).toBe(expectedEmoji)
  })

  it('should handle multi-byte UTF-8 through gzip in stream mode', () =>
    new Promise((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/unicode-gzip', stream: true})
      req.response.subscribe((res: any) => {
        concat(res.body, (err: any, data: any) => {
          if (err) return reject(err)
          expect(data.toString('utf8')).toBe(expectedEmoji)
          resolve(undefined)
        })
      })
      req.error.subscribe(reject)
    }))
})
