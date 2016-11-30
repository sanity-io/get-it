const {describe, it, before, after} = require('mocha')
const {base, debug, jsonResponse, jsonRequest} = require('../src/middleware')
const {expectRequest, expectRequestBody} = require('./helpers/expectRequest')
const requester = require('../src/index')
const httpServer = require('./helpers/server')

const debugRequest = debug({verbose: true})
const baseUrl = base(`http://localhost:${httpServer.port}`)
const isNode = typeof window === 'undefined'
const ifNode = isNode ? it : it.skip
// const ifBrowser = isNode ? it.skip : it

describe('request', () => {
  let server

  before(() => httpServer().then(mockServer => {
    server = mockServer
  }))

  it('should be able to request a basic, plain-text file', () => {
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/plain-text'})

    return expectRequest(req).to.eventually.have.property(
      'body',
      httpServer.responses.plainText
    )
  })

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

  it('should be able to use json request body parser without data', () => {
    const request = requester([baseUrl, jsonResponse, jsonRequest, debugRequest])
    const req = request({url: '/debug', method: 'post'})
    return expectRequestBody(req).to.eventually.include.keys({method: 'POST', body: ''})
  })

  ifNode('should be able to get a raw, unparsed body back (node)', () => {
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/plain-text', rawBody: true})
    return expectRequestBody(req).to.eventually.be.an.instanceOf(Buffer)
      .and.deep.equal(Buffer.from(httpServer.responses.plainText, 'utf8'))
  })

  it('should serialize query strings', () => {
    const request = requester([baseUrl, jsonResponse, debugRequest])
    const query = {foo: 'bar', baz: 'bing'}
    const req = request({url: '/query-string', query})
    return expectRequestBody(req).to.eventually.eql(query)
  })

  it('should merge existing and explicit query params', () => {
    const request = requester([baseUrl, jsonResponse, debugRequest])
    const query = {baz: 3}
    const req = request({url: '/query-string?foo=1&bar=2', query})
    return expectRequestBody(req).to.eventually.eql({foo: '1', bar: '2', baz: '3'})
  })

  it('should unzip gziped responses', () => {
    const request = requester([baseUrl, jsonResponse, debugRequest])
    const req = request({url: '/gzip'})
    return expectRequestBody(req).to.eventually.deep.equal(['harder', 'better', 'faster', 'stronger'])
  })

  it('should be able to send PUT-requests with raw bodies', () => {
    const request = requester([baseUrl, jsonResponse, debugRequest])
    const req = request({url: '/debug', method: 'PUT', body: 'just a plain body'})
    return expectRequestBody(req).to.eventually.include.keys({
      method: 'PUT',
      body: 'just a plain body'
    })
  })

  it('should be able to send PUT-requests with json bodies', () => {
    const request = requester([baseUrl, jsonRequest, jsonResponse, debugRequest])
    const req = request({url: '/json-echo', method: 'PUT', body: {foo: 'bar'}})
    return expectRequestBody(req).to.eventually.include.eql({foo: 'bar'})
  })

  it('should be able to set http headers', () => {
    const request = requester([baseUrl, jsonResponse])
    const req = request({url: '/debug', headers: {'X-My-Awesome-Header': 'absolutely'}})
    return expectRequestBody(req).to.eventually.have.property('headers')
      .and.include.keys({'x-my-awesome-header': 'absolutely'})
  })

  it('should not allow base middleware to add prefix on absolute urls', () => {
    const request = requester([baseUrl, jsonResponse])
    const req = request({url: `http://localhost:${httpServer.port}/debug`})
    return expectRequestBody(req).to.eventually.have.property('url', '/debug')
  })


  /**
   * Cases to test:
   *  - HTTP headers
   *  - HTTPS
   *  - Redirects
   *  - Retries
   *  - HTTP errors
   *  - Timeouts
   **/

  after(done => {
    setImmediate(() => server.close(done))
  })
})
