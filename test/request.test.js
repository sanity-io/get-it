const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const chaiSubset = require('chai-subset')
const testServer = require('./helpers/server')
const {base, debug, jsonResponse, jsonRequest, httpErrors} = require('../src/middleware')
const {expectRequest, expectRequestBody} = require('./helpers/expectRequest')
const requester = require('../src/index')
const expect = chai.expect

chai.use(chaiSubset)
chai.use(chaiAsPromised)

const isNode = typeof window === 'undefined'
const isIE9 = (!isNode && window.XMLHttpRequest
  && !('withCredentials' in (new window.XMLHttpRequest())))

const testNonIE9 = isIE9 ? it.skip : it
const hostname = isNode ? 'localhost' : window.location.hostname
const debugRequest = debug({verbose: true})
const baseUrlPrefix = `http://${hostname}:9876/req-test`
const baseUrl = base(baseUrlPrefix)

describe('request', function () {
  this.timeout(15000)

  const state = {server: {close: done => done()}}

  if (isNode) {
    before(done => {
      testServer()
        .then(httpServer => Object.assign(state, {server: httpServer}))
        .then(() => done())
    })
  } else {
    before(() => {
      if (!window.EventSource) {
        // IE only
        localStorage.debug = 'reqlib*'
      }
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

  it('should be able to use json request body parser without response body', () => {
    const request = requester([baseUrl, jsonResponse, jsonRequest, debugRequest])
    const req = request({url: '/debug', method: 'post'})

    return expectRequestBody(req).to.eventually.containSubset({
      method: 'POST',
      body: ''
    })
  })

  testNonIE9('should be able to get a raw, unparsed body back', isNode ? () => {
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
    return expectRequestBody(req).to.eventually.containSubset({
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
      .and.containSubset({'x-my-awesome-header': 'absolutely'})
  })

  it('should not allow base middleware to add prefix on absolute urls', () => {
    const request = requester([baseUrl, jsonResponse])
    const req = request({url: `http://${hostname}:${testServer.port}/req-test/debug`})
    return expectRequestBody(req).to.eventually.have.property('url', '/req-test/debug')
  })

  it('should return the response headers', () => {
    const request = requester([baseUrl])
    const req = request({url: '/headers'})
    return expectRequest(req).to.eventually.have.property('headers')
      .and.containSubset({
        'x-custom-header': 'supercustom',
        'content-type': 'text/markdown'
      })
  })

  it('should not respond with errors on HTTP >= 400 by default', () => {
    const request = requester([baseUrl])
    const req = request({url: '/status?code=400'})
    return expectRequest(req).to.eventually.have.property('statusCode', 400)
  })

  it('should error when httpErrors middleware is enabled and response code is >= 400', done => {
    const request = requester([baseUrl, httpErrors])
    const req = request({url: '/status?code=400'})
    req.response.subscribe(res => {
      throw new Error('Response channel called when error channel should have been triggered')
    })
    req.error.subscribe(err => {
      expect(err).to.be.an.instanceOf(Error)
      expect(err.message).to.include('HTTP 400').and.include('Bad Request')
      expect(err).to.have.property('response').and.containSubset({
        url: `${baseUrlPrefix}/status?code=400`,
        method: 'GET',
        statusCode: 400,
        statusMessage: 'Bad Request'
      })

      done()
    })
  })

  // IE9 fails on cross-origin requests from http to https
  testNonIE9('should handle https without issues', () => {
    const request = requester()
    const req = request({url: 'https://httpbin.org/robots.txt'})
    return expectRequest(req).to.eventually.have.property('body')
      .and.include('/deny')
  })

  it('should handle cross-origin requests without issues', () => {
    const request = requester()
    const req = request({url: `http://httpbin.org/robots.txt?cb=${Date.now()}`})
    return expectRequest(req).to.eventually.have.property('body').and.include('/deny')
  })

  /**
   * Cases to test:
   *  - Redirects
   *  - Retries
   *  - HTTP errors
   *  - Timeouts
   **/

  after(done => state.server.close(done))
})
