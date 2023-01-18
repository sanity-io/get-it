import intoStream from 'into-stream'
import {describe, it} from 'vitest'

import {baseUrl, debugRequest, expectRequestBody, getIt, isNode, middleware} from './helpers'
const {jsonResponse, urlEncoded} = middleware

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

  it('should serialize complex objects', () => {
    const request = getIt([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = {
      str: 'val',
      num: 0,
      arr: [3, {prop: false}, 1, null, 6],
      obj: {prop1: null, prop2: ['elem']},
      emoji: '😀',
      set: new Set([1, 'two']),
    }
    const req = request({url: '/urlencoded', method: 'PUT', body})
    return expectRequestBody(req).resolves.toEqual({
      'arr[0]': '3',
      'arr[1][prop]': 'false',
      'arr[2]': '1',
      'arr[3]': 'null',
      'arr[4]': '6',
      num: '0',
      'obj[prop1]': 'null',
      'obj[prop2][0]': 'elem',
      str: 'val',
      emoji: '😀',
      'set[0]': '1',
      'set[1]': 'two',
    })
  })

  it.runIf(isNode)('should not serialize buffers', () => {
    const request = getIt([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = Buffer.from('blåbærsyltetøy', 'utf8')
    const req = request({url: '/echo', method: 'PUT', body})
    return expectRequestBody(req).resolves.toEqual('blåbærsyltetøy')
  })

  it.runIf(isNode)('should not serialize streams', () => {
    const request = getIt([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = intoStream('unicorn')
    const req = request({url: '/echo', method: 'PUT', body})
    return expectRequestBody(req).resolves.toEqual('unicorn')
  })
})
