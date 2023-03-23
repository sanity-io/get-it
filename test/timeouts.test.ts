import {getIt} from 'get-it'
import {describe, expect, it} from 'vitest'

import {baseUrl, debugRequest} from './helpers'

describe(
  'timeouts',
  () => {
    it('should be able to set a "global" timeout', () =>
      new Promise((resolve, reject) => {
        // To prevent the connection from being established use a non-routable IP
        // address. See https://tools.ietf.org/html/rfc5737#section-3
        const request = getIt([debugRequest])
        const req = request({url: 'http://192.0.2.1/', timeout: 250})

        req.response.subscribe(() => reject(new Error('response channel should not be called')))
        req.error.subscribe((err: any) => {
          expect(err.message).to.match(/timed out/i)
          resolve(undefined)
        })
      }))

    it('should be able to set individual timeouts', () =>
      new Promise((resolve, reject) => {
        const request = getIt([debugRequest])
        const startTime = Date.now()
        const req = request({url: 'http://192.0.2.1/', timeout: {socket: 250, connect: 450}})

        req.response.subscribe(() => reject(new Error('response channel should not be called')))
        req.error.subscribe(() => {
          expect(Date.now() - startTime).toBeGreaterThanOrEqual(250)
          resolve(undefined)
        })
      }))

    it.todo(
      'should be able to set socket timeout',
      () =>
        new Promise((resolve, reject) => {
          const request = getIt([baseUrl, debugRequest])
          const req = request({url: '/stall-after-initial', timeout: {socket: 500, connect: 250}})

          req.response.subscribe(() => reject(new Error('response channel should not be called')))
          req.error.subscribe((err: any) => {
            expect(err.message).to.match(/socket timed out/i)
            expect(err.code).to.equal('ESOCKETTIMEDOUT')
            resolve(undefined)
          })
        })
    )
  },
  {timeout: 10000}
)
