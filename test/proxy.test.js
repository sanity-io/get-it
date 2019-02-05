/* eslint-disable no-process-env, camelcase */
require('./init.test')

const requester = require('../src/index')
const {proxy: proxyMiddleware} = require('../src/middleware')
const getProxy = require('./helpers/proxy')

const {expect, expectRequest, testNode, debugRequest, baseUrl, baseUrlPrefix} = require('./helpers')

describe('proxy', function() {
  this.timeout(15000)
  let proxyServer

  afterEach(cb => {
    delete process.env.http_proxy
    delete process.env.https_proxy
    delete process.env.no_proxy

    if (proxyServer) {
      proxyServer.close(cb)
      proxyServer = null
    } else {
      return cb()
    }

    return null
  })

  testNode('should be able to request with proxy on per-request basis', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([baseUrl, debugRequest])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text', proxy: {host: 'localhost', port: 4000}})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('should not pass through disabled proxy', () => {
    process.env.http_proxy = 'http://does-not-exists.example.com:4242/'

    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text', proxy: false})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('should support proxy set via env var', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([baseUrl, debugRequest])

    process.env.http_proxy = 'http://localhost:4000/'
    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text'})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('should only use proxy for domains not in no_proxy', () => {
    const body = 'Just some plain text for you to consume'
    const proxyBody = `${body} + proxy`
    const request = requester([baseUrl, debugRequest])

    process.env.http_proxy = 'http://localhost:4000/'
    process.env.no_proxy = 'foo.com, localhost,bar.net , , quix.co'
    return getProxy().then(proxy => {
      proxyServer = proxy

      const url = '/plain-text'
      const absUrl = `${baseUrlPrefix.replace('localhost', '127.0.0.1')}/plain-text`

      return Promise.all([
        expectRequest(request({url})).to.eventually.have.property('body', body),
        expectRequest(request({url: absUrl})).to.eventually.have.property('body', proxyBody)
      ])
    })
  })

  testNode('should support HTTP proxy auth', () => {
    const request = requester([baseUrl, debugRequest])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({
        url: '/plain-text',
        proxy: {host: 'localhost', port: 4000, auth: {username: 'user', password: 'pass'}}
      })
      return expectRequest(req)
        .to.eventually.have.property('headers')
        .and.containSubset({
          'x-proxy-auth': 'Basic dXNlcjpwYXNz'
        })
    })
  })

  testNode('should support HTTP proxy auth from env', () => {
    process.env.http_proxy = 'http://user:pass@localhost:4000/'

    const request = requester([baseUrl, debugRequest])

    return getProxy().then(proxy => {
      proxyServer = proxy
      return expectRequest(request({url: '/plain-text'}))
        .to.eventually.have.property('headers')
        .and.containSubset({
          'x-proxy-auth': 'Basic dXNlcjpwYXNz'
        })
    })
  })

  testNode('should be able to use proxy middleware', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([
      baseUrl,
      debugRequest,
      proxyMiddleware({host: 'localhost', port: 4000})
    ])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text'})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('proxy middleware with `false` disables env vars', () => {
    process.env.http_proxy = 'http://localhost:4000/'

    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest, proxyMiddleware(false)])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text'})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('per-request proxy options overrides proxy middleware', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([baseUrl, debugRequest, proxyMiddleware(false)])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text', proxy: {host: 'localhost', port: 4000}})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('passing non-object to proxy middleware throws', done => {
    expect(() => proxyMiddleware(true)).to.throw(/proxy middleware/i)
    done()
  })
})
