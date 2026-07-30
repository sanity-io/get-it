import {describe, expect, it} from 'vitest'

import {parseUri} from '../src/request/node/parseUri'

// `parseUri` replaces the deprecated `url.parse()` (DEP0169) but must keep
// returning the exact same legacy `UrlWithStringQuery` shape, since the object
// is spread into `http.request()` options and exposed to `finalizeOptions`
// middleware. The expected objects below are captured verbatim from
// `url.parse()` output.
describe('parseUri', () => {
  const cases: [string, Record<string, unknown>][] = [
    [
      'http://example.com',
      {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://example.com/',
      },
    ],
    [
      'https://example.com/path/to/thing?foo=bar&baz=1#section',
      {
        protocol: 'https:',
        slashes: true,
        auth: null,
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: '#section',
        search: '?foo=bar&baz=1',
        query: 'foo=bar&baz=1',
        pathname: '/path/to/thing',
        path: '/path/to/thing?foo=bar&baz=1',
        href: 'https://example.com/path/to/thing?foo=bar&baz=1#section',
      },
    ],
    [
      'http://user:pass@example.com:8080/x?y=1',
      {
        protocol: 'http:',
        slashes: true,
        auth: 'user:pass',
        host: 'example.com:8080',
        port: '8080',
        hostname: 'example.com',
        hash: null,
        search: '?y=1',
        query: 'y=1',
        pathname: '/x',
        path: '/x?y=1',
        href: 'http://user:pass@example.com:8080/x?y=1',
      },
    ],
    [
      'http://localhost:3000',
      {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: 'localhost:3000',
        port: '3000',
        hostname: 'localhost',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://localhost:3000/',
      },
    ],
    [
      'https://[::1]:8443/ipv6',
      {
        protocol: 'https:',
        slashes: true,
        auth: null,
        host: '[::1]:8443',
        port: '8443',
        hostname: '::1',
        hash: null,
        search: null,
        query: null,
        pathname: '/ipv6',
        path: '/ipv6',
        href: 'https://[::1]:8443/ipv6',
      },
    ],
    [
      'http://example.com/percent%20encoded?q=a%26b',
      {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: '?q=a%26b',
        query: 'q=a%26b',
        pathname: '/percent%20encoded',
        path: '/percent%20encoded?q=a%26b',
        href: 'http://example.com/percent%20encoded?q=a%26b',
      },
    ],
    // auth must be percent-decoded like legacy url.parse: the tunnel agent and
    // http.request() base64 it verbatim for (Proxy-)Authorization headers
    [
      'http://user:p%40ss@example.com/x',
      {
        protocol: 'http:',
        slashes: true,
        auth: 'user:p@ss',
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: null,
        query: null,
        pathname: '/x',
        path: '/x',
        href: 'http://user:p%40ss@example.com/x',
      },
    ],
    [
      'http://user:pa%3Ass@x.com/',
      {
        protocol: 'http:',
        slashes: true,
        auth: 'user:pa:ss',
        host: 'x.com',
        port: null,
        hostname: 'x.com',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://user:pa:ss@x.com/',
      },
    ],
    // explicit default ports must survive: proxy/tunnel code reads uri.port to
    // decide which port to connect to (WHATWG URL strips them)
    [
      'http://proxy.corp:80',
      {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: 'proxy.corp:80',
        port: '80',
        hostname: 'proxy.corp',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://proxy.corp:80/',
      },
    ],
    [
      'https://proxy.corp:443',
      {
        protocol: 'https:',
        slashes: true,
        auth: null,
        host: 'proxy.corp:443',
        port: '443',
        hostname: 'proxy.corp',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'https://proxy.corp:443/',
      },
    ],
    [
      'https://[::1]:443/a',
      {
        protocol: 'https:',
        slashes: true,
        auth: null,
        host: '[::1]:443',
        port: '443',
        hostname: '::1',
        hash: null,
        search: null,
        query: null,
        pathname: '/a',
        path: '/a',
        href: 'https://[::1]:443/a',
      },
    ],
    [
      'http://user@example.com/',
      {
        protocol: 'http:',
        slashes: true,
        auth: 'user',
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://user@example.com/',
      },
    ],
    // an explicitly written empty password must keep its colon: `Basic`
    // credentials require the separator, and WHATWG reports the same empty
    // `password` here as it does for `http://user@example.com/` above
    [
      'http://user:@example.com/',
      {
        protocol: 'http:',
        slashes: true,
        auth: 'user:',
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://user:@example.com/',
      },
    ],
    [
      'http://:pass@example.com/',
      {
        protocol: 'http:',
        slashes: true,
        auth: ':pass',
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://:pass@example.com/',
      },
    ],
    [
      'http://@example.com/',
      {
        protocol: 'http:',
        slashes: true,
        auth: '',
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://example.com/',
      },
    ],
    [
      'http://:@example.com/',
      {
        protocol: 'http:',
        slashes: true,
        auth: ':',
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://:@example.com/',
      },
    ],
    // legacy ends the userinfo at the *last* `@`, so an unencoded `@` in the
    // password belongs to the password
    [
      'http://user:p@ss@example.com/',
      {
        protocol: 'http:',
        slashes: true,
        auth: 'user:p@ss',
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: null,
        query: null,
        pathname: '/',
        path: '/',
        href: 'http://user:p%40ss@example.com/',
      },
    ],
  ]

  it.each(cases)('parses %s like legacy url.parse', (input, expected) => {
    expect({...parseUri(input)}).toEqual(expected)
  })

  it('throws URIError on malformed percent-encoding in userinfo, like legacy url.parse', () => {
    expect(() => parseUri('http://us%er@x.com/')).toThrow(URIError)
  })

  it('does not throw on non-absolute input, mimicking legacy fallback shape', () => {
    expect({...parseUri('/just/a/path?q=1')}).toEqual({
      protocol: null,
      slashes: null,
      auth: null,
      host: null,
      port: null,
      hostname: null,
      hash: null,
      search: '?q=1',
      query: 'q=1',
      pathname: '/just/a/path',
      path: '/just/a/path?q=1',
      href: '/just/a/path?q=1',
    })
  })
})
