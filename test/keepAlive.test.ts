import './helpers/server'

import {describe} from 'vitest'

import {getIt} from '../src/index'
import {keepAlive} from '../src/middleware'
import {baseUrl, expectRequestBody, testNode} from './helpers'

describe('keepAlive middleware', () => {
  testNode('should work with redirects (passing `agents`)', async () => {
    const body = 'Just some plain text for you to consume'
    const request = getIt([baseUrl, keepAlive()])
    await Promise.all([
      expectRequestBody(request('/plain-text')).resolves.toEqual(body),
      new Promise((resolve) => setTimeout(resolve, 50)).then(() =>
        expectRequestBody(request('/plain-text')).resolves.toEqual(body)
      ),
    ])
  })

  testNode('should work without redirects (passing `agent`)', async () => {
    const body = 'Just some plain text for you to consume'
    const request = getIt([baseUrl, keepAlive()])
    const options = {url: '/plain-text', maxRedirects: 0}
    await Promise.all([
      expectRequestBody(request(options)).resolves.toEqual(body),
      new Promise((resolve) => setTimeout(resolve, 50)).then(() =>
        expectRequestBody(request(options)).resolves.toEqual(body)
      ),
    ])
  })
})
