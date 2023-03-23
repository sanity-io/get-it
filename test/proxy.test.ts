import {environment, getIt} from 'get-it'
import {base, proxy as proxyMiddleware} from 'get-it/middleware'
import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest'

import {
  baseUrl,
  baseUrlHttps,
  baseUrlPrefix,
  baseUrlPrefixHttps,
  debugRequest,
  expectRequest,
  promiseRequest,
} from './helpers'

beforeAll(() => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
})

afterAll(() => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'
})

describe.runIf(environment === 'node')(
  'proxy',
  () => {
    afterEach(async () => {
      delete process.env.http_proxy
      delete process.env.https_proxy
      delete process.env.no_proxy
    })

    it('passing non-object to proxy middleware throws', () => {
      expect(() => proxyMiddleware(true)).to.throw(/proxy middleware/i)
    })

    // =============
    // === http  ===
    // =============
    it('http: should be able to request with proxy on per-request basis', async () => {
      const body = 'Just some plain text for you to consume + proxy'
      const request = getIt([baseUrl, debugRequest])

      const req = request({url: '/plain-text', proxy: {host: 'localhost', port: 4000}})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('http: should not pass through disabled proxy', async () => {
      process.env.http_proxy = 'http://does-not-exists.example.com:4242/'

      const body = 'Just some plain text for you to consume'
      const request = getIt([baseUrl, debugRequest])

      const req = request({url: '/plain-text', proxy: false})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('http: should support proxy set via env var', async () => {
      const body = 'Just some plain text for you to consume + proxy'
      const request = getIt([baseUrl, debugRequest])

      process.env.http_proxy = 'http://localhost:4000/'
      const req = request({url: '/plain-text'})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('http: should only use proxy for domains not in no_proxy', async () => {
      const body = 'Just some plain text for you to consume'
      const proxyBody = `${body} + proxy`
      const request = getIt([baseUrl, debugRequest])

      process.env.http_proxy = 'http://localhost:4000/'
      process.env.no_proxy = 'foo.com, localhost,bar.net , , quix.co'
      const url = '/plain-text'
      const absUrl = `${baseUrlPrefix.replace('localhost', '127.0.0.1')}/plain-text`

      return Promise.all([
        expectRequest(request({url})).resolves.toHaveProperty('body', body),
        expectRequest(request({url: absUrl})).resolves.toHaveProperty('body', proxyBody),
      ])
    })

    it('http: should support HTTP proxy auth', async () => {
      const request = getIt([baseUrl, debugRequest])

      const req = request({
        url: '/plain-text',
        proxy: {host: 'localhost', port: 4000, auth: {username: 'user', password: 'pass'}},
      })
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('headers')
      expect(res.headers).toMatchObject({
        'x-proxy-auth': 'Basic dXNlcjpwYXNz',
      })
    })

    it('http: should support HTTP proxy auth from env', async () => {
      process.env.http_proxy = 'http://user:pass@localhost:4000/'

      const request = getIt([baseUrl, debugRequest])

      const res = await promiseRequest(request({url: '/plain-text'}))
      expect(res).toHaveProperty('headers')
      expect(res.headers).toMatchObject({
        'x-proxy-auth': 'Basic dXNlcjpwYXNz',
      })
    })

    it('http: should use requested hostname as Host header', async () => {
      process.env.http_proxy = 'http://localhost:4000/'

      const request = getIt([base(baseUrlPrefix.replace('localhost', '127.0.0.1')), debugRequest])

      const res = await promiseRequest(request({url: '/plain-text'}))
      expect(res).toHaveProperty('headers')
      expect(res.headers).toMatchObject({
        'x-proxy-host': '127.0.0.1:9980',
      })
    })

    it('http: should be able to use proxy middleware', () => {
      const body = 'Just some plain text for you to consume + proxy'
      const request = getIt([
        baseUrl,
        debugRequest,
        proxyMiddleware({host: 'localhost', port: 4000}),
      ])

      const req = request({url: '/plain-text'})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('http: proxy middleware with `false` disables env vars', () => {
      process.env.http_proxy = 'http://localhost:4000/'

      const body = 'Just some plain text for you to consume'
      const request = getIt([baseUrl, debugRequest, proxyMiddleware(false)])

      const req = request({url: '/plain-text'})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('http: per-request proxy options overrides proxy middleware', () => {
      const body = 'Just some plain text for you to consume + proxy'
      const request = getIt([baseUrl, debugRequest, proxyMiddleware(false)])

      const req = request({url: '/plain-text', proxy: {host: 'localhost', port: 4000}})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    // =============
    // === https ===
    // =============
    it('https: should be able to request with proxy on per-request basis', () => {
      const body = 'Just some plain text for you to consume + proxy'
      const request = getIt([baseUrl, debugRequest])

      const req = request({
        url: '/plain-text',
        proxy: {host: 'localhost', port: 4443, protocol: 'https:'},
      })
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('https: should support proxy set via env var (http request)', () => {
      const body = 'Just some plain text for you to consume + proxy'
      const request = getIt([baseUrl, debugRequest])

      process.env.http_proxy = 'https://localhost:4443/'
      const req = request({url: '/plain-text'})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('https: should not pass through disabled proxy (http request)', () => {
      process.env.http_proxy = 'http://does-not-exists.example.com:4242/'

      const body = 'Just some plain text for you to consume'
      const request = getIt([baseUrl, debugRequest])

      const req = request({url: '/plain-text', proxy: false})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('https: should only use proxy for domains not in no_proxy (http request)', () => {
      const body = 'Just some plain text for you to consume'
      const proxyBody = `${body} + proxy`
      const request = getIt([baseUrl, debugRequest])

      process.env.http_proxy = 'https://localhost:4443/'
      process.env.no_proxy = 'foo.com, localhost,bar.net , , quix.co'

      const url = '/plain-text'
      const absUrl = `${baseUrlPrefix.replace('localhost', '127.0.0.1')}/plain-text`

      return Promise.all([
        expectRequest(request({url})).resolves.toHaveProperty('body', body),
        expectRequest(request({url: absUrl})).resolves.toHaveProperty('body', proxyBody),
      ])
    })

    it('https: should support HTTP proxy auth from env (http request)', async () => {
      process.env.http_proxy = 'https://user:pass@localhost:4443/'

      const request = getIt([baseUrl, debugRequest])

      const req = request({url: '/plain-text'})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('headers')
      expect(res.headers).toMatchObject({
        'x-proxy-auth': 'Basic dXNlcjpwYXNz',
      })
    })

    it('https: should support proxy set via env var (https request / no tunnel)', () => {
      const body = 'Just some secure, plain text for you to consume + proxy'
      const request = getIt([baseUrlHttps, debugRequest])

      process.env.https_proxy = 'https://localhost:4443/'
      const req = request({url: '/plain-text', tunnel: false})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it.todo('https: should support proxy set via env var (https request / tunnel)')

    it('https: should not pass through disabled proxy (https request)', () => {
      process.env.https_proxy = 'http://does-not-exists.example.com:4242/'

      const body = 'Just some secure, plain text for you to consume'
      const request = getIt([baseUrlHttps, debugRequest])

      const req = request({url: '/plain-text', proxy: false})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('https: should proxy domains not in no_proxy (https request / no tunnel)', () => {
      const body = 'Just some secure, plain text for you to consume'
      const proxyBody = `${body} + proxy`
      const request = getIt([baseUrlHttps, debugRequest])

      process.env.https_proxy = 'https://localhost:4443/'
      process.env.no_proxy = 'foo.com, localhost,bar.net , , quix.co'
      const tunnel = false
      const url = '/plain-text'
      const abUrl = `${baseUrlPrefixHttps.replace('localhost', '127.0.0.1')}/plain-text`

      return Promise.all([
        expectRequest(request({url, tunnel})).resolves.toHaveProperty('body', body),
        expectRequest(request({url: abUrl, tunnel})).resolves.toHaveProperty('body', proxyBody),
      ])
    })

    it.todo('https: should proxy domains not in no_proxy (https request / tunnel)')

    it('https: should support HTTP proxy auth from env (https request / no tunnel)', async () => {
      process.env.https_proxy = 'https://user:pass@localhost:4443/'

      const request = getIt([baseUrlHttps, debugRequest])

      const req = request({url: '/plain-text', tunnel: false})
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('headers')
      expect(res.headers).toMatchObject({
        'x-proxy-auth': 'Basic dXNlcjpwYXNz',
      })
    })

    it.todo('https: should support HTTP proxy auth from env (https request / tunnel)')

    it('https: should support HTTP proxy auth', async () => {
      const request = getIt([baseUrl, debugRequest])

      const req = request({
        url: '/plain-text',
        proxy: {
          host: 'localhost',
          port: 4443,
          protocol: 'https:',
          auth: {username: 'user', password: 'pass'},
        },
      })
      const res = await promiseRequest(req)
      expect(res).toHaveProperty('headers')
      expect(res.headers).toMatchObject({
        'x-proxy-auth': 'Basic dXNlcjpwYXNz',
      })
    })

    it('https: should be able to use proxy middleware', () => {
      const body = 'Just some plain text for you to consume + proxy'
      const request = getIt([
        baseUrl,
        debugRequest,
        proxyMiddleware({host: 'localhost', port: 4443, protocol: 'https:'}),
      ])

      const req = request({url: '/plain-text'})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('https: proxy middleware with `false` disables env vars (http request)', () => {
      process.env.http_proxy = 'https://localhost:4443/'

      const body = 'Just some plain text for you to consume'
      const request = getIt([baseUrl, debugRequest, proxyMiddleware(false)])

      const req = request({url: '/plain-text'})
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })

    it('https: per-request proxy options overrides proxy middleware', () => {
      const body = 'Just some plain text for you to consume + proxy'
      const request = getIt([baseUrl, debugRequest, proxyMiddleware(false)])

      const req = request({
        url: '/plain-text',
        proxy: {host: 'localhost', port: 4443, protocol: 'https:'},
      })
      return expectRequest(req).resolves.toHaveProperty('body', body)
    })
  },
  {timeout: 15000}
)
