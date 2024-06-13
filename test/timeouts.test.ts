import {finished} from 'node:stream/promises'

import {adapter, environment, getIt} from 'get-it'
import {keepAlive} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {baseUrl, debugRequest, promiseRequest} from './helpers'

describe(
  'timeouts',
  () => {
    // @TODO make the this test work in happy-dom
    it.skipIf(adapter === 'xhr' && environment === 'browser')(
      'should be able to set a "global" timeout',
      () =>
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
        }),
    )

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

    it.skipIf(adapter === 'xhr' && environment === 'browser').each([
      [false, false, false],
      [false, true, false],
      [true, false, false],
      [true, true, false],

      // Gzip tests at the bottom
      [false, false, true],
      [false, true, true],
      [true, false, true],
      [true, true, true],
    ])(
      'should be able to set socket timeout with {followingRedirects: %s, stream: %s, gzip: %s}',
      async (followRedirects, stream, gzip) => {
        const request = getIt([baseUrl, debugRequest])
        const req = request({
          url: gzip ? '/stall-after-initial-gzip' : '/stall-after-initial',
          timeout: {socket: 500, connect: 250},
          maxRedirects: followRedirects ? 3 : 0,
          stream,
        })

        await expect(async () => {
          const res = await promiseRequest(req)
          if (stream) {
            // If we're in stream mode then we expect the error to appear here instead:
            await finished(res.body)
          }
        }).rejects.toThrowError(/Socket timed out on request to/)
      },
    )

    it.runIf(environment === 'node')(
      'should reset the timeout when a connection is reused',
      async () => {
        // Keep-alive can only be reliably tested in Node.js.

        const request = getIt([baseUrl, debugRequest, keepAlive()])

        // We do one request:
        const remotePort1 = (
          await promiseRequest(request({url: '/remote-port', timeout: {socket: 500, connect: 250}}))
        ).body

        // And now the other one should also succeed (after 6 seconds).
        await promiseRequest(request({url: '/stall-after-initial', timeout: false}))

        // And verify that keep-alive was actually used:
        const remotePort2 = (await promiseRequest(request({url: '/remote-port', timeout: false})))
          .body
        expect(remotePort1).toBe(remotePort2)
      },
    )
  },
  {timeout: 10000},
)
