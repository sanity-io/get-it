/**
 * Code borrowed from https://github.com/request/request
 * Apache License 2.0
 */

import url from 'node:url'

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

function uriInNoProxy(uri: any, noProxy: any) {
  const port = uri.port || (uri.protocol === 'https:' ? '443' : '80')
  const hostname = formatHostname(uri.hostname)
  const noProxyList = noProxy.split(',')

  // iterate through the noProxyList until it finds a match.
  return noProxyList.map(parseNoProxyZone).some((noProxyZone: any) => {
    const isMatchedAt = hostname.indexOf(noProxyZone.hostname)
    const hostnameMatched =
      isMatchedAt > -1 && isMatchedAt === hostname.length - noProxyZone.hostname.length

    if (noProxyZone.hasPort) {
      return port === noProxyZone.port && hostnameMatched
    }

    return hostnameMatched
  })
}

function getProxyFromUri(uri: any) {
  // Decide the proper request proxy to use based on the request URI object and the
  // environmental variables (NO_PROXY, HTTP_PROXY, etc.)
  // respect NO_PROXY environment variables (see: http://lynx.isc.org/current/breakout/lynx_help/keystrokes/environments.html)
  const noProxy = process.env.NO_PROXY || process.env.no_proxy || ''

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
    return process.env.HTTP_PROXY || process.env.http_proxy || null
  }

  if (uri.protocol === 'https:') {
    return (
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy ||
      null
    )
  }

  // if none of that works, return null
  // (What uri protocol are you using then?)
  return null
}

function getHostFromUri(uri: any) {
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

function getHostHeaderWithPort(uri: any) {
  const port = uri.port || (uri.protocol === 'https:' ? '443' : '80')
  return `${uri.hostname}:${port}`
}

export function rewriteUriForProxy(reqOpts: any, uri: any, proxy: any) {
  const headers = reqOpts.headers || {}
  const options = Object.assign({}, reqOpts, {headers})
  headers.host = headers.host || getHostHeaderWithPort(uri)
  options.protocol = proxy.protocol || options.protocol
  options.hostname = proxy.host.replace(/:\d+/, '')
  options.port = proxy.port
  options.host = getHostFromUri(Object.assign({}, uri, proxy))
  options.href = `${options.protocol}//${options.host}${options.path}`
  options.path = url.format(uri)
  return options
}

export function getProxyOptions(options: any) {
  let proxy
  // eslint-disable-next-line no-prototype-builtins
  if (options.hasOwnProperty('proxy')) {
    proxy = options.proxy
  } else {
    const uri = url.parse(options.url)
    proxy = getProxyFromUri(uri)
  }

  return typeof proxy === 'string' ? url.parse(proxy) : proxy
}
