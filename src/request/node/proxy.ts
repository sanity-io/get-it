/**
 * Code borrowed from https://github.com/request/request
 * Apache License 2.0
 */

import type {ProxyOptions, RequestOptions} from '../../types'
import {type ParsedUrl, parseUrl} from './parseUrl'

function formatHostname(hostname: string) {
  // canonicalize the hostname, so that 'oogle.com' won't match 'google.com'
  return hostname.replace(/^\.*/, '.').toLowerCase()
}

function parseNoProxyZone(zoneStr: string) {
  const zone = zoneStr.trim().toLowerCase()

  const zoneParts = zone.split(':', 2)
  const zoneHost = formatHostname(zoneParts[0])
  const zonePort = zoneParts[1]
  const hasPort = zone.indexOf(':') > -1

  return {hostname: zoneHost, port: zonePort, hasPort: hasPort}
}

function uriInNoProxy(uri: ParsedUrl, noProxy: string) {
  const port = uri.port || (uri.protocol === 'https:' ? '443' : '80')
  const hostname = formatHostname(uri.hostname || '')
  const noProxyList = noProxy.split(',')

  // iterate through the noProxyList until it finds a match.
  return noProxyList.map(parseNoProxyZone).some((noProxyZone) => {
    const isMatchedAt = hostname.indexOf(noProxyZone.hostname)
    const hostnameMatched =
      isMatchedAt > -1 && isMatchedAt === hostname.length - noProxyZone.hostname.length

    if (noProxyZone.hasPort) {
      return port === noProxyZone.port && hostnameMatched
    }

    return hostnameMatched
  })
}

function getProxyFromUri(uri: ParsedUrl): string | null {
  // Decide the proper request proxy to use based on the request URI object and the
  // environmental variables (NO_PROXY, HTTP_PROXY, etc.)
  // respect NO_PROXY environment variables (see: http://lynx.isc.org/current/breakout/lynx_help/keystrokes/environments.html)
  const noProxy = process.env['NO_PROXY'] || process.env['no_proxy'] || ''

  // if the noProxy is a wildcard then return null
  if (noProxy === '*') {
    return null
  }

  // if the noProxy is not empty and the uri is found return null
  if (noProxy !== '' && uriInNoProxy(uri, noProxy)) {
    return null
  }

  // Check for HTTP or HTTPS Proxy in environment, else default to null
  if (uri.protocol === 'http:') {
    return process.env['HTTP_PROXY'] || process.env['http_proxy'] || null
  }

  if (uri.protocol === 'https:') {
    return (
      process.env['HTTPS_PROXY'] ||
      process.env['https_proxy'] ||
      process.env['HTTP_PROXY'] ||
      process.env['http_proxy'] ||
      null
    )
  }

  // if none of that works, return null
  // (What uri protocol are you using then?)
  return null
}

function getHostFromUri(uri: ParsedUrl) {
  let host = uri.host

  // Drop :port suffix from Host header if known protocol.
  if (uri.port) {
    if (
      (uri.port === '80' && uri.protocol === 'http:') ||
      (uri.port === '443' && uri.protocol === 'https:')
    ) {
      host = uri.hostname
    }
  }

  return host
}

function getHostHeaderWithPort(uri: ParsedUrl) {
  const port = uri.port || (uri.protocol === 'https:' ? '443' : '80')
  return `${uri.hostname}:${port}`
}

export function rewriteUriForProxy(
  reqOpts: RequestOptions & ParsedUrl,
  uri: ParsedUrl,
  proxy: ParsedUrl | ProxyOptions,
) {
  const headers = reqOpts.headers || {}
  const options = Object.assign({}, reqOpts, {headers})
  headers.host = headers.host || getHostHeaderWithPort(uri)
  options.protocol = proxy.protocol || options.protocol
  options.hostname = (
    proxy.host ||
    ('hostname' in proxy && proxy.hostname) ||
    options.hostname ||
    ''
  ).replace(/:\d+/, '')
  options.port = proxy.port ? `${proxy.port}` : options.port
  options.host = getHostFromUri(Object.assign({}, uri, proxy))
  options.href = `${options.protocol}//${options.host}${options.path}`
  options.path = `${uri.protocol}//${uri.host}${uri.path}`
  return options
}

export function getProxyOptions(options: RequestOptions): ParsedUrl | ProxyOptions | null {
  const proxy =
    typeof options.proxy === 'undefined' ? getProxyFromUri(parseUrl(options.url)) : options.proxy

  return typeof proxy === 'string' ? parseUrl(proxy) : proxy || null
}
