import type {HttpRequest, MiddlewareResponse, RequestOptions} from 'get-it'
import parseHeaders from 'parse-headers'

import {FetchXhr} from './browser/fetchXhr'

/**
 * Use fetch if it's available, non-browser environments such as Deno, Edge Runtime and more provide fetch as a global but doesn't provide xhr
 * @public
 */
export const adapter = (
  typeof XMLHttpRequest === 'function' ? ('xhr' as const) : ('fetch' as const)
) satisfies import('../types').RequestAdapter

// Fallback to fetch-based XHR polyfill for non-browser environments like Workers
const XmlHttpRequest = adapter === 'xhr' ? XMLHttpRequest : FetchXhr

export const httpRequester: HttpRequest = (context, callback) => {
  const opts = context.options
  const options = context.applyMiddleware('finalizeOptions', opts) as RequestOptions
  const timers: any = {}

  // Allow middleware to inject a response, for instance in the case of caching or mocking
  const injectedResponse = context.applyMiddleware('interceptRequest', undefined, {
    adapter,
    context,
  })

  // If middleware injected a response, treat it as we normally would and return it
  // Do note that the injected response has to be reduced to a cross-environment friendly response
  if (injectedResponse) {
    const cbTimer = setTimeout(callback, 0, null, injectedResponse)
    const cancel = () => clearTimeout(cbTimer)
    return {abort: cancel}
  }

  // We'll want to null out the request on success/failure
  let xhr = new XmlHttpRequest()

  if (xhr instanceof FetchXhr && typeof options.fetch === 'object') {
    xhr.setInit(options.fetch, options.useAbortSignal ?? true)
  }

  const headers = options.headers
  const delays = options.timeout

  // Request state
  let aborted = false
  let loaded = false
  let timedOut = false

  // Apply event handlers
  xhr.onerror = (event: ProgressEvent) => {
    onError(
      new Error(
        `Request error while attempting to reach ${options.url}${
          event.lengthComputable ? `(${event.loaded} of ${event.total} bytes transferred)` : ''
        }`,
      ),
    )
  }
  xhr.ontimeout = (event: ProgressEvent) => {
    onError(
      new Error(
        `Request timeout while attempting to reach ${options.url}${
          event.lengthComputable ? `(${event.loaded} of ${event.total} bytes transferred)` : ''
        }`,
      ),
    )
  }
  xhr.onabort = () => {
    stopTimers(true)
    aborted = true
  }

  xhr.onreadystatechange = () => {
    // Prevent request from timing out
    resetTimers()

    if (aborted || xhr.readyState !== 4) {
      return
    }

    // Will be handled by onError
    if (xhr.status === 0) {
      return
    }

    onLoad()
  }

  // @todo two last options to open() is username/password
  xhr.open(
    options.method!,
    options.url,
    true, // Always async
  )

  // Some options need to be applied after open
  xhr.withCredentials = !!options.withCredentials

  // Set headers
  if (headers && xhr.setRequestHeader) {
    for (const key in headers) {
      // eslint-disable-next-line no-prototype-builtins
      if (headers.hasOwnProperty(key)) {
        xhr.setRequestHeader(key, headers[key])
      }
    }
  }

  if (options.rawBody) {
    xhr.responseType = 'arraybuffer'
  }

  // Let middleware know we're about to do a request
  context.applyMiddleware('onRequest', {options, adapter, request: xhr, context})

  xhr.send(options.body || null)

  // Figure out which timeouts to use (if any)
  if (delays) {
    timers.connect = setTimeout(() => timeoutRequest('ETIMEDOUT'), delays.connect)
  }

  return {abort}

  function abort() {
    aborted = true

    if (xhr) {
      xhr.abort()
    }
  }

  function timeoutRequest(code: any) {
    timedOut = true
    xhr.abort()
    const error: any = new Error(
      code === 'ESOCKETTIMEDOUT'
        ? `Socket timed out on request to ${options.url}`
        : `Connection timed out on request to ${options.url}`,
    )
    error.code = code
    context.channels.error.publish(error)
  }

  function resetTimers() {
    if (!delays) {
      return
    }

    stopTimers()
    timers.socket = setTimeout(() => timeoutRequest('ESOCKETTIMEDOUT'), delays.socket)
  }

  function stopTimers(force?: boolean) {
    // Only clear the connect timeout if we've got a connection
    if (force || aborted || (xhr.readyState >= 2 && timers.connect)) {
      clearTimeout(timers.connect)
    }

    if (timers.socket) {
      clearTimeout(timers.socket)
    }
  }

  function onError(error: Error) {
    if (loaded) {
      return
    }

    // Clean up
    stopTimers(true)
    loaded = true
    ;(xhr as any) = null

    // Annoyingly, details are extremely scarce and hidden from us.
    // We only really know that it is a network error
    const err = (error ||
      new Error(`Network error while attempting to reach ${options.url}`)) as Error & {
      isNetworkError: boolean
      request?: typeof options
    }
    err.isNetworkError = true
    err.request = options
    callback(err)
  }

  function reduceResponse(): MiddlewareResponse {
    return {
      body:
        xhr.response ||
        (xhr.responseType === '' || xhr.responseType === 'text' ? xhr.responseText : ''),
      url: options.url,
      method: options.method!,
      headers: parseHeaders(xhr.getAllResponseHeaders()),
      statusCode: xhr.status,
      statusMessage: xhr.statusText,
    }
  }

  function onLoad() {
    if (aborted || loaded || timedOut) {
      return
    }

    if (xhr.status === 0) {
      onError(new Error('Unknown XHR error'))
      return
    }

    // Prevent being called twice
    stopTimers()
    loaded = true
    callback(null, reduceResponse())
  }
}
