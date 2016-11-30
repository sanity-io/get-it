const chai = require('chai')
const testServer = require('./helpers/server')
const chaiAsPromised = require('chai-as-promised')
const {base, debug, jsonResponse, jsonRequest} = require('../src/middleware')
const {expectRequest, expectRequestBody} = require('./helpers/expectRequest')
const requester = require('../src/index')

chai.use(chaiAsPromised)

const debugRequest = debug({verbose: true})
const baseUrl = base('http://localhost:9876/req-test')
const isNode = typeof window === 'undefined'

describe('request', () => {
  const state = {server: {close: done => done()}}

  if (isNode) {
    before(done => {
      testServer()
        .then(httpServer => Object.assign(state, {server: httpServer}))
        .then(done)
    })
  } else {
    before(() => {
      localStorage.debug = 'reqlib*'
    })
  }

  it('should be able to request a basic, plain-text file', () => {
    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/plain-text'})

    return expectRequest(req).to.eventually.have.property('body', body)
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

  it('should be able to get a raw, unparsed body back', isNode ? () => {
    // Node.js (buffer)
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/plain-text', rawBody: true})
    return expectRequestBody(req).to.eventually.be.an.instanceOf(Buffer)
      .and.deep.equal(Buffer.from(testServer.responses.plainText, 'utf8'))
  } : () => {
    // Browser (ArrayBuffer)
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/plain-text', rawBody: true})
    return expectRequestBody(req).to.eventually.be.an.instanceOf(ArrayBuffer)
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
    const req = request({url: `http://localhost:${testServer.port}/req-test/debug`})
    return expectRequestBody(req).to.eventually.have.property('url', '/req-test/debug')
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

  after(done => state.server.close(done))
})
