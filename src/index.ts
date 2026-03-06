import type {
  BufferedResponse,
  CreateRequestOptions,
  FetchFunction,
  FetchInit,
  RequestOptions,
} from './types'
import {createBufferedResponse} from './response'
import {HttpError} from './types'

export {createBufferedResponse} from './response'
export {HttpError} from './types'
export type {
  BufferedResponse,
  CreateRequestOptions,
  FetchFunction,
  JsonResponse,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
} from './types'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

// TODO: When implementing the `as` option (Task 5), the return type should
// become the full RequestFunction with overloaded signatures for json/text/stream.
// For now, createRequest returns a simple function that always yields BufferedResponse.

export function createRequest(
  options?: CreateRequestOptions,
): {
  (url: string): Promise<BufferedResponse>
  (options: RequestOptions): Promise<BufferedResponse>
} {
  const instanceFetch = options?.fetch
  const instanceHeaders = options?.headers
  const instanceBase = options?.base
  const instanceHttpErrors = options?.httpErrors
  const instanceTimeout = options?.timeout

  async function request(input: string | RequestOptions): Promise<BufferedResponse> {
    // 1. Normalize input: string -> { url: string }
    const opts: RequestOptions = typeof input === 'string' ? {url: input} : input

    // 2. Resolve which fetch to use
    const fetchFn: FetchFunction = opts.fetch ?? instanceFetch ?? globalThis.fetch

    // 4a: Base URL — prepend base if URL is not absolute
    let url = opts.url
    if (instanceBase && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = instanceBase + url
    }

    // 4d: Query string — merge query params into URL
    if (opts.query) {
      const urlObj = new URL(url)
      for (const [key, value] of Object.entries(opts.query)) {
        if (value !== undefined) {
          urlObj.searchParams.set(key, String(value))
        }
      }
      url = urlObj.toString()
    }

    // 4b: Default headers — merge instance headers with per-request headers
    const headers: Record<string, string> = {
      ...instanceHeaders,
      ...opts.headers,
    }

    // 3. Build fetch init
    const init: FetchInit = {}
    if (opts.method) init.method = opts.method
    if (Object.keys(headers).length > 0) init.headers = headers

    // 4c: JSON request body — auto-serialize plain objects and arrays
    if (opts.body !== undefined && opts.body !== null) {
      if (typeof opts.body === 'string') {
        init.body = opts.body
      } else if (isPlainObject(opts.body) || Array.isArray(opts.body)) {
        init.body = JSON.stringify(opts.body)
        headers['content-type'] = 'application/json'
        init.headers = headers
      } else if (
        opts.body instanceof Uint8Array ||
        opts.body instanceof ArrayBuffer ||
        opts.body instanceof ReadableStream ||
        opts.body instanceof Blob
      ) {
        init.body = opts.body
      } else if (typeof FormData !== 'undefined' && opts.body instanceof FormData) {
        init.body = opts.body
      } else if (typeof URLSearchParams !== 'undefined' && opts.body instanceof URLSearchParams) {
        init.body = opts.body
      }
    }

    // 4f: Timeout — resolve timeout value (per-request wins over instance)
    const timeoutValue = opts.timeout !== undefined ? opts.timeout : instanceTimeout

    // 4g: Signal — build the final abort signal
    let signal: AbortSignal | undefined = opts.signal
    if (timeoutValue !== undefined && timeoutValue !== false) {
      const timeoutSignal = AbortSignal.timeout(timeoutValue)
      if (signal) {
        signal = AbortSignal.any([signal, timeoutSignal])
      } else {
        signal = timeoutSignal
      }
    }
    if (signal) init.signal = signal

    // 4. Call fetch
    const response = await fetchFn(url, init)

    // 5. Buffer the response body
    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // 6. Return BufferedResponse
    const buffered = createBufferedResponse(
      response.status,
      response.statusText,
      response.headers,
      bytes,
    )

    // 4e: HTTP errors — throw if status >= 400
    const httpErrors = opts.httpErrors ?? instanceHttpErrors ?? true
    if (httpErrors && response.status >= 400) {
      throw new HttpError({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: buffered.text(),
        response: buffered,
      })
    }

    return buffered
  }

  return request
}
