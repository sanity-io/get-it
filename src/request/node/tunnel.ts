/**
 * Code borrowed from https://github.com/request/request
 * Modified to be less request-specific, more functional
 * Apache License 2.0
 */
import * as tunnel from 'tunnel-agent'
import url from 'url'

const uriParts = [
  'protocol',
  'slashes',
  'auth',
  'host',
  'port',
  'hostname',
  'hash',
  'search',
  'query',
  'pathname',
  'path',
  'href',
]

const defaultProxyHeaderWhiteList = [
  'accept',
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'accept-ranges',
  'cache-control',
  'content-encoding',
  'content-language',
  'content-location',
  'content-md5',
  'content-range',
  'content-type',
  'connection',
  'date',
  'expect',
  'max-forwards',
  'pragma',
  'referer',
  'te',
  'user-agent',
  'via',
]

const defaultProxyHeaderExclusiveList = ['proxy-authorization']

export function shouldEnable(options: any) {
  // Tunnel HTTPS by default. Allow the user to override this setting.

  // If user has specified a specific tunnel override...
  if (typeof options.tunnel !== 'undefined') {
    return Boolean(options.tunnel)
  }

  // If the destination is HTTPS, tunnel.
  const uri = url.parse(options.url)
  if (uri.protocol === 'https:') {
    return true
  }

  // Otherwise, do not use tunnel.
  return false
}

export function applyAgent(opts: any = {}, proxy: any) {
  const options = Object.assign({}, opts)

  // Setup proxy header exclusive list and whitelist
  const proxyHeaderWhiteList = defaultProxyHeaderWhiteList
    .concat(options.proxyHeaderWhiteList || [])
    .map((header) => header.toLowerCase())

  const proxyHeaderExclusiveList = defaultProxyHeaderExclusiveList
    .concat(options.proxyHeaderExclusiveList || [])
    .map((header) => header.toLowerCase())

  // Get the headers we should send to the proxy
  const proxyHeaders = getAllowedProxyHeaders(options.headers, proxyHeaderWhiteList)
  proxyHeaders.host = constructProxyHost(options)

  // Reduce headers to the ones not exclusive for the proxy
  options.headers = Object.keys(options.headers || {}).reduce((headers, header) => {
    const isAllowed = proxyHeaderExclusiveList.indexOf(header.toLowerCase()) === -1
    if (isAllowed) {
      headers[header] = options.headers[header]
    }

    return headers
  }, {} as any)

  const tunnelFn = getTunnelFn(options, proxy)
  const tunnelOptions = constructTunnelOptions(options, proxy, proxyHeaders)
  options.agent = tunnelFn(tunnelOptions)

  return options
}

function getTunnelFn(options: any, proxy: any) {
  const uri = getUriParts(options)
  const tunnelFnName = constructTunnelFnName(uri, proxy)
  return tunnel[tunnelFnName]
}

function getUriParts(options: any) {
  return uriParts.reduce((uri, part) => {
    uri[part] = options[part]
    return uri
  }, {} as any)
}

type UriProtocol = `http` | `https`
type ProxyProtocol = `Http` | `Https`
function constructTunnelFnName(uri: any, proxy: any): `${UriProtocol}Over${ProxyProtocol}` {
  const uriProtocol = uri.protocol === 'https:' ? 'https' : 'http'
  const proxyProtocol = proxy.protocol === 'https:' ? 'Https' : 'Http'
  return `${uriProtocol}Over${proxyProtocol}`
}

function constructProxyHost(uri: any) {
  const port = uri.port
  const protocol = uri.protocol
  let proxyHost = `${uri.hostname}:`

  if (port) {
    proxyHost += port
  } else if (protocol === 'https:') {
    proxyHost += '443'
  } else {
    proxyHost += '80'
  }

  return proxyHost
}

function getAllowedProxyHeaders(headers: any, whiteList: any): any {
  return Object.keys(headers)
    .filter((header) => whiteList.indexOf(header.toLowerCase()) !== -1)
    .reduce((set: any, header: any) => {
      set[header] = headers[header]
      return set
    }, {})
}

function constructTunnelOptions(options: any, proxy: any, proxyHeaders: any) {
  return {
    proxy: {
      host: proxy.hostname,
      port: +proxy.port,
      proxyAuth: proxy.auth,
      headers: proxyHeaders,
    },
    headers: options.headers,
    ca: options.ca,
    cert: options.cert,
    key: options.key,
    passphrase: options.passphrase,
    pfx: options.pfx,
    ciphers: options.ciphers,
    rejectUnauthorized: options.rejectUnauthorized,
    secureOptions: options.secureOptions,
    secureProtocol: options.secureProtocol,
  }
}
