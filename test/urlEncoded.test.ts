import './helpers/server'

import intoStream from 'into-stream'
import {describe, it} from 'vitest'

import {getIt} from '../src/index'
import {jsonResponse, urlEncoded} from '../src/middleware'
import {baseUrl, debugRequest, expectRequestBody, testNode} from './helpers'

describe('urlEncoded middleware', () => {
  it('should be able to send urlencoded data to an endpoint and get JSON back', () => {
    const request = getIt([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = {randomValue: Date.now(), someThing: 'spaces & commas - all sorts!'}
    const strBody = Object.keys(body).reduce(
      (acc, key) => Object.assign(acc, {[key]: `${body[key]}`}),
      {}
    )
    const req = request({url: '/urlencoded', body})
    return expectRequestBody(req).resolves.toEqual(strBody)
  })

  it('should be able to send PUT-requests with urlencoded bodies', () => {
    const request = getIt([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const req = request({url: '/urlencoded', method: 'PUT', body: {foo: 'bar'}})
    return expectRequestBody(req).resolves.toEqual({foo: 'bar'})
  })

  it('should serialize arrays', () => {
    const request = getIt([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = {foo: ['foo', 'bar', 'baz']}
    const req = request({url: '/urlencoded', method: 'PUT', body})
    return expectRequestBody(req).resolves.toEqual({
      'foo[0]': 'foo',
      'foo[1]': 'bar',
      'foo[2]': 'baz',
    })
  })

  testNode('should not serialize buffers', () => {
    const request = getIt([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = Buffer.from('blåbærsyltetøy', 'utf8')
    const req = request({url: '/echo', method: 'PUT', body})
    return expectRequestBody(req).resolves.toEqual('blåbærsyltetøy')
  })

  testNode('should not serialize streams', () => {
    const request = getIt([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = intoStream('unicorn')
    const req = request({url: '/echo', method: 'PUT', body})
    return expectRequestBody(req).resolves.toEqual('unicorn')
  })
})
