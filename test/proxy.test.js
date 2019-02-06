/* eslint-disable no-process-env, camelcase, no-sync */
require('./init.test')

const requester = require('../src/index')
const {proxy: proxyMiddleware} = require('../src/middleware')
const getProxy = require('./helpers/proxy')

const {
  expect,
  expectRequest,
  testNode,
  debugRequest,
  baseUrl,
  baseUrlHttps,
  baseUrlPrefix,
  baseUrlPrefixHttps
} = require('./helpers')

function closeServer(server) {
  return new Promise(resolve => (server ? server.close(resolve) : resolve()))
}

describe('proxy', function() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

  this.timeout(15000)

  let proxyServer

  afterEach(() => {
    delete process.env.http_proxy
    delete process.env.https_proxy
    delete process.env.no_proxy

    return closeServer(proxyServer).then(() => (proxyServer = null))
  })

  it('passing non-object to proxy middleware throws', done => {
    expect(() => proxyMiddleware(true)).to.throw(/proxy middleware/i)
    done()
  })

  // =============
  // === http  ===
  // =============
  testNode('http: should be able to request with proxy on per-request basis', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([baseUrl, debugRequest])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text', proxy: {host: 'localhost', port: 4000}})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('http: should not pass through disabled proxy', () => {
    process.env.http_proxy = 'http://does-not-exists.example.com:4242/'

    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text', proxy: false})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('http: should support proxy set via env var', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([baseUrl, debugRequest])

    process.env.http_proxy = 'http://localhost:4000/'
    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text'})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('http: should only use proxy for domains not in no_proxy', () => {
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

  testNode('http: should support HTTP proxy auth', () => {
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

  testNode('http: should support HTTP proxy auth from env', () => {
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

  testNode('http: should be able to use proxy middleware', () => {
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

  testNode('http: proxy middleware with `false` disables env vars', () => {
    process.env.http_proxy = 'http://localhost:4000/'

    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest, proxyMiddleware(false)])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text'})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('http: per-request proxy options overrides proxy middleware', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([baseUrl, debugRequest, proxyMiddleware(false)])

    return getProxy().then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text', proxy: {host: 'localhost', port: 4000}})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  // =============
  // === https ===
  // =============
  testNode('https: should be able to request with proxy on per-request basis', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([baseUrl, debugRequest])

    return getProxy('https').then(proxy => {
      proxyServer = proxy
      const req = request({
        url: '/plain-text',
        proxy: {host: 'localhost', port: 4443, protocol: 'https'}
      })
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('https: should support proxy set via env var (http request)', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([baseUrl, debugRequest])

    process.env.http_proxy = 'https://localhost:4443/'
    return getProxy('https').then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text'})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('https: should not pass through disabled proxy (http request)', () => {
    process.env.http_proxy = 'http://does-not-exists.example.com:4242/'

    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest])

    return getProxy('https').then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text', proxy: false})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('https: should only use proxy for domains not in no_proxy (http request)', () => {
    const body = 'Just some plain text for you to consume'
    const proxyBody = `${body} + proxy`
    const request = requester([baseUrl, debugRequest])

    process.env.http_proxy = 'https://localhost:4443/'
    process.env.no_proxy = 'foo.com, localhost,bar.net , , quix.co'
    return getProxy('https').then(proxy => {
      proxyServer = proxy

      const url = '/plain-text'
      const absUrl = `${baseUrlPrefix.replace('localhost', '127.0.0.1')}/plain-text`

      return Promise.all([
        expectRequest(request({url})).to.eventually.have.property('body', body),
        expectRequest(request({url: absUrl})).to.eventually.have.property('body', proxyBody)
      ])
    })
  })

  testNode('https: should support HTTP proxy auth from env (http request)', () => {
    process.env.http_proxy = 'https://user:pass@localhost:4443/'

    const request = requester([baseUrl, debugRequest])

    return getProxy('https').then(proxy => {
      proxyServer = proxy
      return expectRequest(request({url: '/plain-text'}))
        .to.eventually.have.property('headers')
        .and.containSubset({
          'x-proxy-auth': 'Basic dXNlcjpwYXNz'
        })
    })
  })

  testNode('https: should support proxy set via env var (https request)', () => {
    const body = 'Just some secure, plain text for you to consume + proxy'
    const request = requester([baseUrlHttps, debugRequest])

    process.env.https_proxy = 'https://localhost:4443/'
    return getProxy('https').then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text'})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('https: should not pass through disabled proxy (https request)', () => {
    process.env.https_proxy = 'http://does-not-exists.example.com:4242/'

    const body = 'Just some secure, plain text for you to consume'
    const request = requester([baseUrlHttps, debugRequest])

    return getProxy('https').then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text', proxy: false})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('https: should only use proxy for domains not in no_proxy (https request)', () => {
    const body = 'Just some secure, plain text for you to consume'
    const proxyBody = `${body} + proxy`
    const request = requester([baseUrlHttps, debugRequest])

    process.env.https_proxy = 'https://localhost:4443/'
    process.env.no_proxy = 'foo.com, localhost,bar.net , , quix.co'
    return getProxy('https').then(proxy => {
      proxyServer = proxy

      const url = '/plain-text'
      const absUrl = `${baseUrlPrefixHttps.replace('localhost', '127.0.0.1')}/plain-text`

      return Promise.all([
        expectRequest(request({url})).to.eventually.have.property('body', body),
        expectRequest(request({url: absUrl})).to.eventually.have.property('body', proxyBody)
      ])
    })
  })

  testNode('https: should support HTTP proxy auth from env (https request)', () => {
    process.env.https_proxy = 'https://user:pass@localhost:4443/'

    const request = requester([baseUrlHttps, debugRequest])

    return getProxy('https').then(proxy => {
      proxyServer = proxy
      return expectRequest(request({url: '/plain-text'}))
        .to.eventually.have.property('headers')
        .and.containSubset({
          'x-proxy-auth': 'Basic dXNlcjpwYXNz'
        })
    })
  })

  testNode('https: should support HTTP proxy auth', () => {
    const request = requester([baseUrl, debugRequest])

    return getProxy('https').then(proxy => {
      proxyServer = proxy
      const req = request({
        url: '/plain-text',
        proxy: {
          host: 'localhost',
          port: 4443,
          protocol: 'https',
          auth: {username: 'user', password: 'pass'}
        }
      })
      return expectRequest(req)
        .to.eventually.have.property('headers')
        .and.containSubset({
          'x-proxy-auth': 'Basic dXNlcjpwYXNz'
        })
    })
  })

  testNode('https: should be able to use proxy middleware', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([
      baseUrl,
      debugRequest,
      proxyMiddleware({host: 'localhost', port: 4443, protocol: 'https'})
    ])

    return getProxy('https').then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text'})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('https: proxy middleware with `false` disables env vars (http request)', () => {
    process.env.http_proxy = 'https://localhost:4443/'

    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest, proxyMiddleware(false)])

    return getProxy('https').then(proxy => {
      proxyServer = proxy
      const req = request({url: '/plain-text'})
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })

  testNode('https: per-request proxy options overrides proxy middleware', () => {
    const body = 'Just some plain text for you to consume + proxy'
    const request = requester([baseUrl, debugRequest, proxyMiddleware(false)])

    return getProxy('https').then(proxy => {
      proxyServer = proxy
      const req = request({
        url: '/plain-text',
        proxy: {host: 'localhost', port: 4443, protocol: 'https'}
      })
      return expectRequest(req).to.eventually.have.property('body', body)
    })
  })
})
