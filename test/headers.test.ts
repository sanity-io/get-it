import {getIt} from 'get-it'
import {headers, jsonResponse} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {baseUrl, promiseRequest} from './helpers'

describe('headers', () => {
  it('should be able to set http headers', async () => {
    const request = getIt([baseUrl, jsonResponse()])
    const req = request({url: '/debug', headers: {'X-My-Awesome-Header': 'forsure'}})

    const body = await promiseRequest(req).then((res) => res.body)
    expect(body).toHaveProperty('headers')
    expect(body.headers).toHaveProperty('x-my-awesome-header', 'forsure')
  })

  it('should return the response headers', async () => {
    const request = getIt([baseUrl])
    const req = request({url: '/headers'})

    const res = await promiseRequest(req)
    expect(res).toHaveProperty('headers')
    expect(res.headers).toMatchObject({
      'x-custom-header': 'supercustom',
      'content-type': 'text/markdown',
    })
  })

  it('should be able to set default headers using headers middleware', async () => {
    const defHeaders = headers({'X-Name': 'Something', 'X-Dont-Override': 'You'})
    const request = getIt([baseUrl, jsonResponse(), defHeaders])
    const req = request({url: '/debug', headers: {'X-Dont-Override': 'Me'}})
    const body = await promiseRequest(req).then((res) => res.body)
    expect(body).toHaveProperty('headers')
    expect(body.headers).toMatchObject({
      'x-name': 'Something',
      'x-dont-override': 'Me',
    })
  })

  it('should be able to set overriding headers using headers middleware', async () => {
    const defHeaders = headers({'X-Name': 'Something', 'X-Dont-Override': 'You'}, {override: true})
    const request = getIt([baseUrl, jsonResponse(), defHeaders])
    const req = request({url: '/debug', headers: {'X-Dont-Override': 'Me'}})
    const body = await promiseRequest(req).then((res) => res.body)
    expect(body).toHaveProperty('headers')
    expect(body.headers).toMatchObject({
      'x-name': 'Something',
      'x-dont-override': 'You',
    })
  })

  it('should set Content-Length based on body (Buffer)', async () => {
    const request = getIt([baseUrl, jsonResponse()])
    const req = request({method: 'POST', url: '/debug', body: Buffer.from('hello')})

    const body = await promiseRequest(req).then((res) => res.body)
    expect(body).toHaveProperty('headers')
    expect(body.headers).toHaveProperty('content-length', '5')
  })

  it('should set Content-Length based on body (string)', async () => {
    const request = getIt([baseUrl, jsonResponse()])
    const req = request({method: 'POST', url: '/debug', body: 'hello'})

    const body = await promiseRequest(req).then((res) => res.body)
    expect(body).toHaveProperty('headers')
    expect(body.headers).toHaveProperty('content-length', '5')
  })

  it('should set Content-Length based on body (string)', async () => {
    const request = getIt([baseUrl, jsonResponse()])
    const req = request({method: 'POST', url: '/debug', body: 'hello 🚀'})

    const body = await promiseRequest(req).then((res) => res.body)
    expect(body).toHaveProperty('headers')
    expect(body.headers).toHaveProperty('content-length', '10')
  })
})
