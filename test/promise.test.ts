import './helpers/server'

import {describe, expect, it} from 'vitest'

import {getIt} from '../src/index'
import {httpErrors, promise} from '../src/middleware'
import {baseUrl, debugRequest, testNonIE} from './helpers'

describe(
  'promise middleware',
  () => {
    it('should turn the return value into a promise', async () => {
      const request = getIt([baseUrl, promise()])
      const req = request({url: '/plain-text'})
      await expect(req).resolves.toMatchObject({
        body: 'Just some plain text for you to consume',
        method: 'GET',
        statusCode: 200,
      })
    })

    it('should be able to resolve only the response body', async () => {
      const request = getIt([baseUrl, promise({onlyBody: true})])
      const req = request({url: '/plain-text'})
      await expect(req).resolves.toEqual('Just some plain text for you to consume')
    })

    testNonIE('should reject network errors', async () => {
      const request = getIt([baseUrl, promise()])
      const req = request({url: '/permafail'})
      await expect(req).rejects.toThrow(/(socket|network)/i)
    })

    it('should reject http errors (if middleware is loaded)', async () => {
      const request = getIt([baseUrl, httpErrors(), promise()])
      const req = request({url: '/status?code=500'})
      await expect(req).rejects.toThrow(/HTTP 500/i)
    })

    it('can cancel using cancel tokens', () =>
      new Promise((resolve, reject) => {
        const source = promise.CancelToken.source()

        const request = getIt([baseUrl, promise()])
        request({url: '/delay', cancelToken: source.token})
          .then(() => reject(new Error('Should not be resolved when cancelled')))
          .catch((err) => {
            if (promise.isCancel(err)) {
              expect(err.toString()).to.equal('Cancel: Cancelled by user')
              resolve(undefined)
              return
            }

            reject(new Error(`Should be rejected with cancellation, got:\n\n${err.message}`))
          })

        setTimeout(() => source.cancel('Cancelled by user'), 15)
      }))

    it('does not execute requests that are already cancelled', () =>
      new Promise((resolve, reject) => {
        const source = promise.CancelToken.source()
        source.cancel()

        const request = getIt([baseUrl, debugRequest, promise()])
        request({url: '/delay', cancelToken: source.token})
          .then(() => reject(new Error('Should not be resolved when cancelled')))
          .catch((err) => {
            if (promise.isCancel(err)) {
              expect(err.toString()).to.equal('Cancel')
              resolve(undefined)
              return
            }

            reject(new Error(`Should be rejected with cancellation, got:\n\n${err.message}`))
          })
      }))

    // @todo test timeout errors
    // @todo cancelation
  },
  {timeout: 5000}
)
