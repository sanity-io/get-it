const {urlEncoded, jsonResponse} = require('../src/middleware')
const requester = require('../src/index')
const {testNode, debugRequest, expectRequestBody, baseUrl} = require('./helpers')

describe('urlEncoded middleware', () => {
  it('should be able to send urlencoded data to an endpoint and get JSON back', () => {
    const request = requester([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = {randomValue: Date.now(), someThing: 'spaces & commas - all sorts!'}
    const strBody = Object.keys(body).reduce(
      (acc, key) => Object.assign(acc, {[key]: `${body[key]}`}),
      {}
    )
    const req = request({url: '/urlencoded', body})
    return expectRequestBody(req).to.eventually.eql(strBody)
  })

  it('should be able to send PUT-requests with urlencoded bodies', () => {
    const request = requester([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const req = request({url: '/urlencoded', method: 'PUT', body: {foo: 'bar'}})
    return expectRequestBody(req).to.eventually.eql({foo: 'bar'})
  })

  it('should serialize arrays', () => {
    const request = requester([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = {foo: ['foo', 'bar', 'baz']}
    const req = request({url: '/urlencoded', method: 'PUT', body})
    return expectRequestBody(req).to.eventually.eql({
      'foo[0]': 'foo',
      'foo[1]': 'bar',
      'foo[2]': 'baz'
    })
  })

  testNode('should not serialize buffers', () => {
    const request = requester([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = Buffer.from('blåbærsyltetøy', 'utf8')
    const req = request({url: '/echo', method: 'PUT', body})
    return expectRequestBody(req).to.eventually.eql('blåbærsyltetøy')
  })

  testNode('should not serialize streams', () => {
    const request = requester([baseUrl, urlEncoded(), jsonResponse(), debugRequest])
    const body = require('into-stream')('unicorn')
    const req = request({url: '/echo', method: 'PUT', body})
    return expectRequestBody(req).to.eventually.eql('unicorn')
  })
})
