import {format, type UrlWithStringQuery} from 'url'

/**
 * Drop-in replacement for the deprecated `url.parse()` (DEP0169), built on the
 * WHATWG `URL` parser but returning the legacy `UrlWithStringQuery` shape that
 * the node request adapter spreads into `http.request()` options and exposes
 * to `finalizeOptions` middleware.
 *
 * Legacy behaviors preserved on purpose:
 * - `auth` is percent-decoded (throws `URIError` on malformed sequences, like
 *   `url.parse` did) - the tunnel agent and `http.request()` base64 it verbatim
 * - an explicitly written empty password (`http://user:@x`) keeps its colon,
 *   which WHATWG can't express (it reports the same empty `password` as
 *   `http://user@x`), and which `Basic` credentials require
 * - explicitly written default ports (`http://x:80`) are kept in `port`/`host`
 * - `hostname` has no brackets around IPv6 addresses
 * - the characters `url.parse` auto-escaped but WHATWG leaves literal (see
 *   `AUTO_ESCAPE`) stay escaped, since `path` goes out on the wire as-is
 * - relative input returns the "everything null except path parts" shape
 *   instead of throwing (but a *malformed absolute* URL throws - see below)
 *
 * Deliberate deviations, where WHATWG is more correct and matching legacy would
 * mean re-implementing its path parser against the raw string:
 * - `.`/`..` path segments are resolved (`/a/../b` -> `/b`), which is what the
 *   fetch and xhr adapters already do, since they hand the URL to the platform
 * - non-ASCII path/query characters are percent-encoded as UTF-8 instead of
 *   being passed through as raw bytes
 * - a malformed authority (`http://x:99999`, `http://user:p/w@x`) throws rather
 *   than reporting legacy's guesswork (it read those as host `x` and host
 *   `user`), because the alternative is a request to the wrong host
 */
export function parseUri(uri: string): UrlWithStringQuery {
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch (err) {
    // Only genuinely relative input gets the lenient fallback. An absolute URL
    // the parser rejected (invalid port, malformed IPv6) must not fall through
    // to it: `host` would be null, which `http.request()` defaults to localhost
    // while putting the whole URI in `path` - silently sending a request meant
    // for a remote host to the local machine. Legacy failed on the bad
    // authority instead, so throw, as `url.parse` itself did for some of these
    if (HAS_AUTHORITY.test(uri.trim())) {
      throw err
    }

    return withHref(parseRelative(uri))
  }

  // The raw authority is the only place some legacy details survive, since
  // WHATWG normalizes them away before we get to look at the parsed parts
  const authority = getAuthority(uri)

  const auth = recoverAuth(authority, parsed)

  // Legacy `hostname` has no brackets around IPv6 addresses, WHATWG does
  const hostname = parsed.hostname.startsWith('[') ? parsed.hostname.slice(1, -1) : parsed.hostname

  // WHATWG strips explicitly written default ports (`http://x:80`) - recover
  // them, since the proxy/tunnel code connects to whatever `port` says
  const port = parsed.port || recoverExplicitPort(authority)
  const host = parsed.host ? `${parsed.host}${parsed.port || !port ? '' : `:${port}`}` : null

  const search = parsed.search ? autoEscape(parsed.search) : null
  const pathname = parsed.pathname ? autoEscape(parsed.pathname) : null
  const path = pathname === null && search === null ? null : `${pathname || ''}${search || ''}`

  return withHref({
    protocol: parsed.protocol,
    slashes: parsed.href.startsWith(`${parsed.protocol}//`) || null,
    auth,
    host,
    port: port || null,
    hostname: hostname || null,
    hash: parsed.hash ? autoEscape(parsed.hash) : null,
    search,
    query: search ? search.slice(1) : null,
    pathname,
    path,
  })
}

// Legacy `href` is the re-serialization of the parsed parts (e.g. auth is
// re-encoded with url.format's encoder, recovered ports are included), which
// is exactly what the non-deprecated `url.format()` produces
function withHref(parts: Omit<UrlWithStringQuery, 'href'>): UrlWithStringQuery {
  return {...parts, href: format(parts)}
}

// The characters `url.parse` percent-escaped, which it did uniformly across the
// path, query and fragment. Keeping them escaped matters because `path` is handed
// to `http.request()` verbatim, and a literal `|` or `{` in a request target
// isn't valid per RFC 3986 - strict servers and proxies reject it.
//
// The WHATWG parser escapes most of these already, but *which* ones varies by
// Node version (`^` in a path is literal on Node 22, escaped on Node 24), so
// re-escape the whole set rather than just the current gap: it's a no-op for the
// characters the parser already handled, and doesn't rot when the spec moves.
const AUTO_ESCAPE = /[ "'<>\\^`{|}]/g

function autoEscape(value: string): string {
  return value.replace(AUTO_ESCAPE, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

// `scheme://` - i.e. the input carries an authority, so it isn't relative
const HAS_AUTHORITY = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//

function getAuthority(uri: string): string {
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]*)/.exec(uri.trim())
  return match ? match[1] : ''
}

// Legacy `auth` is the userinfo verbatim (percent-decoded), so it distinguishes
// `user` from `user:` - WHATWG doesn't, so the separator has to come from the
// raw userinfo. Like legacy, the *last* `@` ends it, so an unencoded `@` in the
// password (`user:p@ss@host`) is handled the same way.
function recoverAuth(authority: string, parsed: URL): string | null {
  const at = authority.lastIndexOf('@')
  if (at === -1) {
    return null
  }

  const username = decodeURIComponent(parsed.username)
  return authority.slice(0, at).includes(':')
    ? `${username}:${decodeURIComponent(parsed.password)}`
    : username
}

function recoverExplicitPort(authority: string): string {
  const hostPart = authority.slice(authority.lastIndexOf('@') + 1)
  const port = /:(\d+)$/.exec(hostPart)
  return port ? port[1] : ''
}

function parseRelative(uri: string): Omit<UrlWithStringQuery, 'href'> {
  const hashIndex = uri.indexOf('#')
  const beforeHash = hashIndex === -1 ? uri : uri.slice(0, hashIndex)
  const searchIndex = beforeHash.indexOf('?')
  const search = searchIndex === -1 ? null : beforeHash.slice(searchIndex)
  const pathname = (searchIndex === -1 ? beforeHash : beforeHash.slice(0, searchIndex)) || null

  return {
    protocol: null,
    slashes: null,
    auth: null,
    host: null,
    port: null,
    hostname: null,
    hash: hashIndex === -1 ? null : uri.slice(hashIndex),
    search,
    query: search ? search.slice(1) : null,
    pathname,
    path: beforeHash || null,
  }
}
