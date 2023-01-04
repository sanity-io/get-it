import './helpers/server'

import {describe, it} from 'vitest'

import {getIt} from '../src/index'
import {baseUrl, baseUrlPrefix, expectRequest, testNode} from './helpers'

describe('redirects', () => {
  it('should handle redirects', async () => {
    const request = getIt([baseUrl])
    const req = request({url: '/redirect?n=8'})
    return expectRequest(req).resolves.toMatchObject({
      statusCode: 200,
      body: 'Done redirecting',
      url: `${baseUrlPrefix}/redirect?n=10`,
    })
  })

  testNode('should be able to set max redirects (node)', () => {
    const request = getIt([baseUrl])
    const req = request({url: '/redirect?n=7', maxRedirects: 2})
    return expectRequest(req).rejects.toThrow(/(Max redirects)|(Maximum number of redirects)/)
  })

  testNode('should be able to be told NOT to follow redirects', () => {
    const request = getIt([baseUrl])
    const req = request({url: '/redirect?n=8', maxRedirects: 0})
    return expectRequest(req).resolves.toMatchObject({statusCode: 302})
  })
})
