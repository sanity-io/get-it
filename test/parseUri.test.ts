import url from 'url'
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
    // legacy auto-escaped ` "'<>\^`{|}` in the path, query and fragment alike,
    // and `path` goes out on the wire as-is, so they have to stay escaped. Which
    // of them the WHATWG parser escapes on its own is Node-version dependent,
    // which is what the differential sweep below guards
    [
      "http://example.com/it's?q=a|b",
      {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: null,
        search: '?q=a%7Cb',
        query: 'q=a%7Cb',
        pathname: '/it%27s',
        path: '/it%27s?q=a%7Cb',
        href: 'http://example.com/it%27s?q=a%7Cb',
      },
    ],
    // a GROQ-shaped query is the realistic case: `|`, `{` and `}` are common
    [
      'http://example.com/v1/data/query/prod?query={a}|order(x)^`#f|{x}',
      {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: 'example.com',
        port: null,
        hostname: 'example.com',
        hash: '#f%7C%7Bx%7D',
        search: '?query=%7Ba%7D%7Corder(x)%5E%60',
        query: 'query=%7Ba%7D%7Corder(x)%5E%60',
        pathname: '/v1/data/query/prod',
        path: '/v1/data/query/prod?query=%7Ba%7D%7Corder(x)%5E%60',
        href: 'http://example.com/v1/data/query/prod?query=%7Ba%7D%7Corder(x)%5E%60#f%7C%7Bx%7D',
      },
    ],
  ]

  it.each(cases)('parses %s like legacy url.parse', (input, expected) => {
    expect({...parseUri(input)}).toEqual(expected)
  })

  it('throws URIError on malformed percent-encoding in userinfo, like legacy url.parse', () => {
    expect(() => parseUri('http://us%er@x.com/')).toThrow(URIError)
  })

  // The hand-written cases above document the interesting inputs; this sweep is
  // what actually catches escaping and normalization drift, by diffing every
  // printable ASCII character in every component against the real `url.parse`
  it('matches legacy url.parse across a differential sweep', () => {
    const corpus: string[] = [
      'http://example.com',
      'http://example.com/',
      'http://example.com:8080/a?b=c#d',
      'http://example.com/a//b',
      'http://example.com/%7Euser',
      'http://example.com/%41?q=%42#%43',
      'http://example.com/a%2e%2e/b',
      'http://example.com/a?b#c?d',
    ]
    for (let code = 0x20; code < 0x7f; code++) {
      const char = String.fromCharCode(code)
      corpus.push(
        `http://example.com/a${char}b`,
        `http://example.com/p?q=a${char}b`,
        `http://example.com/p#f${char}g`,
        `http://user:p${char}w@example.com/p`,
      )
    }

    // Inputs the shim knowingly handles differently - see parseUri's doc comment
    const deviates = (uri: string) =>
      // dot segments are resolved and non-ASCII is percent-encoded, on purpose
      /\/\.\.?(\/|$)|[^ -~]/.test(uri) ||
      // `new URL()` rejects these (a `#`, `/`, `?` or `\` ends the authority
      // early), so parseUri throws. Legacy instead guessed, reporting
      // `host: 'user'` with `path: '/:p'` - a host nobody asked for
      /^http:\/\/user:p[#/?\\]w@/.test(uri) ||
      // WHATWG drops an empty query/fragment delimiter, legacy kept `?` / `#`.
      // No server routes on an empty query, so this stays as-is
      /[?#]+$/.test(uri)

    // Key order isn't part of the contract, and a thrown URIError has to match
    // too (both reject malformed percent-encoding in the userinfo)
    const snapshot = (parse: (uri: string) => object, uri: string) => {
      try {
        const parts = {...parse(uri)}
        return JSON.stringify(parts, Object.keys(parts).sort())
      } catch (err) {
        return `throws ${(err as Error).name}`
      }
    }

    const mismatches = corpus
      .filter((uri) => !deviates(uri))
      .map((uri) => ({
        uri,
        legacy: snapshot(url.parse, uri),
        actual: snapshot(parseUri, uri),
      }))
      .filter(({legacy, actual}) => legacy !== actual)

    expect(mismatches).toEqual([])
  })

  it('resolves dot segments and encodes non-ASCII, unlike legacy url.parse', () => {
    // Deliberate deviations: the fetch and xhr adapters already resolve dot
    // segments, and legacy passed non-ASCII through as raw bytes
    expect(parseUri('http://example.com/a/../b').path).toBe('/b')
    expect(parseUri('http://example.com/ä').path).toBe('/%C3%A4')
  })

  // A malformed absolute URL must never reach the relative fallback: that shape
  // has `host: null`, which `http.request()` defaults to localhost while putting
  // the whole URI in `path`, quietly sending the request to the local machine
  it.each([
    'http://x.com:99999/a',
    'http://x.com:abc/a',
    'http://x.com:-1/a',
    'http://[::1/a',
    'http://user:p/w@x.com/p',
    'https://exa mple.com/a',
    'http://%zz.com/a',
  ])('throws on the malformed absolute URL %s rather than falling back', (input) => {
    expect(() => parseUri(input)).toThrow()
  })

  it('never reports a null host for input carrying an authority', () => {
    // The property that keeps a request from being retargeted to localhost
    const inputs = ['http://x.com:99999/a', 'http://[::1/a', 'http://user:p/w@x.com/p']
    for (const input of inputs) {
      let parsed
      try {
        parsed = parseUri(input)
      } catch {
        continue // throwing is the intended outcome
      }
      expect(parsed.host).not.toBeNull()
    }
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
