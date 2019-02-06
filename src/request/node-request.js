/* eslint-disable no-process-env */
const url = require('url')
const http = require('http')
const https = require('https')
const concat = require('simple-concat')
const follow = require('follow-redirects')
const timedOut = require('timed-out')
const isStream = require('is-stream')
const toStream = require('into-stream')
const objectAssign = require('object-assign')
const progressStream = require('progress-stream')
const decompressResponse = require('decompress-response')

const adapter = 'node'

// Reduce a fully fledged node-style response object to
// something that works in both browser and node environment
const reduceResponse = (res, reqUrl, method, body) => ({
  body,
  url: reqUrl,
  method: method,
  headers: res.headers,
  statusCode: res.statusCode,
  statusMessage: res.statusMessage
})

module.exports = (context, cb) => {
  const options = context.options
  const uri = objectAssign({}, url.parse(options.url))
  const bodyType = isStream(options.body) ? 'stream' : typeof options.body

  if (
    bodyType !== 'undefined' &&
    bodyType !== 'stream' &&
    bodyType !== 'string' &&
    !Buffer.isBuffer(options.body)
  ) {
    throw new Error(`Request body must be a string, buffer or stream, got ${bodyType}`)
  }

  const lengthHeader = {}
  if (options.bodySize) {
    lengthHeader['Content-Length'] = options.bodySize
  } else if (options.body && Buffer.isBuffer(options.body)) {
    lengthHeader['Content-Length'] = options.body.length
  }

  // Make sure callback is not called in the event of a cancellation
  let aborted = false
  const callback = (err, res) => !aborted && cb(err, res)
  context.channels.abort.subscribe(() => {
    aborted = true
  })

  // Create a reduced subset of options meant for the http.request() method
  const reqOpts = objectAssign({}, uri, {
    method: options.method,
    headers: objectAssign({}, options.headers, lengthHeader),
    maxRedirects: options.maxRedirects
  })

  // Allow middleware to inject a response, for instance in the case of caching or mocking
  const injectedResponse = context.applyMiddleware('interceptRequest', undefined, {
    adapter,
    context
  })

  // If middleware injected a response, treat it as we normally would and return it
  // Do note that the injected response has to be reduced to a cross-environment friendly response
  if (injectedResponse) {
    const cbTimer = setImmediate(callback, null, injectedResponse)
    const abort = () => clearImmediate(cbTimer)
    return {abort}
  }

  // Check for configured proxy
  const proxy = getProxyConfig(options, uri)
  if (proxy) {
    const port = uri.port ? `:${uri.port}` : ''
    reqOpts.hostname = proxy.host
    reqOpts.host = proxy.host
    reqOpts.headers.host = uri.hostname + port
    reqOpts.port = proxy.port
    reqOpts.path = `${uri.protocol}//${uri.hostname}${port}${uri.path}`

    // Basic proxy authorization
    if (proxy.auth) {
      const auth = Buffer.from(`${proxy.auth.username}:${proxy.auth.password}`, 'utf8')
      const authBase64 = auth.toString('base64')
      reqOpts.headers['Proxy-Authorization'] = `Basic ${authBase64}`
    }

    reqOpts.protocol = (proxy.protocol || reqOpts.protocol).replace(/:?$/, ':')
  }

  // We're using the follow-redirects module to transparently follow redirects
  if (options.maxRedirects !== 0) {
    reqOpts.maxRedirects = options.maxRedirects || 5
  }

  const transport = getRequestTransport(reqOpts, proxy)

  const request = transport.request(reqOpts, response => {
    // See if we should try to decompress the response
    const tryDecompress = reqOpts.method !== 'HEAD'
    const res = tryDecompress ? decompressResponse(response) : response

    const resStream = context.applyMiddleware('onHeaders', res, {
      headers: response.headers,
      adapter,
      context
    })

    // Concatenate the response body, then parse the response with middlewares
    concat(resStream, (err, data) => {
      if (err) {
        return callback(err)
      }

      const body = options.rawBody ? data : data.toString()
      const reduced = reduceResponse(
        res,
        response.responseUrl || options.url, // On redirects, `responseUrl` is set
        reqOpts.method,
        body
      )

      return callback(null, reduced)
    })
  })

  if (options.timeout) {
    timedOut(request, options.timeout)
  }

  request.once('error', callback)

  // Cheating a bit here; since we're not concerned about the "bundle size" in node,
  // and modifying the body stream would be sorta tricky, we're just always going
  // to put a progress stream in the middle here. Note that
  const {bodyStream, progress} = getProgressStream(options)

  // Let middleware know we're about to do a request
  context.applyMiddleware('onRequest', {options, adapter, request, context, progress})

  if (bodyStream) {
    bodyStream.pipe(request)
  } else {
    request.end(options.body)
  }

  return {abort: () => request.abort()}
}

function getProgressStream(options) {
  if (!options.body) {
    return {}
  }

  const bodyIsStream = isStream(options.body)
  const length = options.bodySize || (bodyIsStream ? null : Buffer.byteLength(options.body))
  if (!length) {
    return bodyIsStream ? {bodyStream: options.body} : {}
  }

  const progress = progressStream({time: 16, length})
  const bodyStream = bodyIsStream ? options.body : toStream(options.body)
  return {bodyStream: bodyStream.pipe(progress), progress}
}

function getRequestTransport(reqOpts, proxy) {
  const isHttpsRequest = reqOpts.protocol === 'https:'
  const transports =
    reqOpts.maxRedirects === 0
      ? {http: http, https: https}
      : {http: follow.http, https: follow.https}

  if (!proxy) {
    return isHttpsRequest ? transports.https : transports.http
  }

  // Assume the proxy is an HTTPS proxy if port is 443, or if there is a
  // `protocol` option set that starts with https
  let isHttpsProxy = proxy.port === 443
  if (proxy.protocol) {
    isHttpsProxy = /^https:?/.test(proxy.protocol)
  }

  return isHttpsProxy ? transports.https : transports.http
}

function getProxyConfig(options, uri) {
  let proxy = options.proxy
  if (proxy || proxy === false) {
    return proxy
  }

  const proxyEnv = `${uri.protocol.slice(0, -1)}_proxy`
  const proxyUrl = process.env[proxyEnv] || process.env[proxyEnv.toUpperCase()]
  if (!proxyUrl) {
    return proxy
  }

  const parsedProxyUrl = url.parse(proxyUrl)
  const noProxyEnv = process.env.no_proxy || process.env.NO_PROXY
  let shouldProxy = true

  if (noProxyEnv) {
    const noProxy = noProxyEnv.split(',').map(str => str.trim())

    shouldProxy = !noProxy.some(proxyElement => {
      if (!proxyElement) {
        return false
      }
      if (proxyElement === '*') {
        return true
      }
      if (
        proxyElement[0] === '.' &&
        uri.hostname.substr(uri.hostname.length - proxyElement.length) === proxyElement &&
        proxyElement.match(/\./g).length === uri.hostname.match(/\./g).length
      ) {
        return true
      }

      return uri.hostname === proxyElement
    })
  }

  if (shouldProxy) {
    proxy = {
      protocol: parsedProxyUrl.protocol,
      host: parsedProxyUrl.hostname,
      port: parsedProxyUrl.port
    }

    if (parsedProxyUrl.auth) {
      const proxyUrlAuth = parsedProxyUrl.auth.split(':')
      proxy.auth = {
        username: proxyUrlAuth[0],
        password: proxyUrlAuth[1]
      }
    }
  }

  return proxy
}
