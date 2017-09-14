const {jsonResponse} = require('../src/middleware')
const requester = require('../src/index')
const {
  expectRequest,
  expectRequestBody,
  promiseRequest,
  expect,
  testNonIE9,
  testNode,
  debugRequest,
  baseUrl,
  baseUrlPrefix,
  isNode,
  bufferFrom
} = require('./helpers')

describe('basics', function () {
  this.timeout(15000)

  it('should return same instance when calling use()', () => {
    const request = requester([baseUrl])
    return expect(request).to.equal(request.use(jsonResponse()))
  })

  it('should throw when requesting with invalid URL', () => {
    const request = requester()
    return expect(() => request({url: 'heisann'})).to.throw(/valid URL/)
  })

  it('should be able to request a basic, plain-text file', () => {
    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/plain-text'})

    return expectRequest(req).to.eventually.have.property('body', body)
  })

  it('should transform string to url option', () => {
    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest])
    const req = request('/plain-text')

    return expectRequest(req).to.eventually.have.property('body', body)
  })

  testNode('should be able to post a Buffer as body in node', () => {
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/echo', body: bufferFrom('Foo bar')})
    return expectRequestBody(req).to.eventually.eql('Foo bar')
  })

  testNode('should throw when trying to post invalid stuff', () => {
    const request = requester([baseUrl, debugRequest])
    expect(() => {
      request({url: '/echo', method: 'post', body: {}})
    }).to.throw(/string, buffer or stream/)
  })

  testNonIE9('should be able to get a raw, unparsed body back', isNode ? () => {
    // Node.js (buffer)
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/plain-text', rawBody: true})
    return promiseRequest(req).then(res => {
      expect(res.body.equals(bufferFrom('Just some plain text for you to consume'))).to.equal(true)
    })
  } : () => {
    // Browser (ArrayBuffer)
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/plain-text', rawBody: true})
    return expectRequestBody(req).to.eventually.be.an.instanceOf(ArrayBuffer)
  })

  it('should unzip gziped responses', () => {
    const request = requester([baseUrl, jsonResponse(), debugRequest])
    const req = request({url: '/gzip'})
    return expectRequestBody(req).to.eventually.deep.equal(['harder', 'better', 'faster', 'stronger'])
  })

  it('should not return a body on HEAD-requests', () => {
    const request = requester([baseUrl, jsonResponse()])
    const req = request({url: '/gzip', method: 'HEAD'})
    return expectRequest(req).to.eventually.containSubset({
      statusCode: 200,
      method: 'HEAD'
    })
  })

  it('should be able to send PUT-requests with raw bodies', () => {
    const request = requester([baseUrl, jsonResponse(), debugRequest])
    const req = request({url: '/debug', method: 'PUT', body: 'just a plain body'})
    return expectRequestBody(req).to.eventually.containSubset({
      method: 'PUT',
      body: 'just a plain body'
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

  it('should not allow base middleware to add prefix on absolute urls', () => {
    const request = requester([baseUrl, jsonResponse()])
    const req = request({url: `${baseUrlPrefix}/debug`})
    return expectRequestBody(req).to.eventually.have.property('url', '/req-test/debug')
  })

  it('should be able to clone a requester, keeping the same middleware', done => {
    let i = 0
    const onRequest = () => i++
    const base = requester([baseUrl, {onRequest}])
    const cloned = base.clone()

    base('/plain-text')
    cloned('/plain-text')

    setTimeout(() => {
      expect(i).to.equal(2, 'two requests should have been initiated')
      done()
    }, 15)
  })
})
