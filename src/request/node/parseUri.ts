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
 * - relative/unparseable input returns the "everything null except path parts"
 *   shape instead of throwing
 */
export function parseUri(uri: string): UrlWithStringQuery {
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch {
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

  const search = parsed.search || null
  const pathname = parsed.pathname || null
  const path = pathname === null && search === null ? null : `${pathname || ''}${search || ''}`

  return withHref({
    protocol: parsed.protocol,
    slashes: parsed.href.startsWith(`${parsed.protocol}//`) || null,
    auth,
    host,
    port: port || null,
    hostname: hostname || null,
    hash: parsed.hash || null,
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
