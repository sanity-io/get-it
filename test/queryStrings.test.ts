import {getIt} from 'get-it'
import {jsonResponse} from 'get-it/middleware'
import {describe, it} from 'vitest'

import {baseUrl, debugRequest, expectRequestBody} from './helpers'

describe('query strings', () => {
  it('should serialize query strings', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const query = {foo: 'bar', baz: 'bing'}
    const req = request({url: '/query-string', query})
    await expectRequestBody(req).resolves.toEqual(query)
  })

  it('should merge existing and explicit query params', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const query = {baz: 3}
    const req = request({url: '/query-string?foo=1&bar=2', query})
    await expectRequestBody(req).resolves.toEqual({foo: '1', bar: '2', baz: '3'})
  })

  it('should serialize arrays correctly', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const query = {it: ['hai', 'there']}
    const req = request({url: '/query-string?foo=1&bar=2', query})
    await expectRequestBody(req).resolves.toEqual({
      foo: '1',
      bar: '2',
      it: ['hai', 'there'],
    })
  })

  it('should remove undefined values from query strings', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const query = {foo: undefined, bar: 'baz'}
    const req = request({url: '/query-string', query})
    await expectRequestBody(req).resolves.toEqual({bar: 'baz'})
  })
})
