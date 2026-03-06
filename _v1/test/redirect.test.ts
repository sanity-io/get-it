import {environment, getIt} from 'get-it'
import {describe, it} from 'vitest'

import {baseUrl, baseUrlPrefix, expectRequest} from './helpers'

describe.runIf(environment === 'node')('redirects', () => {
  it('should handle redirects', async () => {
    const request = getIt([baseUrl])
    const req = request({url: '/redirect?n=8'})
    return expectRequest(req).resolves.toMatchObject({
      statusCode: 200,
      body: 'Done redirecting',
      url: `${baseUrlPrefix}/redirect?n=10`,
    })
  })

  it('should be able to set max redirects (node)', () => {
    const request = getIt([baseUrl])
    const req = request({url: '/redirect?n=7', maxRedirects: 2})
    return expectRequest(req).rejects.toThrow(/(Max redirects)|(Maximum number of redirects)/)
  })

  it('should be able to be told NOT to follow redirects', () => {
    const request = getIt([baseUrl])
    const req = request({url: '/redirect?n=8', maxRedirects: 0})
    return expectRequest(req).resolves.toMatchObject({statusCode: 302})
  })
})
