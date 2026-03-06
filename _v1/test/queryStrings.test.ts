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

  it('should handle URLs with duplicate query params', async () => {
    const request = getIt([baseUrl, jsonResponse()])
    const req = request({url: '/debug?dupe=1&dupe=2&lone=3'})
    await expectRequestBody(req).resolves.toHaveProperty(
      'url',
      '/req-test/debug?dupe=1&dupe=2&lone=3',
    )
  })

  it('should append explicitly passed query parameters with existing params in URL', async () => {
    const request = getIt([baseUrl, jsonResponse()])
    const req = request({url: '/debug?dupe=a', query: {dupe: 'b', lone: 'c'}})
    await expectRequestBody(req).resolves.toHaveProperty(
      'url',
      '/req-test/debug?dupe=a&dupe=b&lone=c',
    )
  })

  it('should handle query parameter values with escaped `&`, `=`, and `?` (in uri)', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const req = request({
      url: '/query-string?and=this%26that&equals=this%3Dthat&question=this%3Fthat',
    })
    await expectRequestBody(req).resolves.toEqual({
      and: 'this&that',
      equals: 'this=that',
      question: 'this?that',
    })
  })

  it('should handle query parameter values with `&`, `=`, and `?` (in `query` option)', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const req = request({
      url: '/query-string',
      query: {and: 'this&that', equals: 'this=that', question: 'this?that'},
    })
    await expectRequestBody(req).resolves.toEqual({
      and: 'this&that',
      equals: 'this=that',
      question: 'this?that',
    })
  })

  it('should handle query parameter values with `&`, `=`, and `?` (mixed)', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const req = request({
      url: '/query-string?and=this%26that&question=this%3Fthat',
      query: {equals: 'this=that'},
    })
    await expectRequestBody(req).resolves.toEqual({
      and: 'this&that',
      equals: 'this=that',
      question: 'this?that',
    })
  })

  it('should handle query parameter values with double equals (uri)', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const req = request({
      url: '/query-string?query=_type%20%3D%3D+%22test%22',
    })
    await expectRequestBody(req).resolves.toEqual({
      query: '_type == "test"',
    })
  })

  it('should handle query parameter values with double equals (uri + query option)', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const req = request({
      url: '/query-string?query=_type+%3D%3D%20%22test%22',
      query: {$type: 'itsa == test'},
    })
    await expectRequestBody(req).resolves.toEqual({
      query: '_type == "test"',
      $type: 'itsa == test',
    })
  })

  it('should handle query parameters with empty values', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const req = request({
      url: '/query-string?a=',
      query: {b: ''},
    })
    await expectRequestBody(req).resolves.toEqual({
      a: '',
      b: '',
    })
  })
})
