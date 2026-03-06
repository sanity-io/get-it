import follow, {type FollowResponse, type RedirectableRequest} from 'follow-redirects'
import type {FinalizeNodeOptionsPayload, HttpRequest, MiddlewareResponse} from 'get-it'
import http from 'node:http'
import https from 'node:https'
import {Readable, type Stream} from 'node:stream'

import type {RequestAdapter} from '../types'
import {lowerCaseHeaders} from '../util/lowerCaseHeaders'
import {progressStream} from '../util/progress-stream'
import {decompressResponse} from './node/decompressResponse'
import {parseUrl} from './node/parseUrl'
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
export const adapter: RequestAdapter = 'node'

export class NodeRequestError extends Error {
  request: http.ClientRequest
  code?: string | undefined

  constructor(err: NodeJS.ErrnoException, req: any) {
    super(err.message)
    this.request = req
    this.code = err.code
  }
}

// Reduce a fully fledged node-style response object to
// something that works in both browser and node environment
const reduceResponse = (
  res: http.IncomingMessage,
  remoteAddress: string | undefined,
  reqUrl: string,
  method: string,
  body: any,
): MiddlewareResponse => ({
  body,
  url: reqUrl,
  method: method,
  headers: res.headers,
  statusCode: res.statusCode || 0,
  statusMessage: res.statusMessage || '',
  remoteAddress,
})

export const httpRequester: HttpRequest = (context, cb) => {
  const {options} = context
  const uri = parseUrl(options.url)

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
  let reqOpts: any = {
    ...uri,
    method: options.method,
    headers: {...lowerCaseHeaders(options.headers), ...lengthHeader},
    maxRedirects: options.maxRedirects,
  }

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
    const [username, password] =
      typeof proxy.auth === 'string'
        ? proxy.auth.split(':').map((item) => decodeURIComponent(item))
        : [proxy.auth.username, proxy.auth.password]

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

  let _res: http.IncomingMessage | undefined
  const finalOptions = context.applyMiddleware(
    'finalizeOptions',
    reqOpts,
  ) as FinalizeNodeOptionsPayload
  const request = transport.request(finalOptions, (response) => {
    // Snapshot emptiness before decompressResponse/middleware pipe the
    // IncomingMessage. At this point readableLength reflects exactly what the
    // HTTP parser has buffered, with no async-transform ambiguity.
    const bodyIsKnownEmpty = response.complete && response.readableLength === 0

    const res = tryCompressed ? decompressResponse(response) : response
    _res = res
    const resStream = context.applyMiddleware('onHeaders', res, {
      headers: response.headers,
      adapter,
      context,
    })

    // On redirects, `responseUrl` is set
    const reqUrl = 'responseUrl' in response ? response.responseUrl : options.url
    // Get the remote address from the socket, if available. After the stream is consumed, the socket might be closed, so we grab it here.
    const remoteAddress = res.socket?.remoteAddress

    if (options.stream) {
      callback(null, reduceResponse(res, remoteAddress, reqUrl, reqOpts.method, resStream))

      // When the response body is empty, the stream must still be drained so
      // the 'end' event fires. For unpiped responses this also releases the
      // socket; for piped responses (decompress-response / onHeaders) the pipe
      // chain already consumes the IncomingMessage, but resStream still needs
      // to be drained for 'end' to emit.
      //
      // We prefer the `bodyIsKnownEmpty` snapshot (captured before any piping)
      // because it checks the raw IncomingMessage and is immune to async
      // Transform ambiguity (e.g. zlib where readableLength on the output can
      // be 0 while decompression is still pending).
      //
      // For chunked responses the HTTP parser may not have set `complete` by
      // the time the response callback fires. In that case we fall back to
      // checking the original IncomingMessage in nextTick, but only when it
      // has NOT been piped (readableFlowing !== true) — piping drains
      // readableLength to 0 even for non-empty bodies.
      //
      // When the response was piped through a transform (decompress-response
      // or onHeaders middleware), neither check above works. We instead wait
      // for 'readable' on resStream and peek one byte: null means the stream
      // ended empty, so we resume; non-null means real data, so we unshift it
      // back for the caller to consume.
      process.nextTick(() => {
        if (resStream.readableFlowing) {
          return
        }

        const isEmpty =
          bodyIsKnownEmpty ||
          (response.complete && response.readableLength === 0 && !response.readableFlowing)

        if (isEmpty) {
          resStream.resume()
          return
        }

        // Piped case: response was consumed by decompress-response or
        // onHeaders middleware, so we cannot inspect readableLength on the
        // original IncomingMessage. Peek via 'readable' instead.
        if (response.complete && response.readableFlowing) {
          resStream.once('readable', () => {
            if (resStream.readableFlowing) {
              return
            }
            const chunk = resStream.read(1)
            if (chunk === null) {
              resStream.resume()
            } else {
              resStream.unshift(chunk)
            }
          })
        }
      })

      return
    }

    // Concatenate the response body, then parse the response with middlewares
    concat(resStream, (err: any, data: any) => {
      if (err) {
        return callback(err)
      }

      const body = options.rawBody ? data : data.toString()
      const reduced = reduceResponse(res, remoteAddress, reqUrl, reqOpts.method, body)
      return callback(null, reduced)
    })
  })

  function onError(err: NodeJS.ErrnoException) {
    // HACK: If we have a socket error, and response has already been assigned this means
    // that a response has already been sent. According to node.js docs, this is
    // will result in the response erroring with an error code of 'ECONNRESET'.
    // We first destroy the response, then the request, with the same error. This way the
    // error is forwarded to both the response and the request.
    // See the event order outlined here https://nodejs.org/api/http.html#httprequesturl-options-callback for how node.js handles the different scenarios.
    if (_res) _res.destroy(err)
    request.destroy(err)
  }

  request.once('socket', (socket: NodeJS.Socket) => {
    socket.once('error', onError)
    request.once('response', (response) => {
      response.once('end', () => {
        socket.removeListener('error', onError)
      })
    })
  })

  request.once('error', (err: NodeJS.ErrnoException) => {
    if (_res) return
    // The callback has already been invoked. Any error should be sent to the response.
    callback(new NodeRequestError(err, request))
  })

  if (options.timeout) {
    timedOut(request, options.timeout)
  }

  // Cheating a bit here; since we're not concerned about the "bundle size" in node,
  // and modifying the body stream would be sorta tricky, we're just always going
  // to put a progress stream in the middle here.
  const {bodyStream, progress} = getProgressStream(options)

  // Let middleware know we're about to do a request
  context.applyMiddleware('onRequest', {options, adapter, request, context, progress})

  if (bodyStream) {
    bodyStream.pipe(request)
  } else {
    request.end(options.body)
  }

  return {abort: () => request.destroy()}
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

  const progress = progressStream({time: 32, length})
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
