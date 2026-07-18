import type {BufferedResponse, JsonResponse, TextResponse} from './types'

/**
 * An error thrown when an HTTP request fails with a non-2xx status code.
 * Contains details about the request and response for debugging purposes.
 *
 * @public
 */
export class HttpError extends Error {
  /** The URL that was requested. */
  declare url: string
  /** The HTTP method used (e.g. `"GET"`, `"POST"`). */
  declare method: string
  /** The HTTP status code (e.g. `404`, `500`). */
  declare status: number
  /** The HTTP status text (e.g. `"Not Found"`). */
  declare statusText: string
  /** Response headers. */
  declare headers: Headers
  /** Response body — may be a string (from text decoding) or other type. */
  declare body: unknown
  /** The full response object. */
  declare response: BufferedResponse | JsonResponse | TextResponse

  constructor(opts: {
    url: string
    method: string
    status: number
    statusText: string
    headers: Headers
    body: unknown
    response: BufferedResponse | JsonResponse | TextResponse
  }) {
    const url = opts.url.length > 400 ? opts.url.slice(0, 399) + '…' : opts.url
    super(`${opts.method}-request to ${url} resulted in HTTP ${opts.status} ${opts.statusText}`)
    this.name = 'HttpError'
    this.url = opts.url
    this.method = opts.method
    this.status = opts.status
    this.statusText = opts.statusText
    this.headers = opts.headers
    this.body = opts.body
    this.response = opts.response
  }
}

/**
 * An error thrown when a request exceeds a configured timeout phase.
 *
 * Currently only produced for the `headers` phase (time-to-response-headers,
 * see {@link TimeoutOptions.headers}). Total-deadline timeouts reject with the
 * platform's `TimeoutError` DOMException, which shares the same `name` —
 * `err.name === 'TimeoutError'` catches both.
 *
 * The `code` is the string `'ETIMEDOUT'`, which the default `retry()`
 * middleware treats as retryable for GET/HEAD requests.
 *
 * @public
 */
export class TimeoutError extends Error {
  /** The URL that was requested. */
  declare url: string
  /** The HTTP method used (e.g. `"GET"`, `"POST"`). */
  declare method: string
  /** The configured timeout in milliseconds that was exceeded. */
  declare timeoutMs: number
  /** Which timeout phase was exceeded. */
  declare phase: 'headers'
  /** Node-style error code, recognized by the default `retry()` predicate. */
  declare code: 'ETIMEDOUT'

  constructor(opts: {url: string; method: string; timeoutMs: number; phase: 'headers'}) {
    const url = opts.url.length > 400 ? opts.url.slice(0, 399) + '…' : opts.url
    super(
      `Request timed out after ${opts.timeoutMs}ms waiting for response headers: ${opts.method} ${url}`,
    )
    this.name = 'TimeoutError'
    this.url = opts.url
    this.method = opts.method
    this.timeoutMs = opts.timeoutMs
    this.phase = opts.phase
    this.code = 'ETIMEDOUT'
  }
}
