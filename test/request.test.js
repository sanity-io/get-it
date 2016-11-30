const {describe, it, before, after} = require('mocha')
const {base, debug, jsonResponse, jsonRequest} = require('../src/middleware')
const {expectRequest, expectRequestBody} = require('./helpers/expectRequest')
const requester = require('../src/index')
const httpServer = require('./helpers/server')

const baseUrl = base(`http://localhost:${httpServer.port}`)
const isNode = typeof window === 'undefined'
const ifNode = isNode ? it : it.skip
const ifBrowser = isNode ? it.skip : it

describe('request', () => {
  let server

  before(() => httpServer().then(mockServer => {
    server = mockServer
  }))

  it('should be able to request a basic, plain-text file', () => {
    const request = requester([baseUrl])
    const req = request({url: '/plain-text'})

    return expectRequest(req).to.eventually.have.property(
      'body',
      httpServer.responses.plainText
    )
  })

  it('should be able to request data from a JSON-responding endpoint as JSON', () => {
    const request = requester([baseUrl, jsonResponse])
    const req = request({url: '/json'})
    return expectRequestBody(req).to.eventually.have.property('foo', 'bar')
  })

  it('should be able to send JSON-data data to a JSON endpoint and get JSON back', () => {
    const request = requester([baseUrl, jsonResponse, jsonRequest])
    const body = {randomValue: Date.now()}
    const req = request({url: '/json-echo', body})
    return expectRequestBody(req).to.eventually.eql(body)
  })

  ifNode('should be able to get a raw, unparsed body back (node)', () => {
    const request = requester([baseUrl])
    const req = request({url: '/plain-text', rawBody: true})
    return expectRequestBody(req).to.eventually.be.an.instanceOf(Buffer)
      .and.deep.equal(Buffer.from(httpServer.responses.plainText, 'utf8'))
  })

  it('should serialize query strings', () => {
    const request = requester([baseUrl, jsonResponse])
    const query = {foo: 'bar', baz: 'bing'}
    const req = request({url: '/query-string', query})
    return expectRequestBody(req).to.eventually.eql(query)
  })

  /**
   * Cases to test:
   *  - Query strings
   *  - HTTP method
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
