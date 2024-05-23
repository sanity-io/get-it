import decompressResponse from 'decompress-response'
import follow, {type FollowResponse, type RedirectableRequest} from 'follow-redirects'
import type {FinalizeNodeOptionsPayload, HttpRequest, MiddlewareResponse} from 'get-it'
import http from 'http'
import https from 'https'
import progressStream from 'progress-stream'
import qs from 'querystring'
import {Readable, type Stream} from 'stream'
import url from 'url'

import {lowerCaseHeaders} from '../util/lowerCaseHeaders'
import {getProxyOptions, rewriteUriForProxy} from './node/proxy'
import {concat} from './node/simpleConcat'
import {timedOut} from './node/timedOut'
import * as tunneling from './node/tunnel'

/**
 * Taken from:
 * https://github.com/sindresorhus/is-stream/blob/fb8caed475b4107cee3c22be3252a904020eb2d4/index.js#L3-L6
 */
const isStream = (stream: any): stream is Stream =>
  stream !== null && typeof stream === 'object' && typeof stream.pipe === 'function'

/** @public */
export const adapter = 'node' satisfies import('../types').RequestAdapter

// Reduce a fully fledged node-style response object to
// something that works in both browser and node environment
const reduceResponse = (
  res: any,
  reqUrl: string,
  method: string,
  body: any,
): MiddlewareResponse => ({
  body,
  url: reqUrl,
  method: method,
  headers: res.headers,
  statusCode: res.statusCode,
  statusMessage: res.statusMessage,
})

export const httpRequester: HttpRequest = (context, cb) => {
  const {options} = context
  const uri = Object.assign({}, url.parse(options.url))

  if (typeof fetch === 'function' && options.fetch) {
    const controller = new AbortController()
    const reqOpts = context.applyMiddleware('finalizeOptions', {
      ...uri,
      method: options.method,
      headers: {
        ...(typeof options.fetch === 'object' && options.fetch.headers
          ? lowerCaseHeaders(options.fetch.headers)
          : {}),
        ...lowerCaseHeaders(options.headers),
      },
      maxRedirects: options.maxRedirects,
    }) as FinalizeNodeOptionsPayload
    const fetchOpts = {
      credentials: options.withCredentials ? 'include' : 'omit',
      ...(typeof options.fetch === 'object' ? options.fetch : {}),
      method: reqOpts.method,
      headers: reqOpts.headers,
      body: options.body,
      signal: controller.signal,
    } satisfies RequestInit

    // Allow middleware to inject a response, for instance in the case of caching or mocking
    const injectedResponse = context.applyMiddleware('interceptRequest', undefined, {
      adapter,
      context,
    })

    // If middleware injected a response, treat it as we normally would and return it
    // Do note that the injected response has to be reduced to a cross-environment friendly response
    if (injectedResponse) {
      const cbTimer = setTimeout(cb, 0, null, injectedResponse)
      const cancel = () => clearTimeout(cbTimer)
      return {abort: cancel}
    }

    const request = fetch(options.url, fetchOpts)

    // Let middleware know we're about to do a request
    context.applyMiddleware('onRequest', {options, adapter, request, context})

    request
      .then(async (res) => {
        const body = options.rawBody ? res.body : await res.text()

        const headers = {} as Record<string, string>
        res.headers.forEach((value, key) => {
          headers[key] = value
        })

        cb(null, {
          body,
          url: res.url,
          method: options.method!,
          headers,
          statusCode: res.status,
          statusMessage: res.statusText,
        })
      })
      .catch((err) => {
        if (err.name == 'AbortError') return
        cb(err)
      })

    return {abort: () => controller.abort()}
  }

  const bodyType = isStream(options.body) ? 'stream' : typeof options.body
  if (
    bodyType !== 'undefined' &&
    bodyType !== 'stream' &&
    bodyType !== 'string' &&
    !Buffer.isBuffer(options.body)
  ) {
    throw new Error(`Request body must be a string, buffer or stream, got ${bodyType}`)
  }

  const lengthHeader: any = {}
  if (options.bodySize) {
    lengthHeader['content-length'] = options.bodySize
  } else if (options.body && bodyType !== 'stream') {
    lengthHeader['content-length'] = Buffer.byteLength(options.body)
  }

  // Make sure callback is not called in the event of a cancellation
  let aborted = false
  const callback = (err: Error | null, res?: MiddlewareResponse) => !aborted && cb(err, res)
  context.channels.abort.subscribe(() => {
    aborted = true
  })

  // Create a reduced subset of options meant for the http.request() method
  let reqOpts: any = Object.assign({}, uri, {
    method: options.method,
    headers: Object.assign({}, lowerCaseHeaders(options.headers), lengthHeader),
    maxRedirects: options.maxRedirects,
  })

  // Figure out proxying/tunnel options
  const proxy = getProxyOptions(options)
  const tunnel = proxy && tunneling.shouldEnable(options)

  // Allow middleware to inject a response, for instance in the case of caching or mocking
  const injectedResponse = context.applyMiddleware('interceptRequest', undefined, {
    adapter,
    context,
  })

  // If middleware injected a response, treat it as we normally would and return it
  // Do note that the injected response has to be reduced to a cross-environment friendly response
  if (injectedResponse) {
    const cbTimer = setImmediate(callback, null, injectedResponse)
    const abort = () => clearImmediate(cbTimer)
    return {abort}
  }

  // We're using the follow-redirects module to transparently follow redirects
  if (options.maxRedirects !== 0) {
    reqOpts.maxRedirects = options.maxRedirects || 5
  }

  // Apply currect options for proxy tunneling, if enabled
  if (proxy && tunnel) {
    reqOpts = tunneling.applyAgent(reqOpts, proxy)
  } else if (proxy && !tunnel) {
    reqOpts = rewriteUriForProxy(reqOpts, uri, proxy)
  }

  // Handle proxy authorization if present
  if (!tunnel && proxy && proxy.auth && !reqOpts.headers['proxy-authorization']) {
    const [username, password] = proxy.auth.username
      ? [proxy.auth.username, proxy.auth.password]
      : proxy.auth.split(':').map((item: any) => qs.unescape(item))

    const auth = Buffer.from(`${username}:${password}`, 'utf8')
    const authBase64 = auth.toString('base64')
    reqOpts.headers['proxy-authorization'] = `Basic ${authBase64}`
  }

  // Figure out transport (http/https, forwarding/non-forwarding agent)
  const transport = getRequestTransport(reqOpts, proxy, tunnel)
  if (typeof options.debug === 'function' && proxy) {
    options.debug(
      'Proxying using %s',
      reqOpts.agent ? 'tunnel agent' : `${reqOpts.host}:${reqOpts.port}`,
    )
  }

  // See if we should try to request a compressed response (and decompress on return)
  const tryCompressed = reqOpts.method !== 'HEAD'
  if (tryCompressed && !reqOpts.headers['accept-encoding'] && options.compress !== false) {
    reqOpts.headers['accept-encoding'] =
      // Workaround Bun not supporting brotli: https://github.com/oven-sh/bun/issues/267
      typeof Bun !== 'undefined' ? 'gzip, deflate' : 'br, gzip, deflate'
  }

  const finalOptions = context.applyMiddleware(
    'finalizeOptions',
    reqOpts,
  ) as FinalizeNodeOptionsPayload
  const request = transport.request(finalOptions, (response) => {
    const res = tryCompressed ? decompressResponse(response) : response
    const resStream = context.applyMiddleware('onHeaders', res, {
      headers: response.headers,
      adapter,
      context,
    })

    // On redirects, `responseUrl` is set
    const reqUrl = 'responseUrl' in response ? response.responseUrl : options.url

    if (options.stream) {
      callback(null, reduceResponse(res, reqUrl, reqOpts.method, resStream))
      return
    }

    // Concatenate the response body, then parse the response with middlewares
    concat(resStream, (err: any, data: any) => {
      if (err) {
        return callback(err)
      }

      const body = options.rawBody ? data : data.toString()
      const reduced = reduceResponse(res, reqUrl, reqOpts.method, body)
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

function getProgressStream(options: any) {
  if (!options.body) {
    return {}
  }

  const bodyIsStream = isStream(options.body)
  const length = options.bodySize || (bodyIsStream ? null : Buffer.byteLength(options.body))
  if (!length) {
    return bodyIsStream ? {bodyStream: options.body} : {}
  }

  const progress = progressStream({time: 16, length})
  const bodyStream = bodyIsStream ? options.body : Readable.from(options.body)
  return {bodyStream: bodyStream.pipe(progress), progress}
}

function getRequestTransport(
  reqOpts: any,
  proxy: any,
  tunnel: any,
): {
  request: (
    options: any,
    callback: (response: http.IncomingMessage | (http.IncomingMessage & FollowResponse)) => void,
  ) => http.ClientRequest | RedirectableRequest<http.ClientRequest, http.IncomingMessage>
} {
  const isHttpsRequest = reqOpts.protocol === 'https:'
  const transports =
    reqOpts.maxRedirects === 0
      ? {http: http, https: https}
      : {http: follow.http, https: follow.https}

  if (!proxy || tunnel) {
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
