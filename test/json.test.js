const {jsonResponse, jsonRequest} = require('../src/middleware')
const requester = require('../src/index')
const {
  debugRequest,
  expectRequestBody,
  baseUrl
} = require('./helpers')

describe('json middleware', () => {
  it('should be able to request data from a JSON-responding endpoint as JSON', () => {
    const request = requester([baseUrl, jsonResponse, debugRequest])
    const req = request({url: '/json'})
    return expectRequestBody(req).to.eventually.have.property('foo', 'bar')
  })

  it('should be able to send JSON-data data to a JSON endpoint and get JSON back', () => {
    const request = requester([baseUrl, jsonResponse, jsonRequest, debugRequest])
    const body = {randomValue: Date.now()}
    const req = request({url: '/json-echo', body})
    return expectRequestBody(req).to.eventually.eql(body)
  })

  it('should be able to use json response body parser on non-json responses', () => {
    const request = requester([baseUrl, jsonResponse, debugRequest])
    const req = request({url: '/plain-text'})
    return expectRequestBody(req).to.eventually.eql('Just some plain text for you to consume')
  })

  it('should be able to use json request body parser without response body', () => {
    const request = requester([baseUrl, jsonResponse, jsonRequest, debugRequest])
    const req = request({url: '/debug', method: 'post'})

    return expectRequestBody(req).to.eventually.containSubset({
      method: 'POST',
      body: ''
    })
  })

  it('should be able to send PUT-requests with json bodies', () => {
    const request = requester([baseUrl, jsonRequest, jsonResponse, debugRequest])
    const req = request({url: '/json-echo', method: 'PUT', body: {foo: 'bar'}})
    return expectRequestBody(req).to.eventually.include.eql({foo: 'bar'})
  })
})
