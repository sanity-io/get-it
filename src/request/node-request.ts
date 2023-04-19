import http from 'node:http'
import https from 'node:https'
import url from 'node:url'

import decompressResponse from 'decompress-response'
import follow from 'follow-redirects'
import toStream from 'into-stream'
import progressStream from 'progress-stream'
import qs from 'querystring'

import {RequestAdapter} from '../types'
import {getProxyOptions, rewriteUriForProxy} from './node/proxy'
import {concat} from './node/simpleConcat'
import {timedOut} from './node/timedOut'
import * as tunneling from './node/tunnel'

/** @public */
export const adapter: RequestAdapter = 'node'

// Reduce a fully fledged node-style response object to
// something that works in both browser and node environment
const reduceResponse = (res: any, reqUrl: any, method: any, body: any) => ({
  body,
  url: reqUrl,
  method: method,
  headers: res.headers,
  statusCode: res.statusCode,
  statusMessage: res.statusMessage,
})

export default (context: any, cb: any) => {
  const options = context.options
  const uri = Object.assign({}, url.parse(options.url))

  const bodyType = isBlobLike(options.body)
    ? 'blob'
    : isStream(options.body)
    ? 'stream'
    : typeof options.body

  if (
    bodyType !== 'undefined' &&
    bodyType !== 'stream' &&
    bodyType !== 'string' &&
    bodyType !== 'blob' &&
    !isBuffer(options.body)
  ) {
    throw new Error(`Request body must be a string, file, blob, buffer or stream, got ${bodyType}`)
  }

  const lengthHeader: any = {}
  if (options.bodySize) {
    lengthHeader['content-length'] = options.bodySize
  } else if (options.body && bodyType !== 'stream') {
    lengthHeader['content-length'] = bodyLength(options.body)
  }

  // Make sure callback is not called in the event of a cancellation
  let aborted = false
  const callback = (err: any, res?: any) => !aborted && cb(err, res)
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
      reqOpts.agent ? 'tunnel agent' : `${reqOpts.host}:${reqOpts.port}`
    )
  }

  // See if we should try to request a compressed response (and decompress on return)
  const tryCompressed = reqOpts.method !== 'HEAD'
  if (tryCompressed && !reqOpts.headers['accept-encoding'] && options.compress !== false) {
    reqOpts.headers['accept-encoding'] = 'br, gzip, deflate'
  }

  const finalOptions = context.applyMiddleware('finalizeOptions', reqOpts)
  const request = transport.request(finalOptions, (response: any) => {
    const res = tryCompressed ? decompressResponse(response) : response
    const resStream = context.applyMiddleware('onHeaders', res, {
      headers: response.headers,
      adapter,
      context,
    })

    // On redirects, `responseUrl` is set
    const reqUrl = response.responseUrl || options.url

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
  const length = options.bodySize || (bodyIsStream ? null : bodyLength(options.body))
  if (!length) {
    return bodyIsStream ? {bodyStream: options.body} : {}
  }

  const progress = progressStream({time: 16, length})
  const bodyStream = bodyIsStream ? options.body : toStream(options.body)
  return {bodyStream: bodyStream.pipe(progress), progress}
}

function getRequestTransport(reqOpts: any, proxy: any, tunnel: any): any {
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

function lowerCaseHeaders(headers: any) {
  return Object.keys(headers || {}).reduce((acc, header) => {
    acc[header.toLowerCase()] = headers[header]
    return acc
  }, {} as any)
}

// https://github.com/nodejs/undici/blob/dfaec78f7a29f07bb043f9006ed0ceb0d5220b55/lib/core/util.js#L275-L278
function isBuffer(buffer: unknown): buffer is Buffer {
  // See, https://github.com/mcollina/undici/pull/319
  return buffer instanceof Uint8Array || Buffer.isBuffer(buffer)
}

// https://github.com/nodejs/undici/blob/dfaec78f7a29f07bb043f9006ed0ceb0d5220b55/lib/core/util.js#L17-L19
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isStream(obj: any): obj is NodeJS.ReadableStream {
  return (
    !!obj &&
    typeof obj === 'object' &&
    typeof obj.pipe === 'function' &&
    typeof obj.on === 'function'
  )
}

// https://github.com/nodejs/undici/blob/dfaec78f7a29f07bb043f9006ed0ceb0d5220b55/lib/core/util.js#L21-L30
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isBlobLike(object: any): object is Blob | File {
  return (
    (Blob && object instanceof Blob) ||
    (object &&
      typeof object === 'object' &&
      (typeof object.stream === 'function' || typeof object.arrayBuffer === 'function') &&
      /^(Blob|File)$/.test(object[Symbol.toStringTag]))
  )
}

// https://github.com/nodejs/undici/blob/dfaec78f7a29f07bb043f9006ed0ceb0d5220b55/lib/core/util.js#L397-L409
function isFormDataLike(object: any): object is FormData {
  return (
    object &&
    typeof object === 'object' &&
    typeof object.append === 'function' &&
    typeof object.delete === 'function' &&
    typeof object.get === 'function' &&
    typeof object.getAll === 'function' &&
    typeof object.has === 'function' &&
    typeof object.set === 'function' &&
    object[Symbol.toStringTag] === 'FormData'
  )
}

// https://github.com/nodejs/undici/blob/dfaec78f7a29f07bb043f9006ed0ceb0d5220b55/lib/core/util.js#L166-L181
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bodyLength(body: any) {
  if (body == null) {
    return 0
  } else if (isStream(body)) {
    const state = (body as any)._readableState
    return state && state.ended === true && Number.isFinite(state.length) ? state.length : null
  } else if (isBlobLike(body)) {
    return body.size != null ? body.size : null
  } else if (isBuffer(body)) {
    return body.byteLength
  }

  return null
}
