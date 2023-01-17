import fs from 'fs'
import {describe, expect, it} from 'vitest'

import {getIt} from '../src/index'
import {httpErrors, retry} from '../src/middleware'
import {baseUrl, debugRequest, expectRequest, isEdge, isNode} from './helpers'

describe(
  'retry middleware',
  () => {
    const retry5xx = (err) => err.response.statusCode >= 500

    it('exposes default "shouldRetry" function', () => {
      expect(retry.shouldRetry).to.be.a('function')
    })

    it.skipIf(isEdge)('should handle retries when retry middleware is used', () => {
      const request = getIt([baseUrl, debugRequest, retry()])
      const successAt = isNode ? 4 : 7 // Browsers have a weird thing where they might auto-retry on network errors
      const req = request({url: `/fail?uuid=${Math.random()}&n=${successAt}`})

      return expectRequest(req).resolves.toMatchObject({
        statusCode: 200,
        body: 'Success after failure',
      })
    })

    it(
      'should be able to set max retries',
      () => {
        const request = getIt([
          baseUrl,
          httpErrors(),
          retry({maxRetries: 1, shouldRetry: retry5xx}),
        ])
        const req = request({url: '/status?code=500'})
        return expectRequest(req).rejects.toThrow(/HTTP 500/i)
      },
      {timeout: 400}
    )

    it.runIf(isNode)(
      'should not retry if it body is a stream',
      () => {
        const request = getIt([
          baseUrl,
          httpErrors(),
          retry({maxRetries: 5, shouldRetry: retry5xx}),
        ])
        const req = request({url: '/status?code=500', body: fs.createReadStream(__filename)})
        return expectRequest(req).rejects.toThrow(/HTTP 500/i)
      },
      {timeout: 400}
    )

    it(
      'should be able to set max retries on a per-request basis',
      () => {
        const request = getIt([
          baseUrl,
          httpErrors(),
          retry({maxRetries: 5, shouldRetry: retry5xx}),
        ])
        const req = request({url: '/status?code=500', maxRetries: 1})
        return expectRequest(req).rejects.toThrow(/HTTP 500/i)
      },
      {timeout: 400}
    )

    it('should be able to set a custom function on whether or not we should retry', () => {
      const shouldRetry = (error, retryCount) => retryCount !== 1
      const request = getIt([baseUrl, debugRequest, httpErrors(), retry({shouldRetry})])
      const req = request({url: '/status?code=503'})
      return expectRequest(req).rejects.toThrow(/HTTP 503/)
    })

    it('should be able to set a custom function on whether or not we should retry (per-request basis)', () => {
      const shouldRetry = (error, retryCount) => retryCount !== 1
      const request = getIt([baseUrl, debugRequest, httpErrors(), retry()])
      const req = request({url: '/status?code=503', shouldRetry})
      return expectRequest(req).rejects.toThrow(/HTTP 503/)
    })

    it.skipIf(isEdge)('should not retry non-GET-requests by default', () => {
      // Browsers have a weird thing where they might auto-retry on network errors
      const request = getIt([baseUrl, debugRequest, retry()])
      const req = request({url: `/fail?uuid=${Math.random()}&n=2`, method: 'POST', body: 'Heisann'})
      return expectRequest(req).rejects.toThrow(Error)
    })

    // @todo Browsers are really flaky with retries, revisit later
    it.runIf(isNode)('should handle retries with a delay function ', () => {
      const retryDelay = () => 375
      const request = getIt([baseUrl, retry({retryDelay})])

      const startTime = Date.now()
      const req = request({url: `/fail?uuid=${Math.random()}&n=4`})
      return expectRequest(req).resolves.toSatisfy(() => {
        const timeUsed = Date.now() - startTime
        return timeUsed > 1000 && timeUsed < 1750
      }, 'respects the retry delay (roughly)')
    })
  },
  {timeout: 15000}
)
