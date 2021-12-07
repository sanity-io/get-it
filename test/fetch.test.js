const once = require('lodash.once')
const fetch = require('node-fetch')
const {jsonResponse} = require('../src/middleware')
const requester = require('../src/index')
const browserRequest = require('../src/request/browser-request')
const {expect, expectRequest, expectRequestBody, baseUrl} = require('./helpers')

const originalFetch = global.fetch

describe('fetch', function() {
  this.timeout(15000)

  this.beforeEach(() => {
    global.fetch = fetch
  })

  this.afterEach(() => {
    global.fetch = originalFetch
  })

  it('can use browser request with fetch polyfill', () => {
    requester([baseUrl], browserRequest)
  })

  it('should be able to read plain text response', () => {
    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl], browserRequest)
    const req = request('/plain-text')
    return expectRequest(req).to.eventually.have.property('body', body)
  })

  it('should be able to set http headers', () => {
    const request = requester([baseUrl, jsonResponse()], browserRequest)
    const req = request({url: '/debug', headers: {'X-My-Awesome-Header': 'forsure'}})

    return expectRequestBody(req)
      .to.eventually.have.property('headers')
      .and.containSubset({'x-my-awesome-header': 'forsure'})
  })

  it('should return the response headers', () => {
    const request = requester([baseUrl], browserRequest)
    const req = request({url: '/headers'})
    return expectRequest(req)
      .to.eventually.have.property('headers')
      .and.containSubset({
        'x-custom-header': 'supercustom',
        'content-type': 'text/markdown'
      })
  })

  it('should be able to abort requests', cb => {
    const done = once(cb)
    const request = requester([baseUrl], browserRequest)
    const req = request({url: '/delay'})

    req.error.subscribe(err =>
      done(new Error(`error channel should not be called when aborting, got:\n\n${err.message}`))
    )
    req.response.subscribe(() =>
      done(new Error('response channel should not be called when aborting'))
    )

    setTimeout(() => req.abort.publish(), 15)
    setTimeout(() => done(), 250)
  })

  it('should be able to get arraybuffer back', () => {
    const request = requester([baseUrl], browserRequest)
    const req = request({url: '/plain-text', rawBody: true})
    return expectRequestBody(req).to.eventually.be.an.instanceOf(ArrayBuffer)
  })

  it('should emit errors on error channel', done => {
    const request = requester([baseUrl], browserRequest)
    const req = request({url: '/permafail'})
    req.response.subscribe(() => {
      throw new Error('Response channel called when error channel should have been triggered')
    })
    req.error.subscribe(err => {
      expect(err).to.be.an.instanceOf(Error)
      expect(err.message).to.have.length.lessThan(600)
      done()
    })
  })
})
