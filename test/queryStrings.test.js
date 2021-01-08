const {jsonResponse} = require('../src/middleware')
const requester = require('../src/index')
const {debugRequest, expectRequestBody, baseUrl} = require('./helpers')

describe('query strings', () => {
  it('should serialize query strings', () => {
    const request = requester([baseUrl, jsonResponse(), debugRequest])
    const query = {foo: 'bar', baz: 'bing'}
    const req = request({url: '/query-string', query})
    return expectRequestBody(req).to.eventually.eql(query)
  })

  it('should merge existing and explicit query params', () => {
    const request = requester([baseUrl, jsonResponse(), debugRequest])
    const query = {baz: 3}
    const req = request({url: '/query-string?foo=1&bar=2', query})
    return expectRequestBody(req).to.eventually.eql({foo: '1', bar: '2', baz: '3'})
  })

  it('should serialize arrays correctly', () => {
    const request = requester([baseUrl, jsonResponse(), debugRequest])
    const query = {it: ['hai', 'there']}
    const req = request({url: '/query-string?foo=1&bar=2', query})
    return expectRequestBody(req).to.eventually.eql({
      foo: '1',
      bar: '2',
      it: ['hai', 'there'],
    })
  })

  it('should remove undefined values from query strings', () => {
    const request = requester([baseUrl, jsonResponse(), debugRequest])
    const query = {foo: undefined, bar: 'baz'}
    const req = request({url: '/query-string', query})
    return expectRequestBody(req).to.eventually.eql({bar: 'baz'})
  })
})
