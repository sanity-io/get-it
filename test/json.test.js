const {jsonResponse, jsonRequest} = require('../src/middleware')
const requester = require('../src/index')
const {
  testNode,
  debugRequest,
  expectRequest,
  expectRequestBody,
  baseUrl
} = require('./helpers')

describe('json middleware', () => {
  it('should be able to request data from a JSON-responding endpoint as JSON', () => {
    const request = requester([baseUrl, jsonResponse(), debugRequest])
    const req = request({url: '/json'})
    return expectRequestBody(req).to.eventually.have.property('foo', 'bar')
  })

  it('should be able to send JSON-data data to a JSON endpoint and get JSON back', () => {
    const request = requester([baseUrl, jsonResponse(), jsonRequest(), debugRequest])
    const body = {randomValue: Date.now()}
    const req = request({url: '/json-echo', body})
    return expectRequestBody(req).to.eventually.eql(body)
  })

  it('should be able to use json response body parser on non-json responses', () => {
    const request = requester([baseUrl, jsonResponse(), debugRequest])
    const req = request({url: '/plain-text'})
    return expectRequestBody(req).to.eventually.eql('Just some plain text for you to consume')
  })

  it('should be able to use json response body parser on non-json responses (no content type)', () => {
    const request = requester([baseUrl, jsonResponse(), debugRequest])
    const req = request({url: '/echo', body: 'Foobar'})
    return expectRequestBody(req).to.eventually.eql('Foobar')
  })

  it('should be able to use json request body parser without response body', () => {
    const request = requester([baseUrl, jsonResponse(), jsonRequest(), debugRequest])
    const req = request({url: '/debug', method: 'post'})

    return expectRequestBody(req).to.eventually.containSubset({
      method: 'POST',
      body: ''
    })
  })

  it('should be able to send PUT-requests with json bodies', () => {
    const request = requester([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
    const req = request({url: '/json-echo', method: 'PUT', body: {foo: 'bar'}})
    return expectRequestBody(req).to.eventually.eql({foo: 'bar'})
  })

  it('should throw if response body is not valid JSON', () => {
    const request = requester([baseUrl, jsonResponse()])
    const req = request({url: '/invalid-json'})
    return expectRequest(req).to.eventually.be.rejectedWith(/response body as json/i)
  })

  it('should serialize plain values (numbers, strings)', () => {
    const request = requester([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
    const url = '/json-echo'
    return Promise.all([
      expectRequestBody(request({url, body: 'string'})).to.eventually.eql('string'),
      expectRequestBody(request({url, body: 1337})).to.eventually.eql(1337)
    ])
  })

  it('should serialize arrays', () => {
    const request = requester([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
    const body = ['foo', 'bar', 'baz']
    const req = request({url: '/json-echo', method: 'PUT', body})
    return expectRequestBody(req).to.eventually.eql(body)
  })

  testNode('should not serialize buffers', () => {
    const request = requester([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
    const body = Buffer.from('blåbærsyltetøy', 'utf8')
    const req = request({url: '/echo', method: 'PUT', body})
    return expectRequestBody(req).to.eventually.eql('blåbærsyltetøy')
  })

  testNode('should not serialize streams', () => {
    const request = requester([baseUrl, jsonRequest(), jsonResponse(), debugRequest])
    const body = require('into-stream')('unicorn')
    const req = request({url: '/echo', method: 'PUT', body})
    return expectRequestBody(req).to.eventually.eql('unicorn')
  })
})
