/* eslint max-depth: ["error", 4] */
import sameOrigin from 'same-origin'
import parseHeaders from 'parse-headers'
import FetchXhr from './browser/fetchXhr'

const noop = function() {
  /* intentional noop */
}

const win = typeof document === 'undefined' || typeof window === 'undefined' ? undefined : window
const adapter = win ? 'xhr' : 'fetch'

let XmlHttpRequest = typeof XMLHttpRequest === 'function' ? XMLHttpRequest : noop
const hasXhr2 = 'withCredentials' in new XmlHttpRequest()
// eslint-disable-next-line no-undef
const XDR = typeof XDomainRequest === 'undefined' ? undefined : XDomainRequest
let CrossDomainRequest = hasXhr2 ? XmlHttpRequest : XDR

// Fallback to fetch-based XHR polyfill for non-browser environments like Workers
if (!win) {
  XmlHttpRequest = FetchXhr
  CrossDomainRequest = FetchXhr
}

export default (context, callback) => {
  const opts = context.options
  const options = context.applyMiddleware('finalizeOptions', opts)
  const timers = {}

  // Deep-checking window.location because of react native, where `location` doesn't exist
  const cors = win && win.location && !sameOrigin(win.location.href, options.url)

  // Allow middleware to inject a response, for instance in the case of caching or mocking
  const injectedResponse = context.applyMiddleware('interceptRequest', undefined, {
    adapter,
    context
  })

  // If middleware injected a response, treat it as we normally would and return it
  // Do note that the injected response has to be reduced to a cross-environment friendly response
  if (injectedResponse) {
    const cbTimer = setTimeout(callback, 0, null, injectedResponse)
    const cancel = () => clearTimeout(cbTimer)
    return {abort: cancel}
  }

  // We'll want to null out the request on success/failure
  let xhr = cors ? new CrossDomainRequest() : new XmlHttpRequest()

  const isXdr = win && win.XDomainRequest && xhr instanceof win.XDomainRequest
  const headers = options.headers
  const delays = options.timeout

  // Request state
  let aborted = false
  let loaded = false
  let timedOut = false

  // Apply event handlers
  xhr.onerror = onError
  xhr.ontimeout = onError
  xhr.onabort = () => {
    stopTimers(true)
    aborted = true
  }

  // IE9 must have onprogress be set to a unique function
  xhr.onprogress = () => {
    /* intentional noop */
  }

  const loadEvent = isXdr ? 'onload' : 'onreadystatechange'
  xhr[loadEvent] = () => {
    // Prevent request from timing out
    resetTimers()

    if (aborted || (xhr.readyState !== 4 && !isXdr)) {
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
    options.method,
    options.url,
    true // Always async
  )

  // Some options need to be applied after open
  xhr.withCredentials = !!options.withCredentials

  // Set headers
  if (headers && xhr.setRequestHeader) {
    for (const key in headers) {
      if (headers.hasOwnProperty(key)) {
        xhr.setRequestHeader(key, headers[key])
      }
    }
  } else if (headers && isXdr) {
    throw new Error('Headers cannot be set on an XDomainRequest object')
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

  function timeoutRequest(code) {
    timedOut = true
    xhr.abort()
    const error = new Error(
      code === 'ESOCKETTIMEDOUT'
        ? `Socket timed out on request to ${options.url}`
        : `Connection timed out on request to ${options.url}`
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

  function stopTimers(force) {
    // Only clear the connect timeout if we've got a connection
    if (force || aborted || (xhr.readyState >= 2 && timers.connect)) {
      clearTimeout(timers.connect)
    }

    if (timers.socket) {
      clearTimeout(timers.socket)
    }
  }

  function onError(error) {
    if (loaded) {
      return
    }

    // Clean up
    stopTimers(true)
    loaded = true
    xhr = null

    // Annoyingly, details are extremely scarce and hidden from us.
    // We only really know that it is a network error
    const err = error || new Error(`Network error while attempting to reach ${options.url}`)
    err.isNetworkError = true
    err.request = options
    callback(err)
  }

  function reduceResponse() {
    let statusCode = xhr.status
    let statusMessage = xhr.statusText

    if (isXdr && statusCode === undefined) {
      // IE8 CORS GET successful response doesn't have a status field, but body is fine
      statusCode = 200
    } else if (statusCode > 12000 && statusCode < 12156) {
      // Yet another IE quirk where it emits weird status codes on network errors
      // https://support.microsoft.com/en-us/kb/193625
      return onError()
    } else {
      // Another IE bug where HTTP 204 somehow ends up as 1223
      statusCode = xhr.status === 1223 ? 204 : xhr.status
      statusMessage = xhr.status === 1223 ? 'No Content' : statusMessage
    }

    return {
      body: xhr.response || xhr.responseText,
      url: options.url,
      method: options.method,
      headers: isXdr ? {} : parseHeaders(xhr.getAllResponseHeaders()),
      statusCode: statusCode,
      statusMessage: statusMessage
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
