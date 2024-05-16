import {adapter, environment, getIt} from 'get-it'
import {jsonRequest, jsonResponse} from 'get-it/middleware'
import {Readable} from 'stream'
import {describe, it} from 'vitest'

import {baseUrl, debugRequest, expectRequest, expectRequestBody} from './helpers'

describe('json middleware', () => {
  it.runIf(environment === 'node')(
    'should be able to request data from a JSON-responding endpoint as JSON',
    async () => {
      const request = getIt([baseUrl, jsonResponse(), debugRequest])
      const req = request({url: '/json'})
      await expectRequestBody(req).resolves.toHaveProperty('foo', 'bar')
    },
  )

  it('should be able to force response body as JSON regardless of content type', async () => {
    const request = getIt([baseUrl, jsonResponse({force: true}), debugRequest])
    const req = request({url: '/custom-json'})
    await expectRequestBody(req).resolves.toHaveProperty('foo', 'bar')
  })

  it('should be able to send JSON-data data to a JSON endpoint and get JSON back', async () => {
    const request = getIt([baseUrl, jsonResponse(), jsonRequest(), debugRequest])
    const body = {randomValue: Date.now()}
    const req = request({url: '/json-echo', body})
    await expectRequestBody(req).resolves.toEqual(body)
  })

  it.runIf(environment === 'node')(
    'should be able to use json response body parser on non-json responses',
    async () => {
      const request = getIt([baseUrl, jsonResponse(), debugRequest])
      const req = request({url: '/plain-text'})
      await expectRequestBody(req).resolves.toEqual('Just some plain text for you to consume')
    },
  )

  it('should be able to use json response body parser on non-json responses (no content type)', async () => {
    const request = getIt([baseUrl, jsonResponse(), debugRequest])
    const req = request({url: '/echo', body: 'Foobar'})
    await expectRequestBody(req).resolves.toEqual('Foobar')
  })

  it('should be able to use json request body parser without response body', async () => {
    const request = getIt([baseUrl, jsonResponse(), jsonRequest(), debugRequest])
    const req = request({url: '/debug', method: 'post'})

    await expectRequestBody(req).resolves.toMatchObject({
      method: 'POST',
      body: '',
    })
  })

  it.runIf(environment === 'node')(
    'should be able to send PUT-requests with json bodies',
    async () => {
      const request = getIt([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
      const req = request({url: '/json-echo', method: 'PUT', body: {foo: 'bar'}})
      await expectRequestBody(req).resolves.toEqual({foo: 'bar'})
    },
  )

  it('should throw if response body is not valid JSON', async () => {
    const request = getIt([baseUrl, jsonResponse()])
    const req = request({url: '/invalid-json'})
    await expectRequest(req).rejects.toThrow(/response body as json/i)
  })

  it('should serialize plain values (numbers, strings)', async () => {
    const request = getIt([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
    const url = '/json-echo'
    await Promise.all([
      expectRequestBody(request({url, body: 'string'})).resolves.toEqual('string'),
      expectRequestBody(request({url, body: 1337})).resolves.toEqual(1337),
    ])
  })

  it.skipIf(adapter === 'xhr')('should serialize arrays', async () => {
    const request = getIt([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
    const body = ['foo', 'bar', 'baz']
    const req = request({url: '/json-echo', method: 'PUT', body})
    await expectRequestBody(req).resolves.toEqual(body)
  })

  it.skipIf(adapter === 'xhr')('should not serialize buffers', async () => {
    const request = getIt([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
    const body = Buffer.from('blåbærsyltetøy', 'utf8')
    const req = request({url: '/echo', method: 'PUT', body})
    await expectRequestBody(req).resolves.toEqual('blåbærsyltetøy')
  })

  it.runIf(environment === 'node')('should not serialize streams', async () => {
    const request = getIt([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
    const body = Readable.from('unicorn')
    const req = request({url: '/echo', method: 'PUT', body})
    await expectRequestBody(req).resolves.toEqual('unicorn')
  })
})
