/**
 * Parses a URL string into the shape expected by `http.request()` and `follow-redirects`,
 * replacing the deprecated `url.parse()` API.
 */
export interface ParsedUrl {
  protocol: string
  hostname: string
  port: string
  path: string
  auth: string | null
  host: string
  href: string
  query: string
}

export function parseUrl(input: string): ParsedUrl {
  const url = new URL(input)
  const auth =
    url.username || url.password
      ? `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`
      : null

  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    path: `${url.pathname}${url.search}`,
    auth,
    host: url.port ? `${url.hostname}:${url.port}` : url.hostname,
    href: url.href,
    query: url.search ? url.search.slice(1) : '',
  }
}
